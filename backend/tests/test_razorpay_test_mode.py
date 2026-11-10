# Razorpay TEST-mode billing: config, checkout order creation for 4 items, verify guards
import os, json, subprocess, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def tokens():
    out = subprocess.run(["python3", "qa_users.py", "tokens"], cwd="/app/backend", capture_output=True, text=True, timeout=110).stdout
    line = [l for l in out.splitlines() if l.strip().startswith("{")][-1]
    return json.loads(line)


def h(t):
    return {"Authorization": f"Bearer {t}"}


# billing config
def test_billing_config_test_mode():
    r = requests.get(f"{BASE_URL}/api/billing/config")
    assert r.status_code == 200
    d = r.json()
    assert d["enabled"] is True
    assert d["mode"] == "test"
    assert d["key_id"].startswith("rzp_test_")


# checkout creates real Razorpay test orders with correct paise amounts
@pytest.mark.parametrize("body,paise,label_part", [
    ({"kind": "plan", "plan_id": "pro", "cycle": "month"}, 4500, "Pro"),
    ({"kind": "pack", "item_id": "pack10"}, 2500, "10 extra cards"),
    ({"kind": "storybook", "item_id": "30d"}, 2900, "30 days"),
    ({"kind": "storybook", "item_id": "90d"}, 6900, "90 days"),
])
def test_checkout_creates_order(tokens, body, paise, label_part):
    r = requests.post(f"{BASE_URL}/api/billing/checkout", json=body, headers=h(tokens["basic"]))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["order_id"].startswith("order_")
    assert d["amount"] == paise
    assert d["currency"] == "INR"
    assert d["key_id"].startswith("rzp_test_")
    assert label_part in d["label"] or label_part in d["plan_name"]
    # persisted as created payment
    me = requests.get(f"{BASE_URL}/api/me", headers=h(tokens["basic"])).json()
    p = next(x for x in me["payments"] if x["order_id"] == d["order_id"])
    assert p["status"] == "created"
    assert int(round(p["amount_inr"] * 100)) == paise


def test_checkout_requires_auth():
    r = requests.post(f"{BASE_URL}/api/billing/checkout", json={"kind": "storybook", "item_id": "30d"})
    assert r.status_code in (401, 403)


def test_checkout_invalid_item(tokens):
    r = requests.post(f"{BASE_URL}/api/billing/checkout", json={"kind": "storybook", "item_id": "7d"}, headers=h(tokens["basic"]))
    assert r.status_code == 400


def test_verify_bad_signature(tokens):
    o = requests.post(f"{BASE_URL}/api/billing/checkout", json={"kind": "pack", "item_id": "pack10"}, headers=h(tokens["basic"])).json()
    r = requests.post(f"{BASE_URL}/api/billing/verify", json={"razorpay_order_id": o["order_id"], "razorpay_payment_id": "pay_fake123",
                                                              "razorpay_signature": "deadbeef"}, headers=h(tokens["basic"]))
    assert r.status_code == 400


def test_verify_unknown_order(tokens):
    r = requests.post(f"{BASE_URL}/api/billing/verify", json={"razorpay_order_id": "order_nope", "razorpay_payment_id": "pay_x",
                                                              "razorpay_signature": "x"}, headers=h(tokens["basic"]))
    assert r.status_code == 404
