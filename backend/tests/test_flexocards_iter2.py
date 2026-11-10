# FlexoCards iter2: storybook (pro/team only), database settings (test/backup/switch/default), clerk webhook 503, social validation
import base64
import json
import os
import subprocess

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
DB_NAME = os.environ["DB_NAME"]
db = MongoClient(os.environ["MONGO_URL"])[DB_NAME]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URI = "data:image/png;base64," + base64.b64encode(PNG).decode()


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(tok):
    yield
    requests.post(f"{API}/admin/settings/database/use-default", headers=H(tok, "admin"), timeout=30)
    requests.delete(f"{API}/admin/settings/social", headers=H(tok, "admin"), timeout=20)
    db.storybook_pages.delete_many({"title": {"$regex": "^TEST_"}})


# ---- storybook
def test_storybook_basic_402(tok):
    r = requests.post(f"{API}/me/storybook", headers=H(tok, "basic"), json={"image": PNG_URI, "title": "TEST_sb"}, timeout=30)
    assert r.status_code == 402, r.text
    g = requests.get(f"{API}/me/storybook", headers=H(tok, "basic"), timeout=20)
    assert g.status_code == 200 and g.json()["enabled"] is False


def test_storybook_pro_crud(tok):
    r = requests.post(f"{API}/me/storybook", headers=H(tok, "pro"), json={"image": PNG_URI, "title": "TEST_sb", "sport_id": "cricket"}, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    assert "image_path" not in r.json()
    lst = requests.get(f"{API}/me/storybook", headers=H(tok, "pro"), timeout=20).json()
    assert lst["enabled"] is True and any(p["id"] == pid for p in lst["pages"])
    img = requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "pro"), timeout=30)
    assert img.status_code == 200 and img.content == PNG
    # other user can't see
    assert requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "team"), timeout=20).status_code == 404
    assert requests.delete(f"{API}/me/storybook/{pid}", headers=H(tok, "pro"), timeout=20).status_code == 200
    assert requests.get(f"{API}/me/storybook/{pid}/image", headers=H(tok, "pro"), timeout=20).status_code == 404


def test_storybook_bad_image(tok):
    r = requests.post(f"{API}/me/storybook", headers=H(tok, "team"), json={"image": "data:image/jpeg;base64,AAAA"}, timeout=20)
    assert r.status_code == 400


def test_storybook_unauth():
    assert requests.get(f"{API}/me/storybook", timeout=20).status_code in (401, 403)


# ---- clerk webhook
def test_clerk_webhook_no_secret():
    r = requests.post(f"{API}/clerk/webhook", json={"type": "email.created"}, timeout=20)
    assert r.status_code in (400, 401, 503), r.text


# ---- social
def test_social_validation_and_public(tok):
    bad = requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={"instagram": "http://insta.com/x"}, timeout=20)
    assert bad.status_code == 422
    ok = requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={"instagram": "https://instagram.com/flexo_test"}, timeout=20)
    assert ok.status_code == 200 and ok.json()["instagram"] == "https://instagram.com/flexo_test"
    pub = requests.get(f"{API}/site/social", timeout=20).json()
    assert pub == {"instagram": "https://instagram.com/flexo_test"}
    requests.put(f"{API}/admin/settings/social", headers=H(tok, "admin"), json={}, timeout=20)
    assert requests.get(f"{API}/site/social", timeout=20).json() == {}


# ---- database
def test_db_rbac(tok):
    r = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "pro"), json={"url": "mongodb://localhost:27017", "db_name": "x"}, timeout=20)
    assert r.status_code == 403


def test_db_test_ok_and_bad(tok):
    r = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "admin"), json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_tmp"}, timeout=40)
    assert r.status_code == 200 and r.json()["ok"] is True and "ping_ms" in r.json()
    b = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "admin"), json={"url": "http://nope", "db_name": "x"}, timeout=20)
    assert b.status_code == 400 and "mongodb://" in b.json()["detail"]
    b2 = requests.post(f"{API}/admin/settings/database/test", headers=H(tok, "admin"), json={"url": "mongodb://127.0.0.1:1", "db_name": "x"}, timeout=60)
    assert b2.status_code == 400, b2.text


def test_db_backup(tok):
    r = requests.get(f"{API}/admin/settings/database/backup", headers=H(tok, "admin"), timeout=120)
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")
    data = json.loads(r.text)
    assert data["app"] == "FlexoCards" and "users" in data["collections"]


def test_db_switch_and_back(tok):
    r = requests.put(f"{API}/admin/settings/database", headers=H(tok, "admin"), json={"url": "mongodb://localhost:27017", "db_name": "flexo_qa_tmp", "copy_data": True}, timeout=120)
    assert r.status_code == 200, r.text
    assert r.json()["database"]["db_name"] == "flexo_qa_tmp" and r.json()["database"]["mode"] != "default"
    # app still works for admin on the custom db
    assert requests.get(f"{API}/me", headers=H(tok, "admin"), timeout=20).status_code == 200
    d = requests.post(f"{API}/admin/settings/database/use-default", headers=H(tok, "admin"), timeout=30)
    assert d.status_code == 200 and d.json()["db_name"] == DB_NAME
    s = requests.get(f"{API}/admin/settings", headers=H(tok, "admin"), timeout=30).json()
    assert s["database"]["db_name"] == DB_NAME
