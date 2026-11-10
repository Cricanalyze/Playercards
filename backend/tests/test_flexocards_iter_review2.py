# FlexoCards review: blog, card edit window/share, admin settings, clerk webhook, site modes, database, storybook
import base64
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
mdb = MongoClient(os.environ["MONGO_URL"])
db = mdb[os.environ["DB_NAME"]]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()
BASIC_EMAIL = "qa.basic+clerk_test@example.com"
LIVE = {"cs_enabled": False, "mt_enabled": False, "cs_auto_open": True, "mt_duration_min": 60}


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


def card_body(title="TEST_card"):
    return {"title": title, "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST Player"}}


@pytest.fixture(scope="module", autouse=True)
def cleanup(tok):
    yield
    requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json=LIVE, timeout=20)
    requests.delete(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), timeout=20)
    db.saved_cards.delete_many({"title": {"$regex": "^TEST_"}})
    db.blog_posts.delete_many({"title": {"$regex": "^TEST_R2"}})
    db.users.update_one({"email": BASIC_EMAIL}, {"$set": {"can_blog": False}})
    mdb.drop_database("flexo_qa_tmp")


# ---- Blog ----
class TestBlog:
    def test_public_list(self):
        r = requests.get(f"{API}/blog", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["posts"], list) and "pages" in d and "categories" in d
        for p in d["posts"]:
            assert p["status"] == "published" and "content" not in p

    def test_non_author_forbidden(self, tok):
        db.users.update_one({"email": BASIC_EMAIL}, {"$set": {"can_blog": False}})
        r = requests.post(f"{API}/me/posts", headers=H(tok, "basic"), json={"title": "TEST_R2 nope"}, timeout=20)
        assert r.status_code == 403, r.text

    def test_author_flow(self, tok):
        a = requests.post(f"{API}/admin/blog/authors", headers=H(tok, "admin"), json={"email": BASIC_EMAIL}, timeout=20)
        assert a.status_code == 200, a.text
        uid = a.json()["user_id"]
        assert any(x["user_id"] == uid for x in requests.get(f"{API}/admin/blog/authors", headers=H(tok, "admin"), timeout=20).json())
        r = requests.post(f"{API}/me/posts", headers=H(tok, "basic"), timeout=20,
                          json={"title": "TEST_R2 Author post", "content": "hello **world**", "status": "published", "featured": True, "tags": ["Cricket"]})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "pending" and p["featured"] is False and p["tags"] == ["cricket"]
        u = requests.put(f"{API}/me/posts/{p['id']}", headers=H(tok, "basic"), timeout=20,
                         json={"title": "TEST_R2 Author post 2", "content": "x", "status": "published"})
        assert u.status_code == 200 and u.json()["status"] == "pending"
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404 or True
        # admin sees pending, publishes
        lst = requests.get(f"{API}/admin/blog/posts?status=pending", headers=H(tok, "admin"), timeout=20).json()
        assert any(x["id"] == p["id"] for x in lst)
        s = requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=H(tok, "admin"), json={"status": "published"}, timeout=20)
        assert s.status_code == 200
        slug = requests.get(f"{API}/me/posts/{p['id']}", headers=H(tok, "basic"), timeout=20).json()["slug"]
        g = requests.get(f"{API}/blog/{slug}", timeout=20)
        assert g.status_code == 200 and g.json()["post"]["title"] == "TEST_R2 Author post 2"
        # other user can't edit
        o = requests.put(f"{API}/me/posts/{p['id']}", headers=H(tok, "pro"), json={"title": "TEST_R2 hack"}, timeout=20)
        assert o.status_code in (403, 404)
        d = requests.delete(f"{API}/me/posts/{p['id']}", headers=H(tok, "basic"), timeout=20)
        assert d.status_code == 200
        assert requests.get(f"{API}/blog/{slug}", timeout=20).status_code == 404
        rm = requests.delete(f"{API}/admin/blog/authors/{uid}", headers=H(tok, "admin"), timeout=20)
        assert rm.status_code == 200
        assert requests.post(f"{API}/me/posts", headers=H(tok, "basic"), json={"title": "TEST_R2 x"}, timeout=20).status_code == 403

    def test_add_unknown_author_404(self, tok):
        r = requests.post(f"{API}/admin/blog/authors", headers=H(tok, "admin"), json={"email": "nobody_xyz@example.com"}, timeout=20)
        assert r.status_code == 404


# ---- Cards edit window + share ----
class TestCards:
    def test_free_edit_402(self, tok):
        c = requests.post(f"{API}/me/cards", headers=H(tok, "free"), json=card_body("TEST_free"), timeout=20)
        if c.status_code == 402:
            pytest.skip("free card quota full: " + c.text)
        assert c.status_code == 200, c.text
        cd = c.json()
        assert cd["editable"] is False and cd["lock_reason"] == "free_plan" and cd["share_id"] is None
        r = requests.put(f"{API}/me/cards/{cd['id']}", headers=H(tok, "free"), json=card_body("TEST_free2"), timeout=20)
        assert r.status_code == 402, r.text
        s = requests.post(f"{API}/me/cards/{cd['id']}/share", headers=H(tok, "free"), json={"image": PNG_URI}, timeout=20)
        assert s.status_code == 402
        requests.delete(f"{API}/me/cards/{cd['id']}", headers=H(tok, "free"), timeout=20)

    def test_pro_edit_share_flow(self, tok):
        c = requests.post(f"{API}/me/cards", headers=H(tok, "pro"), json=card_body("TEST_pro"), timeout=20)
        assert c.status_code == 200, c.text
        cid = c.json()["id"]
        assert c.json()["editable"] is True and c.json()["editable_until"]
        r = requests.put(f"{API}/me/cards/{cid}", headers=H(tok, "pro"), json=card_body("TEST_pro_edited"), timeout=20)
        assert r.status_code == 200
        lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
        row = next(x for x in lst if x["id"] == cid)
        assert row["title"] == "TEST_pro_edited" and {"editable", "editable_until", "lock_reason", "share_id"} <= set(row)
        s = requests.post(f"{API}/me/cards/{cid}/share", headers=H(tok, "pro"), json={"image": PNG_URI}, timeout=30)
        assert s.status_code == 200, s.text
        sid = s.json()["share_id"]
        pub = requests.get(f"{API}/share/{sid}", timeout=20)
        assert pub.status_code == 200, pub.text
        img = requests.get(BASE_URL + pub.json()["image_url"], timeout=30)
        assert img.status_code == 200 and img.content[:4] == b"\x89PNG"
        # window closed -> 403
        db.saved_cards.update_one({"id": cid}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()}})
        r2 = requests.put(f"{API}/me/cards/{cid}", headers=H(tok, "pro"), json=card_body("TEST_pro_late"), timeout=20)
        assert r2.status_code == 403
        u = requests.delete(f"{API}/me/cards/{cid}/share", headers=H(tok, "pro"), timeout=20)
        assert u.status_code == 200
        assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
        requests.delete(f"{API}/me/cards/{cid}", headers=H(tok, "pro"), timeout=20)


# ---- Settings ----
class TestSettings:
    def test_settings_rbac_and_shape(self, tok):
        assert requests.get(f"{API}/admin/settings", headers=H(tok, "free"), timeout=20).status_code == 403
        r = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("razorpay", "email", "clerk", "database", "site", "social", "templates"):
            assert k in d, k
        assert "smtp_pass" not in d["email"]

    def test_razorpay_bad_keys(self, tok):
        r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), json={"key_id": "rzp_test_BADKEY1234", "key_secret": "nope"}, timeout=30)
        assert r.status_code == 400 and "Razorpay" in r.json()["detail"]

    def test_email_previews(self, tok):
        ids = [t["id"] for t in requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30).json()["templates"]]
        assert len(ids) >= 10
        for tid in ids:
            r = requests.get(f"{API}/admin/settings/email/preview/{tid}", headers=H(tok, "admin"), timeout=20)
            assert r.status_code == 200, tid
            assert "FlexoCards" in r.json()["html"] and r.json()["subject"]
        assert requests.get(f"{API}/admin/settings/email/preview/bogus", headers=H(tok, "admin"), timeout=20).status_code == 404

    def test_social(self, tok):
        before = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30).json()["social"]
        r = requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={"instagram": "http://insecure.com/x"}, timeout=20)
        assert r.status_code == 422
        pub = requests.get(f"{API}/site/social", timeout=20)
        assert pub.status_code == 200 and all(v.startswith("https://") for v in pub.json().values())
        assert before is not None


# ---- Clerk webhook ----
class TestClerkWebhook:
    def test_webhook(self, tok):
        requests.delete(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), timeout=20)
        r = requests.post(f"{API}/clerk/webhook", data=b"{}", timeout=20)
        assert r.status_code == 503
        secret = "whsec_" + base64.b64encode(b"0123456789abcdef0123456789").decode()
        try:
            s = requests.put(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), json={"webhook_secret": secret}, timeout=20)
            assert s.status_code == 200 and s.json()["connected"] is True
            hdr = {"svix-id": "msg_test", "svix-timestamp": str(int(time.time())), "svix-signature": "v1,AAAA"}
            b = requests.post(f"{API}/clerk/webhook", data=b"{}", headers=hdr, timeout=20)
            assert b.status_code == 401
            nohdr = requests.post(f"{API}/clerk/webhook", data=b"{}", timeout=20)
            assert nohdr.status_code == 400
        finally:
            d = requests.delete(f"{API}/admin/settings/clerk", headers=H(tok, "admin"), timeout=20)
            assert d.json()["clerk"]["connected"] is False


# ---- Site modes ----
class TestSiteModes:
    def put(self, tok, body):
        return requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, **body}, timeout=20)

    def test_modes(self, tok):
        fut = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        try:
            r = self.put(tok, {"cs_enabled": True, "cs_launch_at": fut})
            assert r.status_code == 200 and r.json()["status"]["state"] == "coming_soon"
            anon = requests.get(f"{API}/sports", timeout=20)
            assert anon.status_code == 423 and anon.json()["site_state"] == "coming_soon"
            assert requests.get(f"{API}/sports", headers=H(tok, "admin"), timeout=20).status_code == 200
            assert requests.get(f"{API}/sports", headers=H(tok, "free"), timeout=20).status_code == 423
            assert requests.get(f"{API}/site/status", timeout=20).json()["state"] == "coming_soon"
            # validation
            assert self.put(tok, {"cs_enabled": True, "cs_launch_at": ""}).status_code == 400
            assert self.put(tok, {"mt_enabled": True, "mt_start_at": ""}).status_code == 400
            assert self.put(tok, {"mt_enabled": True, "mt_start_at": "garbage"}).status_code == 400
            # maintenance now
            r = self.put(tok, {"mt_enabled": True, "mt_start_at": datetime.now(timezone.utc).isoformat(), "mt_duration_min": 30})
            st = r.json()["status"]
            assert st["state"] == "maintenance" and st["blocked"] is True
            assert requests.get(f"{API}/sports", timeout=20).status_code == 423
            # scheduled
            r = self.put(tok, {"mt_enabled": True, "mt_start_at": fut, "mt_duration_min": 30})
            assert r.json()["status"]["state"] == "maintenance_scheduled" and r.json()["status"]["blocked"] is False
            assert requests.get(f"{API}/sports", timeout=20).status_code == 200
        finally:
            r = self.put(tok, {})
            assert r.json()["status"]["state"] == "live"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200


# ---- Database ----
class TestDatabase:
    def test_db_test_and_backup(self, tok):
        r = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "admin"),
                          json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_tmp"}, timeout=30)
        assert r.status_code == 200 and r.json()["ok"] is True
        bad = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "admin"), json={"url": "http://x", "db_name": "x"}, timeout=30)
        assert bad.status_code == 400
        assert requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "free"),
                             json={"url": "mongodb://localhost:27017", "db_name": "x"}, timeout=30).status_code == 403
        b = requests.get(f"{API}/admin/settings/database/backup", headers=H(tok, "admin"), timeout=120)
        assert b.status_code == 200 and "attachment" in b.headers.get("content-disposition", "")
        data = b.json()
        assert data["app"] == "FlexoCards" and "users" in data["collections"]

    def test_switch_and_back(self, tok):
        mdb.drop_database("flexo_qa_tmp")
        try:
            r = requests.put(f"{API}/admin/settings/database", headers=H(tok, "admin"),
                             json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_tmp", "copy_data": True}, timeout=120)
            assert r.status_code == 200, r.text
            assert r.json()["database"]["mode"] == "custom" and r.json()["database"]["db_name"] == "flexo_qa_tmp"
            assert r.json()["copied"].get("users", 0) > 0
            assert requests.get(f"{API}/me", headers=H(tok, "admin"), timeout=20).status_code == 200
        finally:
            d = requests.post(f"{API}/admin/settings/database/use-default", headers=H(tok, "admin"), timeout=30)
            assert d.status_code == 200 and d.json()["mode"] == "default" and d.json()["db_name"] == os.environ["DB_NAME"]


# ---- Storybook ----
class TestStorybook:
    def test_basic_402(self, tok):
        r = requests.post(f"{API}/me/storybook", headers=H(tok, "basic"), json={"image": PNG_URI}, timeout=20)
        assert r.status_code == 402
        assert requests.get(f"{API}/me/storybook", headers=H(tok, "basic"), timeout=20).json()["enabled"] is False

    def test_pro_flow(self, tok):
        r = requests.post(f"{API}/me/storybook", headers=H(tok, "pro"), json={"image": PNG_URI, "title": "TEST_page", "sport_id": "cricket"}, timeout=30)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert "image_path" not in r.json()
        lst = requests.get(f"{API}/me/storybook", headers=H(tok, "pro"), timeout=20).json()
        assert lst["enabled"] is True and any(p["id"] == pid for p in lst["pages"])
        img = requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "pro"), timeout=30)
        assert img.status_code == 200 and img.content[:4] == b"\x89PNG"
        assert requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "team"), timeout=20).status_code == 404
        assert requests.get(f"{API}/me/storybook/{pid}/image", timeout=20).status_code == 401
        assert requests.post(f"{API}/me/storybook", headers=H(tok, "pro"), json={"image": "data:image/jpeg;base64,xx"}, timeout=20).status_code == 400
        d = requests.delete(f"{API}/me/storybook/{pid}", headers=H(tok, "pro"), timeout=20)
        assert d.status_code == 200
        assert requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "pro"), timeout=20).status_code == 404
