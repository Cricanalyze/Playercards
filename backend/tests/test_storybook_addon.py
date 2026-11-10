# Storybook add-on (30d / 90d) pricing + entitlement tests
import os, json, subprocess, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def tokens():
    out = subprocess.run(["python3", "qa_users.py", "tokens"], cwd="/app/backend", capture_output=True, text=True, timeout=110).stdout
    line = [l for l in out.splitlines() if l.strip().startswith("{")][-1]
    return json.loads(line)


def h(t):
    return {"Authorization": f"Bearer {t}"}


def test_store_prices():
    r = requests.get(f"{BASE_URL}/api/store")
    assert r.status_code == 200
    d = r.json()
    assert d["storybook_price"] == 29
    assert d["storybook_bundle_price"] == 69


def test_quote_90d(tokens):
    r = requests.post(f"{BASE_URL}/api/billing/quote", json={"kind": "storybook", "item_id": "90d"}, headers=h(tokens["free"]))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["amount"] == 69
    assert d["label"] == "Storybook add-on (90 days)"


def test_quote_30d(tokens):
    r = requests.post(f"{BASE_URL}/api/billing/quote", json={"kind": "storybook", "item_id": "30d"}, headers=h(tokens["free"]))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["amount"] == 29
    assert "30 days" in d["label"]


def test_quote_invalid_kind(tokens):
    r = requests.post(f"{BASE_URL}/api/billing/quote", json={"kind": "bogus", "item_id": "x"}, headers=h(tokens["free"]))
    assert r.status_code in (400, 422)


def test_quote_unauth():
    r = requests.post(f"{BASE_URL}/api/billing/quote", json={"kind": "storybook", "item_id": "90d"})
    assert r.status_code in (401, 403)


def test_me_storybook_free(tokens):
    r = requests.get(f"{BASE_URL}/api/me/storybook", headers=h(tokens["free"]))
    assert r.status_code == 200
    d = r.json()
    assert d["enabled"] is False
    assert isinstance(d["pages"], list)


def test_free_cannot_save_storybook(tokens):
    r = requests.post(f"{BASE_URL}/api/me/storybook", json={"image": "data:image/png;base64,AAAA"}, headers=h(tokens["free"]))
    assert r.status_code in (402, 403, 422)


def test_admin_store_settings_roundtrip(tokens):
    r = requests.get(f"{BASE_URL}/api/admin/settings", headers=h(tokens["admin"]))
    assert r.status_code == 200, r.text
    st = r.json()["store"]
    assert "storybook_price" in st and "storybook_bundle_price" in st
    payload = dict(st)
    payload["storybook_bundle_price"] = 69
    payload["storybook_price"] = 29
    r2 = requests.put(f"{BASE_URL}/api/admin/settings/store", json=payload, headers=h(tokens["admin"]))
    assert r2.status_code == 200, r2.text
    assert r2.json()["storybook_bundle_price"] == 69


def test_admin_store_rejects_bad_price(tokens):
    r = requests.get(f"{BASE_URL}/api/admin/settings", headers=h(tokens["admin"]))
    payload = dict(r.json()["store"]); payload["storybook_bundle_price"] = 0
    r2 = requests.put(f"{BASE_URL}/api/admin/settings/store", json=payload, headers=h(tokens["admin"]))
    assert r2.status_code == 422


def test_non_admin_store_settings_forbidden(tokens):
    r = requests.put(f"{BASE_URL}/api/admin/settings/store", json={}, headers=h(tokens["free"]))
    assert r.status_code in (401, 403)
