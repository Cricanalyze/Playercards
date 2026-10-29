# FlexoCards iter3: blog workflow, card edit/share rules, settings (social/email/razorpay/site mode/database), storybook, RBAC
# Run serially: pytest tests/test_flexocards_iter3.py -n 0  (mutates global site settings, restores at end)
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
mc = MongoClient(os.environ["MONGO_URL"])
db = mc[os.environ["DB_NAME"]]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()
LIVE = {"cs_enabled": False, "mt_enabled": False, "cs_auto_open": True, "mt_duration_min": 60}


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module", autouse=True)
def restore(tok):
    yield
    a = H(tok, "admin")
    requests.put(f"{API}/admin/settings/site", headers=a, json=LIVE, timeout=20)
    requests.post(f"{API}/admin/settings/database/use-default", headers=a, timeout=20)
    requests.delete(f"{API}/admin/settings/email", headers=a, timeout=20)
    requests.put(f"{API}/admin/settings/social", headers=a, json={}, timeout=20)
    db.blog_posts.delete_many({"title": {"$regex": "^TEST_"}})
    db.saved_cards.delete_many({"title": {"$regex": "^TEST_"}})
    db.users.update_one({"email": "qa.basic+clerk_test@example.com"}, {"$set": {"can_blog": False}})
    mc.drop_database("flexo_qa_test")


# ---- blog ----
class TestBlog:
    def test_basic_cannot_write_before_grant(self, tok):
        db.users.update_one({"email": "qa.basic+clerk_test@example.com"}, {"$set": {"can_blog": False}})
        r = requests.get(f"{API}/me/posts", headers=H(tok, "basic"), timeout=20)
        assert r.status_code in (401, 403), r.text

    def test_admin_publish_and_public(self, tok):
        r = requests.post(f"{API}/me/posts", headers=H(tok, "admin"), json={"title": "TEST_Admin Post", "excerpt": "ex", "content": "# Hello\n\n**bold** text", "category": "Guides", "tags": ["qa"], "status": "published"}, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "published" and p["slug"]
        lst = requests.get(f"{API}/blog", timeout=20).json()
        assert any(x["id"] == p["id"] for x in lst["posts"])
        one = requests.get(f"{API}/blog/{p['slug']}", timeout=20)
        assert one.status_code == 200 and one.json()["post"]["content"].startswith("# Hello")

    def test_author_grant_submit_review_publish(self, tok):
        a = H(tok, "admin")
        r = requests.post(f"{API}/admin/blog/authors", headers=a, json={"email": "qa.basic+clerk_test@example.com"}, timeout=20)
        assert r.status_code == 200, r.text
        uid = r.json()["user_id"]
        assert any(x["user_id"] == uid for x in requests.get(f"{API}/admin/blog/authors", headers=a, timeout=20).json())
        r = requests.post(f"{API}/me/posts", headers=H(tok, "basic"), json={"title": "TEST_Author Post", "excerpt": "e", "content": "body text", "category": "News", "tags": [], "status": "published"}, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "pending"  # author cannot self-publish
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
        pend = requests.get(f"{API}/admin/blog/posts?status=pending", headers=a, timeout=20).json()
        assert any(x["id"] == p["id"] for x in pend)
        assert requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=a, json={"status": "published"}, timeout=20).status_code == 200
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 200
        # non-admin cannot moderate
        assert requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", headers=H(tok, "basic"), json={"status": "draft"}, timeout=20).status_code in (401, 403)
        # remove author
        assert requests.delete(f"{API}/admin/blog/authors/{uid}", headers=a, timeout=20).status_code == 200
        assert requests.get(f"{API}/me/posts", headers=H(tok, "basic"), timeout=20).status_code in (401, 403)

    def test_add_unknown_author_404(self, tok):
        r = requests.post(f"{API}/admin/blog/authors", headers=H(tok, "admin"), json={"email": "nobody_x@example.com"}, timeout=20)
        assert r.status_code == 404


# ---- cards edit + share ----
class TestCards:
    def _mk(self, tok, role):
        sp = requests.get(f"{API}/sports", timeout=20).json()
        s = sp[0] if isinstance(sp, list) else sp["sports"][0]
        tp = requests.get(f"{API}/templates", timeout=20).json()
        t = tp[0] if isinstance(tp, list) else tp["templates"][0]
        r = requests.post(f"{API}/me/cards", headers=H(tok, role), json={"title": f"TEST_{role}", "sport_id": s["id"], "template_id": t["id"], "data": {"name": "X"}}, timeout=20)
        assert r.status_code == 200, r.text
        return r.json(), s, t

    def test_free_edit_402_and_share_402(self, tok):
        c, s, t = self._mk(tok, "free")
        assert c["editable"] is False and c["lock_reason"] == "free_plan"
        r = requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "free"), json={"title": "TEST_free2", "sport_id": s["id"], "template_id": t["id"], "data": {}}, timeout=20)
        assert r.status_code == 402, r.text
        r = requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "free"), json={"image": PNG_URI}, timeout=20)
        assert r.status_code == 402, r.text

    def test_pro_edit_and_share(self, tok):
        c, s, t = self._mk(tok, "pro")
        assert c["editable"] is True and c["editable_until"]
        r = requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json={"title": "TEST_pro2", "sport_id": s["id"], "template_id": t["id"], "data": {}}, timeout=20)
        assert r.status_code == 200
        r = requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), json={"image": PNG_URI}, timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["share_id"]
        v = requests.get(f"{API}/share/{sid}", timeout=20)
        assert v.status_code == 200
        img = requests.get(BASE_URL + v.json()["image_url"], timeout=20)
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/png")
        assert requests.delete(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), timeout=20).status_code == 200
        assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404

    def test_pro_window_closed_403(self, tok):
        c, s, t = self._mk(tok, "pro")
        db.saved_cards.update_one({"id": c["id"]}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()}})
        r = requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json={"title": "TEST_pro3", "sport_id": s["id"], "template_id": t["id"], "data": {}}, timeout=20)
        assert r.status_code == 403


# ---- settings ----
class TestSettings:
    def test_rbac(self, tok):
        assert requests.get(f"{API}/admin/settings", headers=H(tok, "free"), timeout=20).status_code in (401, 403)
        r = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("razorpay", "email", "database", "site", "social", "templates", "clerk"):
            assert k in d

    def test_templates_preview(self, tok):
        a = H(tok, "admin")
        tpls = requests.get(f"{API}/admin/settings", headers=a, timeout=20).json()["templates"]
        assert len(tpls) > 3
        for t in tpls:
            r = requests.get(f"{API}/admin/settings/email/preview/{t['id']}", headers=a, timeout=20)
            assert r.status_code == 200 and r.json()["subject"] and "FlexoCards" in r.json()["html"], t

    def test_social(self, tok):
        a = H(tok, "admin")
        assert requests.put(f"{API}/admin/settings/social", headers=a, json={"instagram": "http://insta.com/x"}, timeout=20).status_code == 422
        r = requests.put(f"{API}/admin/settings/social", headers=a, json={"instagram": "https://instagram.com/flexo", "x": "https://x.com/flexo"}, timeout=20)
        assert r.status_code == 200
        pub = requests.get(f"{API}/site/social", timeout=20).json()
        assert pub == {"instagram": "https://instagram.com/flexo", "x": "https://x.com/flexo"}
        requests.put(f"{API}/admin/settings/social", headers=a, json={}, timeout=20)
        assert requests.get(f"{API}/site/social", timeout=20).json() == {}

    def test_razorpay_invalid(self, tok):
        r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), json={"key_id": "rzp_test_INVALIDKEY123", "key_secret": "badsecret123"}, timeout=30)
        assert r.status_code == 400 and "Razorpay rejected these keys" in r.text

    def test_email_emergent_test_send(self, tok):
        a = H(tok, "admin")
        requests.delete(f"{API}/admin/settings/email", headers=a, timeout=20)
        r = requests.post(f"{API}/admin/settings/email/test", headers=a, timeout=60)
        print("emergent test email:", r.status_code, r.text[:300])
        assert r.status_code == 200, r.text

    def test_email_smtp_requires_fields(self, tok):
        r = requests.put(f"{API}/admin/settings/email", headers=H(tok, "admin"), json={"provider": "smtp", "from_name": "FlexoCards", "smtp_host": ""}, timeout=20)
        assert r.status_code == 400


class TestSiteMode:
    def test_coming_soon_gate(self, tok):
        a = H(tok, "admin")
        launch = iso(datetime.now(timezone.utc) + timedelta(days=2))
        r = requests.put(f"{API}/admin/settings/site", headers=a, json={**LIVE, "cs_enabled": True, "cs_launch_at": launch}, timeout=20)
        assert r.status_code == 200 and r.json()["status"]["state"] == "coming_soon"
        time.sleep(1)
        assert requests.get(f"{API}/sports", timeout=20).status_code == 423
        assert requests.get(f"{API}/sports", headers=H(tok, "free"), timeout=20).status_code == 423
        assert requests.get(f"{API}/sports", headers=a, timeout=20).status_code == 200
        assert requests.get(f"{API}/site/status", timeout=20).json()["state"] == "coming_soon"

    def test_maintenance_now_then_live(self, tok):
        a = H(tok, "admin")
        start = iso(datetime.now(timezone.utc) - timedelta(seconds=5))
        r = requests.put(f"{API}/admin/settings/site", headers=a, json={**LIVE, "mt_enabled": True, "mt_start_at": start, "mt_duration_min": 30}, timeout=20)
        assert r.json()["status"]["state"] == "maintenance"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 423
        r = requests.put(f"{API}/admin/settings/site", headers=a, json=LIVE, timeout=20)
        assert r.json()["status"]["state"] == "live"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200

    def test_maintenance_scheduled(self, tok):
        a = H(tok, "admin")
        start = iso(datetime.now(timezone.utc) + timedelta(hours=1))
        r = requests.put(f"{API}/admin/settings/site", headers=a, json={**LIVE, "mt_enabled": True, "mt_start_at": start, "mt_duration_min": 60}, timeout=20)
        assert r.json()["status"]["state"] == "maintenance_scheduled"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200
        requests.put(f"{API}/admin/settings/site", headers=a, json=LIVE, timeout=20)

    def test_validation(self, tok):
        r = requests.put(f"{API}/admin/settings/site", headers=H(tok, "admin"), json={**LIVE, "mt_enabled": True}, timeout=20)
        assert r.status_code == 400


class TestDatabase:
    def test_db_flow(self, tok):
        a = H(tok, "admin")
        bad = requests.post(f"{API}/admin/settings/database/test", headers=a, json={"url": "http://bad", "db_name": "x"}, timeout=30)
        assert bad.status_code == 400
        ok = requests.post(f"{API}/admin/settings/database/test", headers=a, json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_test"}, timeout=30)
        assert ok.status_code == 200 and ok.json()["ok"]
        sw = requests.put(f"{API}/admin/settings/database", headers=a, json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_test", "copy_data": True}, timeout=120)
        assert sw.status_code == 200, sw.text
        assert sw.json()["database"]["db_name"] == "flexo_qa_test"
        assert requests.get(f"{API}/me", headers=H(tok, "pro"), timeout=20).status_code == 200
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200
        d = requests.post(f"{API}/admin/settings/database/use-default", headers=a, timeout=30)
        assert d.status_code == 200 and d.json()["db_name"] == os.environ["DB_NAME"] and d.json()["mode"] != "custom"
        b = requests.get(f"{API}/admin/settings/database/backup", headers=a, timeout=120)
        assert b.status_code == 200 and "attachment" in b.headers.get("content-disposition", "")
        assert json.loads(b.text)["app"] == "FlexoCards"


class TestStorybook:
    def test_basic_blocked_pro_ok(self, tok):
        assert requests.get(f"{API}/me/storybook", headers=H(tok, "basic"), timeout=20).json()["enabled"] is False
        assert requests.post(f"{API}/me/storybook", headers=H(tok, "basic"), json={"image": PNG_URI}, timeout=20).status_code == 402
        r = requests.get(f"{API}/me/storybook", headers=H(tok, "pro"), timeout=20).json()
        assert r["enabled"] is True and len(r["pages"]) >= 3
        img = requests.get(f"{API}/me/storybook/{r['pages'][0]['id']}/image", headers=H(tok, "pro"), timeout=20)
        assert img.status_code == 200 and img.headers["content-type"] == "image/png"
        # other user cannot read
        assert requests.get(f"{API}/me/storybook/{r['pages'][0]['id']}/image", headers=H(tok, "team"), timeout=20).status_code == 404

    def test_add_and_delete_page(self, tok):
        r = requests.post(f"{API}/me/storybook", headers=H(tok, "pro"), json={"image": PNG_URI, "title": "TEST_page"}, timeout=30)
        assert r.status_code == 200, r.text
        assert requests.delete(f"{API}/me/storybook/{r.json()['id']}", headers=H(tok, "pro"), timeout=20).status_code == 200


class TestClerkWebhook:
    def test_not_connected(self):
        r = requests.post(f"{API}/clerk/webhook", data="{}", timeout=20)
        print("webhook unconfigured:", r.status_code)
        assert r.status_code in (400, 401, 503)
