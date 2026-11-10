# FlexoCards feature regression: settings RBAC, templates, social, site gate, database, blog flow, share/storybook plan gating
import json
import os
import subprocess
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
PNG_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def tok():
    if os.path.exists("/tmp/tok.json") and time.time() - os.path.getmtime("/tmp/tok.json") < 2400:
        return json.load(open("/tmp/tok.json"))
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120, cwd="/app/backend").stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


LIVE_SITE = {"cs_enabled": False, "cs_launch_at": "", "cs_auto_open": True, "mt_enabled": False, "mt_start_at": "", "mt_duration_min": 60}


@pytest.fixture(scope="module", autouse=True)
def restore(tok):
    yield
    a = H(tok, "admin")
    requests.put(f"{API}/admin/settings/site", json=LIVE_SITE, headers=a, timeout=20)
    requests.put(f"{API}/admin/settings/social", json={}, headers=a, timeout=20)
    for p in requests.get(f"{API}/admin/blog/posts", headers=a, timeout=20).json():
        if p["title"].startswith("TEST_"):
            requests.delete(f"{API}/me/posts/{p['id']}", headers=a, timeout=20)


# --- settings RBAC + load
def test_settings_rbac(tok):
    for role in ("free", "basic", "pro"):
        assert requests.get(f"{API}/admin/settings", headers=H(tok, role), timeout=20).status_code == 403
    assert requests.get(f"{API}/admin/settings", timeout=20).status_code in (401, 403)


def test_settings_load_admin(tok):
    r = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("razorpay", "email", "email_log", "clerk", "database", "site", "site_status", "social", "templates"):
        assert k in d
    assert d["email"]["provider"] == "emergent"
    assert d["database"]["db_name"] == "test_database"
    assert "smtp_pass" not in d["email"]


def test_template_previews(tok):
    d = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30).json()
    ids = [t["id"] for t in d["templates"]]
    assert "verification_code" in ids
    for tid in ids:
        r = requests.get(f"{API}/admin/settings/email/preview/{tid}", headers=H(tok, "admin"), timeout=20)
        assert r.status_code == 200, tid
        assert "<html" in r.json()["html"].lower() or "<table" in r.json()["html"].lower()
        assert "RivalCard" not in r.json()["html"]
    r = requests.get(f"{API}/admin/settings/email/preview/verification_code", headers=H(tok, "admin"), timeout=20).json()
    assert "424242" in r["html"]
    assert requests.get(f"{API}/admin/settings/email/preview/nope", headers=H(tok, "admin"), timeout=20).status_code == 404


def test_smtp_requires_fields(tok):
    r = requests.put(f"{API}/admin/settings/email", json={"provider": "smtp", "from_name": "FlexoCards", "smtp_host": ""},
                     headers=H(tok, "admin"), timeout=20)
    assert r.status_code in (400, 422)


# --- social
def test_social_save_validate_clear(tok):
    a = H(tok, "admin")
    assert requests.put(f"{API}/admin/settings/social", json={"instagram": "http://insecure.com/x"}, headers=a, timeout=20).status_code == 422
    r = requests.put(f"{API}/admin/settings/social", json={"instagram": "https://instagram.com/TEST_flexo"}, headers=a, timeout=20)
    assert r.status_code == 200
    assert requests.get(f"{API}/site/social", timeout=20).json() == {"instagram": "https://instagram.com/TEST_flexo"}
    requests.put(f"{API}/admin/settings/social", json={}, headers=a, timeout=20)
    assert requests.get(f"{API}/site/social", timeout=20).json() == {}


# --- site gate
def test_site_coming_soon_and_maintenance(tok):
    a = H(tok, "admin")
    fut = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    try:
        r = requests.put(f"{API}/admin/settings/site", json={**LIVE_SITE, "cs_enabled": True, "cs_launch_at": fut}, headers=a, timeout=20)
        assert r.status_code == 200 and r.json()["status"]["state"] == "coming_soon"
        r = requests.get(f"{API}/sports", timeout=20)
        assert r.status_code == 423 and r.json()["site_state"] == "coming_soon"
        assert requests.get(f"{API}/sports", headers=a, timeout=20).status_code == 200
        assert requests.get(f"{API}/sports", headers=H(tok, "free"), timeout=20).status_code == 423
        assert requests.get(f"{API}/site/status", timeout=20).json()["blocked"] is True
        # maintenance now
        now_ = datetime.now(timezone.utc).isoformat()
        r = requests.put(f"{API}/admin/settings/site", json={**LIVE_SITE, "mt_enabled": True, "mt_start_at": now_, "mt_duration_min": 30}, headers=a, timeout=20)
        assert r.json()["status"]["state"] == "maintenance"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 423
        # scheduled maintenance
        r = requests.put(f"{API}/admin/settings/site", json={**LIVE_SITE, "mt_enabled": True, "mt_start_at": fut, "mt_duration_min": 60}, headers=a, timeout=20)
        assert r.json()["status"]["state"] == "maintenance_scheduled"
        assert requests.get(f"{API}/sports", timeout=20).status_code == 200
        # validation
        assert requests.put(f"{API}/admin/settings/site", json={**LIVE_SITE, "mt_enabled": True}, headers=a, timeout=20).status_code == 400
        assert requests.put(f"{API}/admin/settings/site", json={**LIVE_SITE, "cs_enabled": True}, headers=a, timeout=20).status_code == 400
        assert requests.put(f"{API}/admin/settings/site", json=LIVE_SITE, headers=H(tok, "free"), timeout=20).status_code == 403
    finally:
        requests.put(f"{API}/admin/settings/site", json=LIVE_SITE, headers=a, timeout=20)
    assert requests.get(f"{API}/site/status", timeout=20).json()["state"] == "live"


# --- database
def test_db_test_connection(tok):
    a = H(tok, "admin")
    r = requests.post(f"{API}/admin/settings/database/test", json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_tmp"}, headers=a, timeout=40)
    assert r.status_code == 200 and r.json()["ok"] is True
    r = requests.post(f"{API}/admin/settings/database/test", json={"url": "http://bad", "db_name": "x"}, headers=a, timeout=40)
    assert r.status_code == 400
    r = requests.post(f"{API}/admin/settings/database/test", json={"url": "mongodb://nonexistent-host-qa:27017", "db_name": "x"}, headers=a, timeout=60)
    assert r.status_code == 400, r.text
    assert requests.post(f"{API}/admin/settings/database/test", json={"url": "mongodb://localhost:27017", "db_name": "x"},
                         headers=H(tok, "pro"), timeout=20).status_code == 403


def test_db_backup(tok):
    r = requests.get(f"{API}/admin/settings/database/backup", headers=H(tok, "admin"), timeout=90)
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")
    d = r.json()
    assert d["app"] == "FlexoCards" and "users" in d["collections"]


# --- blog flow
def test_blog_full_flow(tok):
    a, b = H(tok, "admin"), H(tok, "basic")
    r = requests.post(f"{API}/me/posts", json={"title": "TEST_ Admin Post", "content": "# Hello\n\n**bold** text", "status": "published"}, headers=a, timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "published"
    slug = r.json()["slug"]
    assert requests.get(f"{API}/blog/{slug}", timeout=20).json()["post"]["title"] == "TEST_ Admin Post"
    assert any(p["slug"] == slug for p in requests.get(f"{API}/blog", timeout=20).json()["posts"])
    # grant basic
    basic_email = "qa.basic+clerk_test@example.com"
    r = requests.post(f"{API}/admin/blog/authors", json={"email": basic_email}, headers=a, timeout=20)
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    try:
        r = requests.post(f"{API}/me/posts", json={"title": "TEST_ Basic Post", "content": "hi", "status": "published", "featured": True}, headers=b, timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "pending" and r.json()["featured"] is False
        pid = r.json()["id"]
        assert requests.get(f"{API}/blog/{r.json()['slug']}", timeout=20).status_code == 404
        assert requests.patch(f"{API}/admin/blog/posts/{pid}/status", json={"status": "published"}, headers=b, timeout=20).status_code == 403
        assert requests.patch(f"{API}/admin/blog/posts/{pid}/status", json={"status": "published"}, headers=a, timeout=20).status_code == 200
        assert requests.get(f"{API}/blog/{r.json()['slug']}", timeout=20).status_code == 200
        assert requests.delete(f"{API}/me/posts/{pid}", headers=b, timeout=20).status_code == 200
    finally:
        requests.delete(f"{API}/admin/blog/authors/{uid}", headers=a, timeout=20)
    assert requests.get(f"{API}/me/posts", headers=b, timeout=20).status_code == 403
    assert requests.get(f"{API}/me/posts", headers=H(tok, "free"), timeout=20).status_code == 403


def test_blog_add_unknown_author(tok):
    r = requests.post(f"{API}/admin/blog/authors", json={"email": "nobody_TEST@example.com"}, headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 404


# --- cards share/edit + storybook gating
def _mk_card(tok, role):
    r = requests.post(f"{API}/me/cards", json={"title": "TEST_ card", "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST"}},
                      headers=H(tok, role), timeout=20)
    return r


def test_free_cannot_edit_or_share(tok):
    r = _mk_card(tok, "free")
    if r.status_code == 402:
        pytest.skip("free saved-card limit reached")
    assert r.status_code == 200 and r.json()["editable"] is False and r.json()["lock_reason"] == "free_plan"
    cid = r.json()["id"]
    try:
        u = requests.put(f"{API}/me/cards/{cid}", json={"title": "x", "sport_id": "cricket", "template_id": "classic", "data": {}}, headers=H(tok, "free"), timeout=20)
        assert u.status_code == 402
        s = requests.post(f"{API}/me/cards/{cid}/share", json={"image": PNG_URI}, headers=H(tok, "free"), timeout=20)
        assert s.status_code == 402
    finally:
        requests.delete(f"{API}/me/cards/{cid}", headers=H(tok, "free"), timeout=20)


def test_pro_edit_share_unshare(tok):
    p = H(tok, "pro")
    r = _mk_card(tok, "pro")
    assert r.status_code == 200 and r.json()["editable"] is True
    cid = r.json()["id"]
    try:
        assert requests.put(f"{API}/me/cards/{cid}", json={"title": "TEST_ edited", "sport_id": "cricket", "template_id": "classic", "data": {}}, headers=p, timeout=20).status_code == 200
        s = requests.post(f"{API}/me/cards/{cid}/share", json={"image": PNG_URI}, headers=p, timeout=30)
        assert s.status_code == 200
        sid = s.json()["share_id"]
        v = requests.get(f"{API}/share/{sid}", timeout=20)
        assert v.status_code == 200 and v.json()["title"] == "TEST_ edited"
        assert requests.get(BASE_URL + v.json()["image_url"], timeout=20).status_code == 200
        assert requests.delete(f"{API}/me/cards/{cid}/share", headers=p, timeout=20).status_code == 200
        assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
    finally:
        requests.delete(f"{API}/me/cards/{cid}", headers=p, timeout=20)


def test_storybook_gating(tok):
    r = requests.get(f"{API}/me/storybook", headers=H(tok, "pro"), timeout=20).json()
    assert r["enabled"] is True
    titles = [p["title"] for p in r["pages"]]
    assert len(titles) >= 3, titles
    img = requests.get(f"{API}/me/storybook/{r['pages'][0]['id']}/image", headers=H(tok, "pro"), timeout=20)
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"
    assert requests.get(f"{API}/me/storybook/{r['pages'][0]['id']}/image", headers=H(tok, "team"), timeout=20).status_code == 404
    assert requests.get(f"{API}/me/storybook", headers=H(tok, "basic"), timeout=20).json()["enabled"] is False
    assert requests.post(f"{API}/me/storybook", json={"image": PNG_URI}, headers=H(tok, "basic"), timeout=20).status_code == 402


def test_storybook_add_delete_pro(tok):
    p = H(tok, "pro")
    r = requests.post(f"{API}/me/storybook", json={"image": PNG_URI, "title": "TEST_ page"}, headers=p, timeout=30)
    assert r.status_code == 200
    pid = r.json()["id"]
    assert requests.delete(f"{API}/me/storybook/{pid}", headers=p, timeout=20).status_code == 200
    assert requests.delete(f"{API}/me/storybook/{pid}", headers=p, timeout=20).status_code == 404
    assert requests.post(f"{API}/me/storybook", json={"image": "data:image/jpeg;base64,AAA"}, headers=p, timeout=20).status_code == 400


def test_anonymous_card_ops_require_auth():
    assert requests.get(f"{API}/me/cards", timeout=20).status_code == 401
    assert requests.post(f"{API}/cards/export", json={}, timeout=20).status_code in (401, 422)
