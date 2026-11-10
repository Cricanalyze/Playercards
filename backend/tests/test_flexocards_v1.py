# FlexoCards: card edit lock / 6h window, public share links, blog (public, admin, authors) regression tests
import base64
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
BASIC_EMAIL = "qa.basic+clerk_test@example.com"

# 1x1 PNG
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()


@pytest.fixture(scope="session")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


def card_body(title="TEST_card"):
    return {"title": title, "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST Player", "photo": "x"}}


def make_card(tok, role):
    r = requests.post(f"{API}/me/cards", json=card_body(), headers=H(tok, role), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---- Branding / basics
def test_root_and_plans():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert "rivalcard" not in r.text.lower()


def test_me_roles(tok):
    for role in ("admin", "free", "pro"):
        r = requests.get(f"{API}/me", headers=H(tok, role), timeout=20)
        assert r.status_code == 200, (role, r.text)


# ---- Card editing lock
def test_free_edit_locked(tok):
    c = make_card(tok, "free")
    try:
        assert c["editable"] is False and c["lock_reason"] == "free_plan"
        assert "photo" not in c["data"]
        r = requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_x"), headers=H(tok, "free"), timeout=20)
        assert r.status_code == 402, r.text
        lst = requests.get(f"{API}/me/cards", headers=H(tok, "free"), timeout=20).json()
        assert any(x["id"] == c["id"] and x["editable"] is False for x in lst)
    finally:
        requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), timeout=20)


def test_pro_edit_window(tok):
    c = make_card(tok, "pro")
    try:
        assert c["editable"] is True and c["lock_reason"] == ""
        r = requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_edited"), headers=H(tok, "pro"), timeout=20)
        assert r.status_code == 200
        lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
        assert any(x["id"] == c["id"] and x["title"] == "TEST_edited" for x in lst)
        old = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
        db.saved_cards.update_one({"id": c["id"]}, {"$set": {"created_at": old}})
        r = requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_late"), headers=H(tok, "pro"), timeout=20)
        assert r.status_code == 403, r.text
        lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
        assert any(x["id"] == c["id"] and x["lock_reason"] == "window_closed" for x in lst)
    finally:
        requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), timeout=20)


# ---- Public share
def test_share_free_402(tok):
    c = make_card(tok, "free")
    try:
        r = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "free"), timeout=30)
        assert r.status_code == 402, r.text
    finally:
        requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), timeout=20)


def test_share_pro_flow(tok):
    c = make_card(tok, "pro")
    try:
        r = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": "data:image/jpeg;base64,AAAA"}, headers=H(tok, "pro"), timeout=30)
        assert r.status_code == 400
        r = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "pro"), timeout=60)
        assert r.status_code == 200, r.text
        sid = r.json()["share_id"]
        # re-share keeps same id
        r2 = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "pro"), timeout=60)
        assert r2.json()["share_id"] == sid
        g = requests.get(f"{API}/share/{sid}", timeout=20)
        assert g.status_code == 200, g.text
        info = g.json()
        assert info["image_url"].startswith("/api/files/")
        img = requests.get(BASE_URL + info["image_url"], timeout=60)
        assert img.status_code == 200 and img.content[:4] == b"\x89PNG"
        lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
        assert any(x["id"] == c["id"] and x["share_id"] == sid for x in lst)
        d = requests.delete(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), timeout=20)
        assert d.status_code == 200
        assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
    finally:
        requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), timeout=20)


def test_share_owner_downgraded_410(tok):
    uid = db.users.find_one({"email": "qa.pro+clerk_test@example.com"})["user_id"]
    c = make_card(tok, "pro")
    subs = list(db.subscriptions.find({"user_id": uid, "status": {"$in": ["active", "trialing", "past_due"]}}, {"_id": 1}))
    try:
        sid = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "pro"), timeout=60).json()["share_id"]
        db.subscriptions.update_many({"_id": {"$in": [s["_id"] for s in subs]}}, {"$set": {"status": "expired"}})
        r = requests.get(f"{API}/share/{sid}", timeout=20)
        assert r.status_code == 410, r.text
    finally:
        db.subscriptions.update_many({"_id": {"$in": [s["_id"] for s in subs]}}, {"$set": {"status": "active"}})
        requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), timeout=20)


def test_share_unknown_404():
    assert requests.get(f"{API}/share/doesnotexist123", timeout=20).status_code == 404


# ---- Blog
@pytest.fixture(scope="module")
def basic_uid(tok):
    u = db.users.find_one({"email": BASIC_EMAIL})
    return u["user_id"]


def test_non_author_forbidden(tok, basic_uid):
    db.users.update_one({"user_id": basic_uid}, {"$set": {"can_blog": False}})
    assert requests.get(f"{API}/me/posts", headers=H(tok, "basic"), timeout=20).status_code == 403
    r = requests.post(f"{API}/uploads/image", files={"file": ("a.png", PNG, "image/png")}, headers=H(tok, "basic"), timeout=30)
    assert r.status_code == 403
    assert requests.get(f"{API}/admin/blog/posts", headers=H(tok, "basic"), timeout=20).status_code == 403


def test_admin_publish_and_public(tok):
    up = requests.post(f"{API}/uploads/image", files={"file": ("a.png", PNG, "image/png")}, headers=H(tok, "admin"), timeout=60)
    assert up.status_code == 200, up.text
    url = up.json()["url"]
    assert requests.get(BASE_URL + url, timeout=60).status_code == 200
    bad = requests.post(f"{API}/uploads/image", files={"file": ("a.txt", b"hi", "text/plain")}, headers=H(tok, "admin"), timeout=30)
    assert bad.status_code == 400
    body = {"title": "TEST_ Admin Post Flexo", "excerpt": "ex", "content": "# Hello\n\n**bold**", "cover_image": url,
            "category": "TESTcat", "tags": ["TESTtag", "Cricket"], "featured": True, "status": "published"}
    r = requests.post(f"{API}/me/posts", json=body, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    try:
        assert p["status"] == "published" and p["featured"] is True and p["published_at"]
        assert p["tags"] == ["testtag", "cricket"]
        lst = requests.get(f"{API}/blog", params={"q": "TEST_ Admin Post"}, timeout=20).json()
        assert any(x["id"] == p["id"] for x in lst["posts"])
        assert "TESTcat" in lst["categories"]
        assert requests.get(f"{API}/blog", params={"tag": "testtag"}, timeout=20).json()["total"] >= 1
        g = requests.get(f"{API}/blog/{p['slug']}", timeout=20)
        assert g.status_code == 200 and g.json()["post"]["content"].startswith("# Hello")
        # unpublish via admin
        s = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "draft"}, headers=H(tok, "admin"), timeout=20)
        assert s.status_code == 200
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
    finally:
        requests.delete(f"{API}/me/posts/{p['id']}", headers=H(tok, "admin"), timeout=20)


def test_author_flow(tok, basic_uid):
    A = H(tok, "admin")
    r = requests.post(f"{API}/admin/blog/authors", json={"email": BASIC_EMAIL}, headers=A, timeout=20)
    assert r.status_code == 200, r.text
    assert requests.post(f"{API}/admin/blog/authors", json={"email": "nobody_TEST@example.com"}, headers=A, timeout=20).status_code == 404
    authors = requests.get(f"{API}/admin/blog/authors", headers=A, timeout=20).json()
    assert any(a["user_id"] == basic_uid for a in authors)
    B = H(tok, "basic")
    assert requests.get(f"{API}/me/posts", headers=B, timeout=20).status_code == 200
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_ Author Post", "content": "hi", "featured": True, "status": "published"}, headers=B, timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    try:
        assert p["status"] == "pending" and p["featured"] is False
        pend = requests.get(f"{API}/admin/blog/posts", params={"status": "pending"}, headers=A, timeout=20).json()
        assert any(x["id"] == p["id"] for x in pend)
        rj = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "rejected", "note": "TEST needs work"}, headers=A, timeout=20)
        assert rj.status_code == 200
        mine = requests.get(f"{API}/me/posts/{p['id']}", headers=B, timeout=20).json()
        assert mine["status"] == "rejected" and mine["review_note"] == "TEST needs work"
        pb = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "published"}, headers=A, timeout=20)
        assert pb.status_code == 200
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 200
        # author can't edit others' posts: free user not an author -> 403
        assert requests.get(f"{API}/me/posts/{p['id']}", headers=H(tok, "free"), timeout=20).status_code == 403
    finally:
        requests.delete(f"{API}/me/posts/{p['id']}", headers=A, timeout=20)
        d = requests.delete(f"{API}/admin/blog/authors/{basic_uid}", headers=A, timeout=20)
        assert d.status_code == 200
    assert requests.get(f"{API}/me/posts", headers=B, timeout=20).status_code == 403
