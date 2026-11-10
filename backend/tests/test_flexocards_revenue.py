# FlexoCards revenue features: store, quote/coupons, checkout, admin coupons, referrals, export wallet, invoices, store/invoice settings
import asyncio
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

INVOICE_DEFAULT = {"legal_name": "Buddy Innovations and Technologies Private Limited", "gstin": "", "address": "", "state": "", "state_code": "",
                   "gst_rate": 18, "inclusive": True, "sac": "998439", "prefix": "FC", "email": "", "phone": ""}
STORE_DEFAULT = {"packs": [{"id": "pack3", "cards": 3, "price": 9}, {"id": "pack10", "cards": 10, "price": 25}, {"id": "pack25", "cards": 25, "price": 49}],
                 "wm_price": 5, "wm_bundle_qty": 5, "wm_bundle_price": 19, "ref_enabled": True, "ref_reward_cards": 2, "ref_max_rewards": 50}


@pytest.fixture(scope="module")
def tok():
    if os.path.exists("/tmp/tok.json") and time.time() - os.path.getmtime("/tmp/tok.json") < 2400:
        return json.load(open("/tmp/tok.json"))
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120, cwd="/app/backend").stdout
    return json.loads(out.strip().splitlines()[-1])


def H(tok, role):
    return {"Authorization": f"Bearer {tok[role]}"}


def uid(email_prefix):
    return mdb.users.find_one({"email": f"{email_prefix}+clerk_test@example.com"})["user_id"]


@pytest.fixture(scope="module", autouse=True)
def snapshot_restore(tok):
    users = {u["user_id"]: u for u in mdb.users.find({"email": {"$regex": r"^qa\..*clerk_test@example.com$"}})}
    usage = list(mdb.usage.find({"user_id": {"$in": list(users)}}))
    refs = [r["id"] for r in mdb.referrals.find({})]
    yield
    for u in users.values():
        mdb.users.update_one({"user_id": u["user_id"]}, {"$set": {"bonus_cards": u.get("bonus_cards", 0), "watermark_passes": u.get("watermark_passes", 0)}})
    for x in usage:
        mdb.usage.replace_one({"_id": x["_id"]}, x)
    mdb.usage_events.delete_many({"key": {"$regex": "TESTRQ"}})
    mdb.referrals.delete_many({"id": {"$nin": refs}})
    mdb.coupons.delete_many({"code": {"$regex": "^TEST"}})
    a = H(tok, "admin")
    requests.put(f"{API}/admin/settings/invoice", json=INVOICE_DEFAULT, headers=a, timeout=20)
    requests.put(f"{API}/admin/settings/store", json=STORE_DEFAULT, headers=a, timeout=20)


# --- store
def test_store_public():
    d = requests.get(f"{API}/store", timeout=20).json()
    assert [(p["id"], p["cards"], p["price"]) for p in d["packs"]] == [("pack3", 3, 9), ("pack10", 10, 25), ("pack25", 25, 49)]
    assert d["wm_price"] == 5 and d["wm_bundle_qty"] == 5 and d["wm_bundle_price"] == 19
    assert "ref_max_rewards" not in d


# --- admin coupons CRUD + RBAC
def mk_coupon(tok, **kw):
    body = {"code": "TESTPCT", "type": "percent", "value": 20, "applies_to": "all", "max_uses": 0, "once_per_user": True, "expires_at": "", "active": True}
    body.update(kw)
    r = requests.post(f"{API}/admin/coupons", json=body, headers=H(tok, "admin"), timeout=20)
    return r


def test_coupon_rbac(tok):
    for role in ("free", "pro"):
        assert requests.get(f"{API}/admin/coupons", headers=H(tok, role), timeout=20).status_code == 403
        assert requests.post(f"{API}/admin/coupons", json={"code": "TESTX", "type": "flat", "value": 1}, headers=H(tok, role), timeout=20).status_code == 403


def test_coupon_crud(tok):
    r = mk_coupon(tok, code="testpct")
    assert r.status_code == 200, r.text
    assert r.json()["code"] == "TESTPCT" and r.json()["uses"] == 0
    assert mk_coupon(tok, code="TESTFLAT", type="flat", value=3).status_code == 200
    assert mk_coupon(tok, code="TESTBAD", value=150).status_code == 400
    lst = requests.get(f"{API}/admin/coupons", headers=H(tok, "admin"), timeout=20).json()
    assert {"TESTPCT", "TESTFLAT"} <= {c["code"] for c in lst}
    # toggle off
    assert mk_coupon(tok, code="TESTFLAT", type="flat", value=3, active=False).json()["active"] is False
    q = requests.post(f"{API}/billing/quote", json={"kind": "pack", "item_id": "pack3", "coupon": "TESTFLAT"}, headers=H(tok, "free"), timeout=20)
    assert q.status_code == 400
    assert mk_coupon(tok, code="TESTFLAT", type="flat", value=3, active=True).json()["active"] is True
    # delete
    mk_coupon(tok, code="TESTDEL")
    assert requests.delete(f"{API}/admin/coupons/testdel", headers=H(tok, "admin"), timeout=20).status_code == 200
    assert "TESTDEL" not in {c["code"] for c in requests.get(f"{API}/admin/coupons", headers=H(tok, "admin"), timeout=20).json()}


# --- quotes
def quote(tok, role="free", **kw):
    return requests.post(f"{API}/billing/quote", json=kw, headers=H(tok, role), timeout=20)


def test_quote_no_coupon(tok):
    assert quote(tok, kind="pack", item_id="pack10").json()["final"] == 25
    assert quote(tok, kind="watermark", item_id="single").json()["final"] == 5
    b = quote(tok, kind="watermark", item_id="bundle").json()
    assert b["final"] == 19 and "5 watermark-free downloads" in b["label"]
    p = quote(tok, kind="plan", plan_id="basic", cycle="month").json()
    assert p["amount"] > 0 and "Basic" in p["label"]
    assert quote(tok, kind="pack", item_id="nope").status_code == 400
    assert quote(tok, kind="plan", plan_id="free").status_code == 400
    assert requests.post(f"{API}/billing/quote", json={"kind": "pack", "item_id": "pack3"}, timeout=20).status_code in (401, 403)


def test_quote_coupons(tok):
    mk_coupon(tok, code="TESTPCT")
    mk_coupon(tok, code="TESTFLAT", type="flat", value=3)
    q = quote(tok, kind="pack", item_id="pack25", coupon="testpct").json()
    assert q["discount"] == 9.8 and q["final"] == 39.2 and q["coupon"] == "TESTPCT"
    q = quote(tok, kind="watermark", item_id="single", coupon="TESTFLAT").json()
    assert q["final"] == 2 and q["discount"] == 3
    # flat bigger than price -> floor at 1
    mk_coupon(tok, code="TESTBIG", type="flat", value=500)
    q = quote(tok, kind="pack", item_id="pack3", coupon="TESTBIG").json()
    assert q["final"] == 1 and q["discount"] == 8
    pl = quote(tok, kind="plan", plan_id="basic", cycle="month", coupon="TESTPCT").json()
    assert pl["final"] == round(pl["amount"] * 0.8, 2)


def test_quote_coupon_errors(tok):
    r = quote(tok, kind="pack", item_id="pack3", coupon="NOPE123")
    assert r.status_code == 400 and "isn't valid" in r.json()["detail"]
    mk_coupon(tok, code="TESTEXP", expires_at=(datetime.now(timezone.utc) - timedelta(days=1)).isoformat())
    r = quote(tok, kind="pack", item_id="pack3", coupon="TESTEXP")
    assert r.status_code == 400 and "expired" in r.json()["detail"]
    mk_coupon(tok, code="TESTMAX", max_uses=1)
    mdb.coupons.update_one({"code": "TESTMAX"}, {"$set": {"uses": 1}})
    r = quote(tok, kind="pack", item_id="pack3", coupon="TESTMAX")
    assert r.status_code == 400 and "fully used" in r.json()["detail"]
    mk_coupon(tok, code="TESTPLANS", applies_to="plans")
    r = quote(tok, kind="pack", item_id="pack3", coupon="TESTPLANS")
    assert r.status_code == 400 and "only works on plans" in r.json()["detail"]
    mk_coupon(tok, code="TESTEXTRAS", applies_to="extras")
    r = quote(tok, kind="plan", plan_id="basic", coupon="TESTEXTRAS")
    assert r.status_code == 400 and "card packs" in r.json()["detail"]
    assert quote(tok, kind="watermark", coupon="TESTEXTRAS").status_code == 200


def test_coupon_expiry_formats_no_500(tok):
    # date-only / naive expiry accepted by admin save must not crash quote with 500
    for i, exp in enumerate(["2020-01-01", "2020-01-01T10:00", "2099-01-01T10:00:00Z"]):
        r = mk_coupon(tok, code=f"TESTFMT{i}", expires_at=exp)
        if r.status_code != 200:
            continue
        q = quote(tok, kind="pack", item_id="pack3", coupon=f"TESTFMT{i}")
        assert q.status_code in (200, 400), f"expires_at={exp} -> {q.status_code} {q.text[:200]}"


# --- checkout
def test_checkout_orders(tok):
    mk_coupon(tok, code="TESTPCT")
    for body, amt in [({"kind": "pack", "item_id": "pack10", "coupon": "TESTPCT"}, 2000),
                      ({"kind": "watermark", "item_id": "bundle"}, 1900),
                      ({"kind": "plan", "plan_id": "basic", "cycle": "month", "billing": {"name": "TEST Co", "gstin": "29ABCDE1234F1Z5", "state": "Karnataka"}}, None)]:
        r = requests.post(f"{API}/billing/checkout", json=body, headers=H(tok, "free"), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"].startswith("order_") and d["key_id"].startswith("rzp_test_")
        if amt:
            assert d["amount"] == amt
        p = mdb.payments.find_one({"id": d["payment_id"]})
        assert p["status"] == "created" and p["amount_inr"] * 100 == d["amount"]
        if "billing" in body:
            assert p["billing"]["gstin"] == "29ABCDE1234F1Z5" and p["billing"]["state"] == "Karnataka"
        if body.get("coupon"):
            assert p["coupon"] == "TESTPCT" and p["discount_inr"] == 5
        mdb.payments.delete_one({"id": d["payment_id"]})


def test_checkout_gstin_validation(tok):
    r = requests.post(f"{API}/billing/checkout", json={"kind": "pack", "item_id": "pack3", "billing": {"gstin": "29abcde1234f1z5"}}, headers=H(tok, "free"), timeout=20)
    assert r.status_code == 422
    r = requests.post(f"{API}/billing/checkout", json={"kind": "pack", "item_id": "pack3", "billing": {"gstin": "123"}}, headers=H(tok, "free"), timeout=20)
    assert r.status_code == 422


# --- webhook capture -> invoice number + wallet credit
def webhook_secret():
    sys.path.insert(0, "/app/backend")
    import settings_store
    from motor.motor_asyncio import AsyncIOMotorClient

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await settings_store.load_all(c[os.environ["DB_NAME"]])
        return settings_store.get("razorpay")["webhook_secret"]
    return asyncio.run(go())


def test_capture_pack_assigns_invoice_and_credits(tok):
    sec = webhook_secret()
    if not sec:
        pytest.skip("webhook secret not configured")
    mk_coupon(tok, code="TESTPCT")
    team = uid("qa.team")
    before = mdb.users.find_one({"user_id": team}).get("bonus_cards", 0)
    d = requests.post(f"{API}/billing/checkout", json={"kind": "pack", "item_id": "pack3", "coupon": "TESTPCT",
                                                       "billing": {"name": "TEST Buyer", "state": "Maharashtra"}}, headers=H(tok, "team"), timeout=30).json()
    raw = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_TEST" + uuid.uuid4().hex[:10], "order_id": d["order_id"], "amount": d["amount"]}}}}).encode()
    sig = hmac.new(sec.encode(), raw, hashlib.sha256).hexdigest()
    r = requests.post(f"{API}/billing/webhook", data=raw, headers={"x-razorpay-signature": sig, "Content-Type": "application/json"}, timeout=20)
    assert r.status_code == 200, r.text
    p = mdb.payments.find_one({"id": d["payment_id"]})
    assert p["status"] == "captured"
    import re
    assert re.match(r"^FC-\d{4}-\d{5}$", p["invoice_no"])
    assert mdb.users.find_one({"user_id": team})["bonus_cards"] == before + 3
    assert mdb.coupons.find_one({"code": "TESTPCT"})["uses"] == 1
    # once_per_user now blocks re-use
    q = quote(tok, "team", kind="pack", item_id="pack3", coupon="TESTPCT")
    assert q.status_code == 400 and "already used" in q.json()["detail"]
    inv = requests.get(f"{API}/me/payments/{d['payment_id']}/invoice", headers=H(tok, "team"), timeout=20).json()
    assert inv["title"] == "Payment Receipt" and inv["number"] == p["invoice_no"] and inv["taxes"] == [] and inv["total"] == 7.2
    assert inv["coupon"] == "TESTPCT"
    # other user can't fetch
    assert requests.get(f"{API}/me/payments/{d['payment_id']}/invoice", headers=H(tok, "free"), timeout=20).status_code == 404
    mdb.payments.delete_one({"id": d["payment_id"]})


# --- invoices (existing captured payment of QA free, buyer state Karnataka)
def free_payment():
    p = mdb.payments.find_one({"user_email": "qa.free+clerk_test@example.com", "status": "captured", "invoice_no": {"$exists": True}})
    if not p:
        pytest.skip("no captured payment for qa.free")
    return p


def test_invoice_receipt_default(tok):
    p = free_payment()
    r = requests.get(f"{API}/me/payments/{p['id']}/invoice", headers=H(tok, "free"), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["title"] == "Payment Receipt" and d["taxes"] == [] and d["total"] == p["amount_inr"]
    assert d["seller"]["legal_name"].startswith("Buddy Innovations")


def test_invoice_settings_rbac(tok):
    for role in ("free", "pro"):
        assert requests.put(f"{API}/admin/settings/invoice", json=INVOICE_DEFAULT, headers=H(tok, role), timeout=20).status_code == 403
        assert requests.put(f"{API}/admin/settings/store", json=STORE_DEFAULT, headers=H(tok, role), timeout=20).status_code == 403
    bad = {**INVOICE_DEFAULT, "gstin": "bad"}
    assert requests.put(f"{API}/admin/settings/invoice", json=bad, headers=H(tok, "admin"), timeout=20).status_code == 422


def test_invoice_tax_intra_and_inter(tok):
    p = free_payment()
    a = H(tok, "admin")
    r = requests.put(f"{API}/admin/settings/invoice", json={**INVOICE_DEFAULT, "gstin": "29AAACB1234C1Z5", "state": "Karnataka", "state_code": "29"}, headers=a, timeout=20)
    assert r.status_code == 200 and r.json()["gstin"] == "29AAACB1234C1Z5"
    d = requests.get(f"{API}/me/payments/{p['id']}/invoice", headers=H(tok, "free"), timeout=20).json()
    assert d["title"] == "Tax Invoice"
    names = [t["name"] for t in d["taxes"]]
    assert names == ["CGST 9%", "SGST 9%"]
    assert round(d["taxable"] + d["tax"], 2) == p["amount_inr"] == d["total"]
    assert round(sum(t["amount"] for t in d["taxes"]), 2) == d["tax"]
    requests.put(f"{API}/admin/settings/invoice", json={**INVOICE_DEFAULT, "gstin": "27AAACB1234C1Z5", "state": "Maharashtra", "state_code": "27"}, headers=a, timeout=20)
    d = requests.get(f"{API}/me/payments/{p['id']}/invoice", headers=H(tok, "free"), timeout=20).json()
    assert [t["name"] for t in d["taxes"]] == ["IGST 18%"]
    # admin invoice endpoint
    assert requests.get(f"{API}/admin/payments/{p['id']}/invoice", headers=a, timeout=20).status_code == 200
    requests.put(f"{API}/admin/settings/invoice", json=INVOICE_DEFAULT, headers=a, timeout=20)


def test_store_settings_update(tok):
    a = H(tok, "admin")
    r = requests.put(f"{API}/admin/settings/store", json={**STORE_DEFAULT, "wm_price": 7}, headers=a, timeout=20)
    assert r.status_code == 200
    assert requests.get(f"{API}/store", timeout=20).json()["wm_price"] == 7
    requests.put(f"{API}/admin/settings/store", json=STORE_DEFAULT, headers=a, timeout=20)
    assert requests.get(f"{API}/store", timeout=20).json()["wm_price"] == 5


# --- referrals
def test_referral_code_and_claim(tok):
    pro = requests.get(f"{API}/me/referral", headers=H(tok, "pro"), timeout=20).json()
    assert len(pro["code"]) == 6 and pro["enabled"] is True and pro["reward_cards"] == 2
    assert requests.get(f"{API}/me/referral", headers=H(tok, "pro"), timeout=20).json()["code"] == pro["code"]
    team_code = requests.get(f"{API}/me/referral", headers=H(tok, "team"), timeout=20).json()["code"]
    r = requests.post(f"{API}/me/referral/claim", json={"code": team_code}, headers=H(tok, "team"), timeout=20)
    assert r.status_code == 400 and "isn't valid" in r.json()["detail"]
    team, prou = uid("qa.team"), uid("qa.pro")
    tb, pb = mdb.users.find_one({"user_id": team}).get("bonus_cards", 0), mdb.users.find_one({"user_id": prou}).get("bonus_cards", 0)
    r = requests.post(f"{API}/me/referral/claim", json={"code": pro["code"].lower()}, headers=H(tok, "team"), timeout=20)
    assert r.status_code == 200, r.text
    assert mdb.users.find_one({"user_id": team})["bonus_cards"] == tb + 2
    assert mdb.users.find_one({"user_id": prou})["bonus_cards"] == pb + 2
    r = requests.post(f"{API}/me/referral/claim", json={"code": pro["code"]}, headers=H(tok, "team"), timeout=20)
    assert r.status_code == 400 and "already used" in r.json()["detail"]
    assert requests.get(f"{API}/me/referral", headers=H(tok, "pro"), timeout=20).json()["count"] >= 1


def test_referral_old_account_rejected(tok):
    team = uid("qa.team")
    orig = mdb.users.find_one({"user_id": team})["created_at"]
    mdb.users.update_one({"user_id": team}, {"$set": {"created_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}})
    try:
        code = requests.get(f"{API}/me/referral", headers=H(tok, "basic"), timeout=20).json()["code"]
        r = requests.post(f"{API}/me/referral/claim", json={"code": code}, headers=H(tok, "team"), timeout=20)
        assert r.status_code == 400, r.text
        assert "new accounts" in r.json()["detail"]
    finally:
        mdb.users.update_one({"user_id": team}, {"$set": {"created_at": orig}})


# --- export wallet: monthly -> bonus_cards; watermark passes
def export(tok, no_wm=False, role="free"):
    return requests.post(f"{API}/cards/export", json={"sport_id": "cricket", "template_id": "classic_athlete", "format": "card",
                                                      "request_id": "TESTRQ" + uuid.uuid4().hex[:12], "no_watermark": no_wm}, headers=H(tok, role), timeout=20)


def test_export_wallet_flow(tok):
    free = uid("qa.free")
    mdb.users.update_one({"user_id": free}, {"$set": {"bonus_cards": 1, "watermark_passes": 1}})
    me = requests.get(f"{API}/me", headers=H(tok, "free"), timeout=20).json()["entitlements"]
    for _ in range(me["monthly_remaining"]):
        assert export(tok).status_code == 200
    r = export(tok, no_wm=True)  # bonus card + pass
    assert r.status_code == 200, r.text
    assert r.json()["watermark"] is False
    u = mdb.users.find_one({"user_id": free})
    assert u["bonus_cards"] == 0 and u["watermark_passes"] == 0
    mdb.users.update_one({"user_id": free}, {"$set": {"bonus_cards": 1}})
    r = export(tok, no_wm=True)
    assert r.status_code == 402 and r.json()["detail"]["need"] == "watermark"
    r = export(tok)
    assert r.status_code == 200 and r.json()["watermark"] is True
    r = export(tok)
    assert r.status_code == 402 and r.json()["detail"]["need"] == "credits"
