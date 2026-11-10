# RivalCard core regression: public catalog, billing config, auth gating, export credits, template locks, checkout order, admin RBAC
import json
import os
import subprocess
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def tokens():
    out = subprocess.run(["python", "qa_users.py", "tokens"], cwd="/app/backend", capture_output=True, text=True, timeout=120)
    try:
        return json.loads(out.stdout.strip().splitlines()[-1])
    except Exception:
        pytest.skip(f"could not mint tokens: {out.stderr[:300]}")


def H(tokens, who):
    return {"Authorization": f"Bearer {tokens[who]}"}


# --- public catalog ---
def test_plans():
    r = requests.get(f"{API}/plans", timeout=20)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    for p in ("free", "basic", "pro", "team"):
        assert p in ids
    assert all("_id" not in p for p in r.json())


def test_templates_25():
    r = requests.get(f"{API}/templates", timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 25


def test_billing_config_test_mode():
    r = requests.get(f"{API}/billing/config", timeout=20)
    d = r.json()
    assert r.status_code == 200 and d["enabled"] is True and d["mode"] == "test"
    assert d["key_id"].startswith("rzp_test_")
    assert d["webhooks"] is False


def test_clerk_config():
    d = requests.get(f"{API}/clerk/config", timeout=20).json()
    assert d["enabled"] is True and d["publishable_key"].startswith("pk_")


# --- auth gating ---
def test_me_401_without_token():
    assert requests.get(f"{API}/me", timeout=20).status_code == 401


def test_me_401_bad_token():
    assert requests.get(f"{API}/me", headers={"Authorization": "Bearer garbage"}, timeout=20).status_code == 401


def test_me_free(tokens):
    r = requests.get(f"{API}/me", headers=H(tokens, "free"), timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["member"]["email"] == "qa.free+clerk_test@example.com"
    e = d["entitlements"]
    assert e["plan_id"] == "free" and "reset_at" in e and isinstance(e["cards_remaining"], int)


def test_me_basic_plan(tokens):
    d = requests.get(f"{API}/me", headers=H(tokens, "basic"), timeout=30).json()
    assert d["entitlements"]["plan_id"] == "basic"


# --- export / credits ---
def _free_and_locked():
    tpls = requests.get(f"{API}/templates", timeout=20).json()
    free = next(t for t in tpls if not t.get("plans") or "free" in t["plans"])
    locked = next((t for t in tpls if t.get("plans") and "free" not in t["plans"]), None)
    return free, locked


def test_export_anon_401():
    free, _ = _free_and_locked()
    r = requests.post(f"{API}/cards/export", json={"sport_id": "cricket", "template_id": free["id"], "format": "card",
                                                     "request_id": uuid.uuid4().hex}, timeout=20)
    assert r.status_code == 401


def test_export_locked_template_402(tokens):
    _, locked = _free_and_locked()
    assert locked, "no locked template"
    r = requests.post(f"{API}/cards/export", headers=H(tokens, "free"),
                      json={"sport_id": "cricket", "template_id": locked["id"], "format": "card", "request_id": uuid.uuid4().hex}, timeout=30)
    assert r.status_code == 402
    assert r.json()["detail"]["need"] == "template"


def test_export_consumes_credit_idempotent(tokens):
    free, _ = _free_and_locked()
    before = requests.get(f"{API}/me", headers=H(tokens, "basic"), timeout=30).json()["entitlements"]["cards_remaining"]
    if before < 1:
        pytest.skip("no credits left on basic")
    rid = uuid.uuid4().hex
    body = {"sport_id": "cricket", "template_id": free["id"], "format": "card", "request_id": rid}
    r = requests.post(f"{API}/cards/export", headers=H(tokens, "basic"), json=body, timeout=30)
    assert r.status_code == 200 and r.json()["allowed"] is True
    assert r.json()["cards_remaining"] == before - 1
    r2 = requests.post(f"{API}/cards/export", headers=H(tokens, "basic"), json=body, timeout=30)
    assert r2.json()["duplicate"] is True and r2.json()["cards_remaining"] == before - 1


# --- checkout ---
def test_checkout_basic_creates_order(tokens):
    r = requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "basic", "cycle": "month"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["order_id"].startswith("order_") and d["amount"] > 0 and d["key_id"].startswith("rzp_test_")
    pays = requests.get(f"{API}/me", headers=H(tokens, "free"), timeout=30).json()["payments"]
    assert any(p["order_id"] == d["order_id"] and p["status"] == "created" for p in pays)


def test_checkout_free_plan_400(tokens):
    r = requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "free", "cycle": "month"}, timeout=30)
    assert r.status_code == 400


def test_verify_bad_signature(tokens):
    r = requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "basic", "cycle": "month"}, timeout=30)
    oid = r.json()["order_id"]
    v = requests.post(f"{API}/billing/verify", headers=H(tokens, "free"),
                      json={"razorpay_order_id": oid, "razorpay_payment_id": "pay_fake", "razorpay_signature": "bad"}, timeout=30)
    assert v.status_code == 400


def test_webhook_503_no_secret():
    assert requests.post(f"{API}/billing/webhook", data="{}", timeout=20).status_code == 503


# --- admin RBAC ---
def test_admin_meta_admin(tokens):
    r = requests.get(f"{API}/admin/meta", headers=H(tokens, "admin"), timeout=30)
    assert r.status_code == 200


def test_admin_users_admin_vs_free(tokens):
    assert requests.get(f"{API}/admin/users", headers=H(tokens, "admin"), timeout=30).status_code == 200
    assert requests.get(f"{API}/admin/users", headers=H(tokens, "free"), timeout=30).status_code == 403


def test_admin_metrics_free_denied(tokens):
    assert requests.get(f"{API}/admin/metrics", headers=H(tokens, "free"), timeout=30).status_code == 403
