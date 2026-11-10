# FlexoCards: admin settings (razorpay/email), email test, 6h edit window, share/unshare, RBAC on settings
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
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()
KEY_ID = os.environ.get("RAZORPAY_KEY_ID")


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(tok):
    yield
    requests.delete(f"{API}/admin/settings/email", headers=H(tok, "admin"), timeout=20)
    requests.delete(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), timeout=20)
    db.saved_cards.delete_many({"title": {"$regex": "^TEST_"}})
    db.users.update_one({"email": "qa.basic+clerk_test@example.com"}, {"$set": {"role": "user", "permissions": None}})


# RBAC
def test_settings_forbidden_for_users(tok):
    for role in ("free", "pro"):
        r = requests.get(f"{API}/admin/settings", headers=H(tok, role), timeout=20)
        assert r.status_code == 403, (role, r.status_code, r.text)


def test_settings_forbidden_for_non_super_admin(tok):
    db.users.update_one({"email": "qa.basic+clerk_test@example.com"}, {"$set": {"role": "admin", "permissions": None}})
    try:
        r = requests.get(f"{API}/admin/settings", headers=H(tok, "basic"), timeout=20)
        assert r.status_code == 403, r.text
        r2 = requests.get(f"{API}/admin/blog/posts", headers=H(tok, "basic"), timeout=20)
        assert r2.status_code == 200, r2.text  # admin has blog.manage
    finally:
        db.users.update_one({"email": "qa.basic+clerk_test@example.com"}, {"$set": {"role": "user", "permissions": None}})


# Razorpay settings
def test_get_settings(tok):
    r = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["razorpay"]["key_id"].startswith("rzp_test_")
    assert d["razorpay"]["mode"] == "test"
    assert d["razorpay"]["key_secret_hint"].startswith("••••")
    assert d["razorpay"]["webhook_url"].endswith("/api/billing/webhook")
    e = d["email"]
    assert e["smtp_host"] == "smtp.hostinger.com" and e["smtp_port"] == 465 and e["smtp_secure"] == "ssl"
    assert e["smtp_from_email"] == "noreply@cricanalyze.in"
    assert "smtp_pass" not in e and e["smtp_pass_hint"]
    assert isinstance(d["email_log"], list)


def test_razorpay_invalid_keys(tok):
    r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), timeout=30,
                     json={"key_id": "rzp_test_INVALID123456", "key_secret": "wrongsecret"})
    assert r.status_code == 400
    assert "Razorpay rejected these keys" in r.json()["detail"]


def test_razorpay_bad_format(tok):
    r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), timeout=30, json={"key_id": "abc", "key_secret": "x"})
    assert r.status_code == 422


def test_razorpay_save_valid_then_reset(tok):
    r = requests.put(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), timeout=30, json={"key_id": KEY_ID, "key_secret": ""})
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "admin"
    cfg = requests.get(f"{API}/billing/config", timeout=20).json()
    assert cfg["enabled"] is True and cfg["key_id"] == KEY_ID
    co = requests.post(f"{API}/billing/checkout", headers=H(tok, "free"), json={"plan_id": "basic", "cycle": "month"}, timeout=30)
    assert co.status_code == 200, co.text
    assert co.json()["order_id"].startswith("order_")
    rs = requests.delete(f"{API}/admin/settings/razorpay", headers=H(tok, "admin"), timeout=20)
    assert rs.status_code == 200 and rs.json()["razorpay"]["source"] == "server"
    assert requests.get(f"{API}/billing/config", timeout=20).json()["enabled"] is True


# Email settings
def test_email_emergent_test(tok):
    requests.delete(f"{API}/admin/settings/email", headers=H(tok, "admin"), timeout=20)
    r = requests.post(f"{API}/admin/settings/email/test", headers=H(tok, "admin"), timeout=60)
    assert r.status_code == 200, r.text
    assert r.json()["provider"] == "emergent"
    logs = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20).json()["email_log"]
    assert logs[0]["kind"] == "test" and logs[0]["status"] == "sent"


def test_email_smtp_switch_and_test_fails_readable(tok):
    cur = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=20).json()["email"]
    body = {k: cur[k] for k in ("from_name", "reply_to", "site_url", "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_from_email", "smtp_from_name")}
    body.update(provider="smtp", smtp_pass="")
    r = requests.put(f"{API}/admin/settings/email", headers=H(tok, "admin"), json=body, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["provider"] == "smtp" and r.json()["customized"] is True
    t = requests.post(f"{API}/admin/settings/email/test", headers=H(tok, "admin"), timeout=60)
    assert t.status_code == 400
    assert "Test email failed" in t.json()["detail"]
    print("SMTP test detail:", t.json()["detail"])
    rs = requests.delete(f"{API}/admin/settings/email", headers=H(tok, "admin"), timeout=20)
    assert rs.status_code == 200 and rs.json()["email"]["provider"] == "emergent"


def test_email_validation(tok):
    r = requests.put(f"{API}/admin/settings/email", headers=H(tok, "admin"), timeout=20,
                     json={"provider": "smtp", "from_name": "FlexoCards", "site_url": "http://insecure.com"})
    assert r.status_code == 422


def test_unknown_settings_section(tok):
    assert requests.delete(f"{API}/admin/settings/foo", headers=H(tok, "admin"), timeout=20).status_code == 404


# 6h edit window
def test_pro_card_window_closed_after_7h(tok):
    body = {"title": "TEST_window", "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST"}}
    c = requests.post(f"{API}/me/cards", headers=H(tok, "pro"), json=body, timeout=20).json()
    assert c["editable"] is True and c["lock_reason"] == ""
    assert requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json=body, timeout=20).status_code == 200
    old = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
    db.saved_cards.update_one({"id": c["id"]}, {"$set": {"created_at": old}})
    r = requests.put(f"{API}/me/cards/{c['id']}", headers=H(tok, "pro"), json=body, timeout=20)
    assert r.status_code == 403
    lst = requests.get(f"{API}/me/cards", headers=H(tok, "pro"), timeout=20).json()
    me = [x for x in lst if x["id"] == c["id"]][0]
    assert me["editable"] is False and me["lock_reason"] == "window_closed"


def test_basic_team_editable(tok):
    body = {"title": "TEST_bt", "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST"}}
    for role in ("basic", "team"):
        r = requests.post(f"{API}/me/cards", headers=H(tok, role), json=body, timeout=20)
        assert r.status_code == 200, (role, r.text)
        assert r.json()["editable"] is True


def test_share_unshare_cycle(tok):
    body = {"title": "TEST_share", "sport_id": "cricket", "template_id": "classic", "data": {"name": "TEST"}}
    c = requests.post(f"{API}/me/cards", headers=H(tok, "pro"), json=body, timeout=20).json()
    s = requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), json={"image": PNG_URI}, timeout=60)
    assert s.status_code == 200, s.text
    sid = s.json()["share_id"]
    v = requests.get(f"{API}/share/{sid}", timeout=20)
    assert v.status_code == 200 and v.json()["image_url"].startswith("/api/files/")
    img = requests.get(BASE_URL + v.json()["image_url"], timeout=30)
    assert img.status_code == 200 and img.headers["content-type"].startswith("image/png")
    assert requests.delete(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), timeout=20).status_code == 200
    assert requests.get(f"{API}/share/{sid}", timeout=20).status_code == 404
    bad = requests.post(f"{API}/me/cards/{c['id']}/share", headers=H(tok, "pro"), json={"image": "data:image/jpeg;base64,xx"}, timeout=20)
    assert bad.status_code == 400
