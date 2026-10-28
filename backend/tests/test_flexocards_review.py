# FlexoCards review: root branding, blog (admin/authors/moderation), image uploads, card edit lock, share links
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
FREE_EMAIL = "qa.free+clerk_test@example.com"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


def card_body(title="TEST_card"):
    return {"title": title, "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST Player"}}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db.blog_posts.delete_many({"title": {"$regex": "^TEST_"}})
    db.saved_cards.delete_many({"title": {"$regex": "^TEST_"}})
    db.users.update_one({"email": FREE_EMAIL}, {"$set": {"can_blog": False}})


# root
def test_root_app_name():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    assert r.json().get("app") == "FlexoCards", r.text


# blog: admin publish
def test_admin_post_published_public(tok):
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_Admin Review Post", "excerpt": "s", "content": "# Hi\n\n**bold**",
                                               "category": "News", "tags": ["TEST"], "status": "published"}, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "published" and p["published_at"]
    lst = requests.get(f"{API}/blog", params={"q": "TEST_Admin Review"}, timeout=20).json()
    assert any(x["id"] == p["id"] for x in lst["posts"])
    v1 = requests.get(f"{API}/blog/{p['slug']}", timeout=20).json()["post"]["views"]
    v2 = requests.get(f"{API}/blog/{p['slug']}", timeout=20).json()["post"]["views"]
    assert v2 == v1 + 1


def test_free_no_blog_403(tok):
    db.users.update_one({"email": FREE_EMAIL}, {"$set": {"can_blog": False}})
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_nope"}, headers=H(tok, "free"), timeout=20)
    assert r.status_code == 403


def test_upload_non_writer_403(tok):
    r = requests.post(f"{API}/uploads/image", files={"file": ("a.png", PNG, "image/png")}, headers=H(tok, "free"), timeout=30)
    assert r.status_code == 403


def test_upload_admin_and_serve(tok):
    r = requests.post(f"{API}/uploads/image", files={"file": ("a.png", PNG, "image/png")}, headers=H(tok, "admin"), timeout=60)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/files/")
    g = requests.get(BASE_URL + url, timeout=30)
    assert g.status_code == 200 and g.content == PNG and g.headers["content-type"].startswith("image/png")


def test_upload_bad_type(tok):
    r = requests.post(f"{API}/uploads/image", files={"file": ("a.txt", b"hi", "text/plain")}, headers=H(tok, "admin"), timeout=30)
    assert r.status_code == 400


# blog authors flow
def test_author_flow(tok):
    r = requests.post(f"{API}/admin/blog/authors", json={"email": FREE_EMAIL}, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    me = requests.get(f"{API}/me", headers=H(tok, "free"), timeout=20).json()
    assert me["member"]["can_blog"] is True, me.get("member")
    authors = requests.get(f"{API}/admin/blog/authors", headers=H(tok, "admin"), timeout=20).json()
    assert any(a["user_id"] == uid for a in authors)
    # author upload works
    up = requests.post(f"{API}/uploads/image", files={"file": ("a.png", PNG, "image/png")}, headers=H(tok, "free"), timeout=60)
    assert up.status_code == 200, up.text
    # publish -> pending
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_Author Post", "content": "hello", "status": "published", "featured": True},
                      headers=H(tok, "free"), timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "pending" and p["featured"] is False
    assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
    mine = requests.get(f"{API}/me/posts", headers=H(tok, "free"), timeout=20).json()
    assert any(x["id"] == p["id"] for x in mine)
    # reject with note
    r = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "rejected", "note": "TEST more detail"},
                       headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200
    g = requests.get(f"{API}/me/posts/{p['id']}", headers=H(tok, "free"), timeout=20).json()
    assert g["status"] == "rejected" and g["review_note"] == "TEST more detail"
    # publish
    r = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "published"}, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200
    pub = requests.get(f"{API}/blog/{p['slug']}", timeout=20)
    assert pub.status_code == 200 and pub.json()["post"]["status"] == "published"
    # non-admin cannot moderate
    r = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "published"}, headers=H(tok, "free"), timeout=20)
    assert r.status_code == 403
    # remove author
    r = requests.delete(f"{API}/admin/blog/authors/{uid}", headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_after removal"}, headers=H(tok, "free"), timeout=20)
    assert r.status_code == 403
    assert requests.get(f"{API}/me", headers=H(tok, "free"), timeout=20).json()["member"]["can_blog"] is False


def test_add_author_unknown_email(tok):
    r = requests.post(f"{API}/admin/blog/authors", json={"email": "nobody_xyz@example.com"}, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 404


# cards edit lock
def test_free_card_locked(tok):
    c = requests.post(f"{API}/me/cards", json=card_body(), headers=H(tok, "free"), timeout=20)
    assert c.status_code == 200, c.text
    c = c.json()
    assert c["editable"] is False and c["lock_reason"] == "free_plan"
    r = requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_e"), headers=H(tok, "free"), timeout=20)
    assert r.status_code == 402
    s = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "free"), timeout=20)
    assert s.status_code == 402
    requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), timeout=20)


def test_pro_card_window_and_share(tok):
    c = requests.post(f"{API}/me/cards", json=card_body(), headers=H(tok, "pro"), timeout=20).json()
    assert c["editable"] is True and c["lock_reason"] == ""
    until = datetime.fromisoformat(c["editable_until"]) - datetime.fromisoformat(c["created_at"])
    assert abs(until.total_seconds() - 6 * 3600) < 5
    assert requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_edited"), headers=H(tok, "pro"), timeout=20).status_code == 200
    # share
    s = requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": PNG_URI}, headers=H(tok, "pro"), timeout=60)
    assert s.status_code == 200, s.text
    sid = s.json()["share_id"]
    v = requests.get(f"{API}/share/{sid}", timeout=20)
    assert v.status_code == 200, v.text
    img = requests.get(BASE_URL + v.json()["image_url"], timeout=30)
    assert img.status_code == 200 and img.content == PNG
    # bad image
    assert requests.post(f"{API}/me/cards/{c['id']}/share", json={"image": "data:image/jpeg;base64,AA"}, headers=H(tok, "pro"), timeout=20).status_code == 400
    # unshare
    assert requests.delete(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), timeout=20).status_code == 200
    assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
    # window closed
    db.saved_cards.update_one({"id": c["id"]}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()}})
    lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
    x = next(x for x in lst if x["id"] == c["id"])
    assert x["editable"] is False and x["lock_reason"] == "window_closed"
    assert requests.put(f"{API}/me/cards/{c['id']}", json=card_body("TEST_late"), headers=H(tok, "pro"), timeout=20).status_code == 403
    requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), timeout=20)
