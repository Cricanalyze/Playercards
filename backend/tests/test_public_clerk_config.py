# Public API + Clerk config regression tests (no auth credentials required)
import os
import pytest
import requests


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE = _base() + "/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# Clerk config
def test_clerk_config_enabled(s):
    r = s.get(f"{BASE}/clerk/config", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["enabled"] is True
    assert d["publishable_key"].startswith("pk_test_")
    assert d["proxy_url"] == ""
    assert "secret" not in str(d).lower()


# Protected endpoint
def test_me_requires_auth(s):
    r = s.get(f"{BASE}/me", timeout=20)
    assert r.status_code == 401


def test_me_invalid_token(s):
    r = s.get(f"{BASE}/me", headers={"Authorization": "Bearer abc.def.ghi"}, timeout=20)
    assert r.status_code == 401


# Seeded data
def test_sports_has_cricket(s):
    r = s.get(f"{BASE}/sports", timeout=20)
    assert r.status_code == 200
    d = r.json()
    items = d if isinstance(d, list) else d.get("sports", d.get("items", []))
    assert len(items) > 0
    ids = [x.get("id") for x in items]
    assert "cricket" in ids
    cricket = next(x for x in items if x.get("id") == "cricket")
    print("cricket sport:", cricket)


def test_templates_seeded(s):
    r = s.get(f"{BASE}/templates", timeout=20)
    assert r.status_code == 200
    d = r.json()
    items = d if isinstance(d, list) else d.get("templates", d.get("items", []))
    assert len(items) > 0
    ids = [x.get("id") for x in items]
    assert "legendary_edition" in ids
    assert all("_id" not in x for x in items)


def test_plans_seeded(s):
    r = s.get(f"{BASE}/plans", timeout=20)
    assert r.status_code == 200
    d = r.json()
    items = d if isinstance(d, list) else d.get("plans", d.get("items", []))
    assert len(items) > 0
    assert all("_id" not in x for x in items)
