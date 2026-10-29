# FlexoCards iteration: brand, blog + authors, uploads, card edit window, public share, admin settings, clerk webhook, site gate
# NOTE: site mode is restored by the tester from /tmp/app_settings_backup_full.json (mongo) + backend restart after the run.
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
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
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()
FREE_EMAIL = "qa.free+clerk_test@example.com"
LIVE = {"cs_enabled": False, "cs_launch_at": "", "cs_auto_open": True, "mt_enabled": False, "mt_start_at": "", "mt_duration_min": 60}


def iso(d):
    return d.isoformat()


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


@pytest.fixture(scope="module", autouse=True)
def setup(tok):
    r = requests.put(f"{API}/admin/settings/site", json=LIVE, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200, r.text
    yield
    db.blog_posts.delete_many({"title": {"$regex": "^TEST_"}})
    db.saved_cards.delete_many({"title": {"$regex": "^TEST_"}})
    db.users.update_one({"email": FREE_EMAIL}, {"$set": {"can_blog": False}})
    requests.put(f"{API}/admin/settings/site", json=LIVE, headers=H(tok, "admin"), timeout=20)
    for s in ("clerk", "email", "razorpay"):
        requests.delete(f"{API}/admin/settings/{s}", headers=H(tok, "admin"), timeout=20)


def card_body(title="TEST_card"):
    return {"title": title, "sport_id": "cricket", "template_id": "classic", "data": {"name": "QA Player"}}


# ---- brand / status
def test_root_brand():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200 and r.json()["app"] == "FlexoCards"


def test_site_status_shape():
    d = requests.get(f"{API}/site/status", timeout=20).json()
    for k in ("state", "blocked", "coming_soon", "maintenance"):
        assert k in d
    assert d["state"] == "live" and d["blocked"] is False


# ---- blog
def test_blog_admin_publish_and_public(tok):
    r = requests.post(f"{API}/me/posts", headers=H(tok, "admin"), timeout=20, json={
        "title": "TEST_ Admin Post", "excerpt": "ex", "content": "# Hello\n\n**bold** text", "status": "published", "tags": ["QA", "qa"]})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "published" and p["published_at"] and p["tags"] == ["qa"] and "_id" not in p
    lst = requests.get(f"{API}/blog", timeout=20).json()
    assert any(x["id"] == p["id"] for x in lst["posts"])
    one = requests.get(f"{API}/blog/{p['slug']}", timeout=20)
    assert one.status_code == 200 and one.json()["post"]["content"].startswith("# Hello")
    assert requests.get(f"{API}/blog/does-not-exist-xyz", timeout=20).status_code == 404


def test_blog_free_user_forbidden(tok):
    r = requests.post(f"{API}/me/posts", headers=H(tok, "free"), json={"title": "TEST_ nope", "status": "draft"}, timeout=20)
    assert r.status_code == 403, r.text


def test_blog_author_flow(tok):
    a = requests.post(f"{API}/admin/blog/authors", headers=H(tok, "admin"), json={"email": FREE_EMAIL}, timeout=20)
    assert a.status_code == 200, a.text
    uid = a.json()["user_id"]
    me = requests.get(f"{API}/me", headers=H(tok, "free"), timeout=20).json()
    assert me["member"]["can_blog"] is True
    r = requests.post(f"{API}/me/posts", headers=H(tok, "free"), json={"title": "TEST_ Author Post", "content": "hi", "status": "published", "featured": True}, timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "pending" and p["featured"] is False
    pend = requests.get(f"{API}/admin/blog/posts?status=pending", headers=H(tok, "admin"), timeout=20).json()
    assert any(x["id"] == p["id"] for x in pend)
    assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
    s = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=H(tok, "admin"), json={"status": "published"}, timeout=20)
    assert s.status_code == 200
    assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 200
    s = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=H(tok, "admin"), json={"status": "rejected", "note": "nope"}, timeout=20)
    assert s.status_code == 200
    assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
    # author may not use admin endpoints
    assert requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=H(tok, "free"), json={"status": "published"}, timeout=20).status_code == 403
    # image upload by author
    up = requests.post(f"{API}/uploads/image", headers=H(tok, "free"), files={"file": ("t.png", PNG, "image/png")}, timeout=30)
    assert up.status_code == 200, up.text
    url = up.json()["url"]
    assert url.startswith("/api/files/")
    f = requests.get(BASE_URL + url, timeout=20)
    assert f.status_code == 200 and f.content == PNG
    db.files.update_one({"storage_path": url[len("/api/files/"):]}, {"$set": {"is_deleted": True}})
    bad = requests.post(f"{API}/uploads/image", headers=H(tok, "free"), files={"file": ("t.txt", b"x", "text/plain")}, timeout=30)
    assert bad.status_code == 400
    # remove author
    d = requests.delete(f"{API}/admin/blog/authors/{uid}", headers=H(tok, "admin"), timeout=20)
    assert d.status_code == 200
    assert requests.get(f"{API}/me", headers=H(tok, "free"), timeout=20).json()["member"]["can_blog"] is False
    assert requests.post(f"{API}/uploads/image", headers=H(tok, "free"), files={"file": ("t.png", PNG, "image/png")}, timeout=30).status_code == 403


def test_blog_unknown_author_404(tok):
    r = requests.post(f"{API}/admin/blog/authors", headers=H(tok, "admin"), json={"email": "nobody_x@example.com"}, timeout=20)
    assert r.status_code == 404


# ---- cards edit window + share
def test_free_card_locked_and_no_share(tok):
    r = requests.post(f"{API}/me/cards", headers=H(tok, "free"), json=card_body(), timeout=20)
    if r.status_code == 402:
        pytest.skip("free saved-card quota full: " + r.text)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["editable"] is False and c["lock_reason"] == "free_plan"
    assert requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), json=card_body("TEST_x"), timeout=20).status_code == 402
    assert requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "free"), json={"image": PNG_URI}, timeout=20).status_code == 402
    requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), timeout=20)


def test_pro_card_edit_and_share(tok):
    r = requests.post(f"{API}/me/cards", headers=H(tok, "pro"), json=card_body(), timeout=20)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["editable"] is True and c["lock_reason"] == ""
    until = datetime.fromisoformat(c["editable_until"])
    assert abs((until - datetime.now(timezone.utc)).total_seconds() - 6 * 3600) < 120
    assert requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json=card_body("TEST_edited"), timeout=20).status_code == 200
    got = [x for x in requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json() if x["id"] == c["id"]][0]
    assert got["title"] == "TEST_edited"
    s = requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), json={"image": PNG_URI}, timeout=30)
    assert s.status_code == 200, s.text
    sid = s.json()["share_id"]
    v = requests.get(f"{API}/share/{sid}", timeout=20)
    assert v.status_code == 200 and v.json()["image_url"].startswith("/api/files/")
    assert requests.get(BASE_URL + v.json()["image_url"], timeout=20).status_code == 200
    assert requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), json={"image": "data:image/jpeg;base64,xx"}, timeout=20).status_code == 400
    assert requests.delete(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), timeout=20).status_code == 200
    assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
    # window closed -> 403
    db.saved_cards.update_one({"id": c["id"]}, {"$set": {"created_at": iso(datetime.now(timezone.utc) - timedelta(hours=7))}})
    st = [x for x in requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json() if x["id"] == c["id"]][0]
    assert st["editable"] is False and st["lock_reason"] == "window_closed"
    assert requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json=card_body("TEST_late"), timeout=20).status_code == 403
    requests.delete(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), timeout=20)


# ---- admin settings
def test_settings_rbac(tok):
    assert requests.get(f"{API}/admin/settings", headers=H(tok, "free"), timeout=20).status_code == 403
    r = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("razorpay", "email", "clerk", "site", "site_status", "social", "templates"):
        assert k in d
    assert "smtp_pass" not in d["email"] and "key_secret" not in d["razorpay"]


def test_razorpay_bad_keys(tok):
    r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), json={"key_id": "rzp_test_BADBADBAD123", "key_secret": "nope"}, timeout=30)
    assert r.status_code == 400 and "Razorpay" in r.json()["detail"]
    assert requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), json={"key_id": "bad"}, timeout=20).status_code == 422


def test_email_settings_and_test(tok):
    r = requests.put(f"{API}/admin/settings/email", headers=H(tok, "admin"), json={"provider": "smtp", "from_name": "FlexoCards", "smtp_host": ""}, timeout=20)
    # SMTP w/o creds -> 400 unless env provides them
    assert r.status_code in (200, 400)
    r = requests.put(f"{API}/admin/settings/email", headers=H(tok, "admin"), json={"provider": "emergent", "from_name": "FlexoCards QA"}, timeout=20)
    assert r.status_code == 200 and r.json()["provider"] == "emergent" and r.json()["from_name"] == "FlexoCards QA"
    t = requests.post(f"{API}/admin/settings/email/test", headers=H(tok, "admin"), timeout=60)
    assert t.status_code == 200, t.text
    assert t.json()["provider"] == "emergent"
    requests.delete(f"{API}/admin/settings/email", headers=H(tok, "admin"), timeout=20)


def test_email_previews(tok):
    tpls = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20).json()["templates"]
    assert len(tpls) >= 10
    for t in tpls:
        r = requests.get(f"{API}/admin/settings/email/preview/{t['id']}", headers=H(tok, "admin"), timeout=20)
        assert r.status_code == 200, t
        assert "<html" in r.json()["html"].lower() and "FlexoCards" in r.json()["html"] and r.json()["subject"]
    assert requests.get(f"{API}/admin/settings/email/preview/nope", headers=H(tok, "admin"), timeout=20).status_code == 404


def test_social_settings(tok):
    orig = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20).json()["social"]
    assert requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={"instagram": "http://insecure.com/x"}, timeout=20).status_code == 422
    assert requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={"x": "javascript:alert(1)"}, timeout=20).status_code == 422
    r = requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={**orig, "x": "https://x.com/flexo_test"}, timeout=20)
    assert r.status_code == 200
    pub = requests.get(f"{API}/site/social", timeout=20).json()
    assert pub["x"] == "https://x.com/flexo_test" and all(pub.values())
    assert requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json=orig, timeout=20).status_code == 200


def test_clerk_webhook(tok):
    assert requests.put(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), json={"webhook_secret": "nope_1234567890"}, timeout=20).status_code == 422
    key = os.urandom(24)
    secret = "whsec_" + base64.b64encode(key).decode()
    r = requests.put(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), json={"webhook_secret": secret}, timeout=20)
    assert r.status_code == 200 and r.json()["connected"] is True
    body = json.dumps({"type": "email.created", "data": {"to_email_address": "qa.free+clerk_test@example.com", "slug": "verification_code",
                                                         "delivered_by_clerk": False, "data": {"otp_code": "424242", "ttl_minutes": 10}}}).encode()
    sid, ts = f"msg_test_{int(time.time()*1000)}", str(int(time.time()))
    sig = base64.b64encode(hmac.new(key, f"{sid}.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    bad = requests.post(f"{API}/clerk/webhook", data=body, headers={"svix-id": sid, "svix-timestamp": ts, "svix-signature": "v1,AAAA"}, timeout=20)
    assert bad.status_code == 401
    ok = requests.post(f"{API}/clerk/webhook", data=body, headers={"svix-id": sid, "svix-timestamp": ts, "svix-signature": f"v1,{sig}"}, timeout=60)
    assert ok.status_code == 200, ok.text
    dup = requests.post(f"{API}/clerk/webhook", data=body, headers={"svix-id": sid, "svix-timestamp": ts, "svix-signature": f"v1,{sig}"}, timeout=20)
    assert dup.json().get("duplicate") is True
    log = db.email_log.find_one({"kind": "clerk:verification_code"}, sort=[("created_at", -1)])
    assert log and log["status"] == "sent"
    db.webhook_events.delete_one({"event_id": f"clerk:{sid}"})
    requests.delete(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), timeout=20)


# ---- site gate
def test_site_coming_soon_gate(tok):
    future = iso(datetime.now(timezone.utc) + timedelta(days=2))
    r = requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, "cs_enabled": True, "cs_launch_at": future}, timeout=20)
    assert r.status_code == 200 and r.json()["status"]["state"] == "coming_soon"
    try:
        assert requests.get(f"{API}/sports", timeout=20).status_code == 423
        assert requests.get(f"{API}/me/cards", headers=H(tok, "free"), timeout=20).status_code == 423
        assert requests.get(f"{API}/sports", headers=H(tok, "admin"), timeout=20).status_code == 200
        assert requests.get(f"{API}/site/status", timeout=20).status_code == 200
        assert requests.get(f"{API}/", timeout=20).status_code == 200
    finally:
        requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json=LIVE, timeout=20)


def test_site_maintenance_gate(tok):
    past = iso(datetime.now(timezone.utc) - timedelta(minutes=1))
    r = requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, "mt_enabled": True, "mt_start_at": past, "mt_duration_min": 30}, timeout=20)
    assert r.status_code == 200 and r.json()["status"]["state"] == "maintenance"
    try:
        g = requests.get(f"{API}/sports", timeout=20)
        assert g.status_code == 423 and g.json()["site_state"] == "maintenance"
        fut = iso(datetime.now(timezone.utc) + timedelta(hours=3))
        r = requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, "mt_enabled": True, "mt_start_at": fut, "mt_duration_min": 30}, timeout=20)
        assert r.json()["status"]["state"] == "maintenance_scheduled" and r.json()["status"]["blocked"] is False
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200
        assert requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, "mt_enabled": True}, timeout=20).status_code == 400
        assert requests.put(f"{API}/admin/settings/site", headers=H(tok, "free"), json=LIVE, timeout=20).status_code == 403
    finally:
        requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json=LIVE, timeout=20)
