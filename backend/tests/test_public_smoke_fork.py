# Public (logged-out) smoke tests for FlexoCards backend after fork
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# Health
def test_root(s):
    r = s.get(f"{BASE_URL}/api/", timeout=20)
    assert r.status_code == 200
    print(r.json())


# Clerk config
def test_clerk_config(s):
    r = s.get(f"{BASE_URL}/api/clerk/config", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d.get("enabled") is True
    assert isinstance(d.get("publishable_key"), str) and d["publishable_key"].startswith("pk_")


# Public catalog endpoints
@pytest.mark.parametrize("path", [
    "/api/sports", "/api/templates", "/api/plans", "/api/billing/config", "/api/blog",
    "/api/backgrounds", "/api/site/social", "/api/site/status", "/api/store",
])
def test_public_endpoints(s, path):
    r = s.get(f"{BASE_URL}{path}", timeout=20)
    print(path, r.status_code, r.text[:200])
    assert r.status_code < 500
    assert r.status_code == 200


# Protected endpoints should reject anon
@pytest.mark.parametrize("path", ["/api/me", "/api/me/cards", "/api/admin/users"])
def test_protected_reject_anon(s, path):
    r = s.get(f"{BASE_URL}{path}", timeout=20)
    print(path, r.status_code, r.text[:200])
    assert r.status_code in (401, 403, 404)


def test_blog_missing_slug_404(s):
    r = s.get(f"{BASE_URL}/api/blog/TEST_nonexistent_slug_xyz", timeout=20)
    assert r.status_code == 404
