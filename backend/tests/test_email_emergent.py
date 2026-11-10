# Emergent managed email: admin settings, test send, email log, template previews + smoke regressions
import json
import os
import subprocess

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")


@pytest.fixture(scope="module")
def admin():
    out = subprocess.run(["python3", "qa_users.py", "tokens"], cwd="/app/backend", capture_output=True, text=True, timeout=90).stdout
    tok = json.loads(out.strip().splitlines()[-1]).get("admin")
    if not tok:
        pytest.skip("no admin token")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {tok}"
    return s


# Smoke / regressions
def test_health():
    r = requests.get(f"{BASE_URL}/api/", timeout=20)
    assert r.status_code == 200


def test_store():
    r = requests.get(f"{BASE_URL}/api/store", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_home():
    r = requests.get(BASE_URL + "/", timeout=20)
    assert r.status_code == 200 and "<div id=\"root\"" in r.text


# Admin email settings
def test_settings_provider_emergent(admin):
    r = admin.get(f"{BASE_URL}/api/admin/settings", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["email"]["provider"] == "emergent"
    assert "smtp_pass" not in d["email"]
    assert isinstance(d["email_log"], list)
    ids = [t["id"] for t in d["templates"]]
    assert "welcome" in ids
    print("templates:", ids)


def test_settings_requires_auth():
    assert requests.get(f"{BASE_URL}/api/admin/settings", timeout=20).status_code in (401, 403)
    assert requests.post(f"{BASE_URL}/api/admin/settings/email/test", timeout=20).status_code in (401, 403)


def test_send_test_email_and_log(admin):
    r = admin.post(f"{BASE_URL}/api/admin/settings/email/test", timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True and d["provider"] == "emergent"
    assert d["to"].startswith("qa.admin")
    logs = admin.get(f"{BASE_URL}/api/admin/settings", timeout=30).json()["email_log"]
    top = logs[0]
    assert top["kind"] == "test" and top["status"] == "sent" and top["provider"] == "emergent", top
    assert "_id" not in top


def test_previews_render(admin):
    tpls = admin.get(f"{BASE_URL}/api/admin/settings", timeout=30).json()["templates"]
    for t in tpls:
        r = admin.get(f"{BASE_URL}/api/admin/settings/email/preview/{t['id']}", timeout=30)
        assert r.status_code == 200, (t, r.text)
        j = r.json()
        assert j["subject"] and "<table" in j["html"], t


def test_preview_unknown_404(admin):
    assert admin.get(f"{BASE_URL}/api/admin/settings/email/preview/nope", timeout=20).status_code == 404


def test_send_sample_storybook(admin):
    tpls = [t["id"] for t in admin.get(f"{BASE_URL}/api/admin/settings", timeout=30).json()["templates"]]
    tid = next((t for t in tpls if "storybook" in t), "welcome")
    r = admin.post(f"{BASE_URL}/api/admin/settings/email/preview/{tid}/send", timeout=60)
    assert r.status_code == 200, r.text
    logs = admin.get(f"{BASE_URL}/api/admin/settings", timeout=30).json()["email_log"]
    assert logs[0]["kind"] == f"sample:{tid}" and logs[0]["status"] == "sent", logs[0]
