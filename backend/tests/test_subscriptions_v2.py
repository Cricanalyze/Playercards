# RivalCard subscription model v2: plans, templates, export credits, tool gating, billing, admin
import json
import os
import subprocess
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


@pytest.fixture(scope="session")
def tokens():
    if os.path.exists("/tmp/tokens.json"):
        d = json.load(open("/tmp/tokens.json"))
        r = requests.get(f"{API}/me", headers={"Authorization": f"Bearer {d['admin']}"})
        if r.status_code == 200:
            return d
    out = subprocess.check_output(["python3", "qa_users.py", "tokens"], cwd="/app/backend")
    d = json.loads(out)
    json.dump(d, open("/tmp/tokens.json", "w"))
    return d


def H(tokens, who):
    return {"Authorization": f"Bearer {tokens[who]}", "Content-Type": "application/json"}


def rid():
    return "TEST_" + uuid.uuid4().hex[:20]


@pytest.fixture(scope="session", autouse=True)
def reset_usage():
    mdb.usage.delete_many({})
    mdb.usage_events.delete_many({})
    yield
    mdb.usage.delete_many({})
    mdb.usage_events.delete_many({})


def export(tokens, who, tpl="classic_athlete", r=None, features=None):
    hdr = H(tokens, who) if who else {"Content-Type": "application/json"}
    return requests.post(f"{API}/cards/export", headers=hdr, json={"sport_id": "cricket", "template_id": tpl, "format": "card",
                                                                   "request_id": r or rid(), "features_used": features or []})


# ---------- public catalog ----------
def test_plans_exact():
    r = requests.get(f"{API}/plans")
    assert r.status_code == 200
    p = {x["id"]: (x["price_month"], x["price_year"], x["cards_per_month"]) for x in r.json()}
    assert p == {"free": (0, 0, 2), "basic": (18, 180, 5), "pro": (45, 450, 15), "team": (79, 790, 40)}


def test_templates_25():
    t = requests.get(f"{API}/templates").json()
    assert len(t) == 25
    assert {x["collection"] for x in t} == {"free", "basic", "pro", "premium", "exclusive"}
    assert all(isinstance(x["plans"], list) and x["plans"] for x in t)


# ---------- export credits ----------
def test_export_anonymous_401():
    assert export(None, None).status_code == 401


def test_export_bad_request_id_422(tokens):
    assert export(tokens, "free", r="short").status_code == 422


def test_free_credits_duplicate_and_limit(tokens):
    r1 = rid()
    a = export(tokens, "free", r=r1)
    assert a.status_code == 200, a.text
    assert a.json()["cards_remaining"] == 1 and a.json()["watermark"] is True
    d = export(tokens, "free", r=r1)
    assert d.status_code == 200 and d.json()["duplicate"] is True and d.json()["cards_remaining"] == 1
    assert export(tokens, "free").json()["cards_remaining"] == 0
    x = export(tokens, "free")
    assert x.status_code == 402
    det = x.json()["detail"]
    assert det["upgrade"] is True and det["message"] and det["need"] == "credits"
    # duplicate of an already-charged id still succeeds even after limit
    assert export(tokens, "free", r=r1).json()["duplicate"] is True


@pytest.mark.parametrize("who,tpl,ok", [
    ("free", "rookie_crimson", False), ("free", "black_gold_elite", False), ("free", "legendary_edition", False), ("free", "legendary_royal", False),
    ("basic", "rookie_crimson", True), ("basic", "black_gold_elite", False), ("basic", "legendary_edition", False), ("basic", "legendary_royal", False),
    ("pro", "black_gold_elite", True), ("pro", "legendary_edition", True), ("pro", "legendary_royal", False),
    ("team", "legendary_royal", True), ("team", "mvp_edition", True),
])
def test_template_lock(tokens, who, tpl, ok):
    r = export(tokens, who, tpl=tpl)
    if ok:
        assert r.status_code == 200, r.text
    else:
        assert r.status_code == 402, r.text
        assert r.json()["detail"]["need"] in ("template", "credits")


@pytest.mark.parametrize("who,feat,ok", [
    ("basic", "advanced_effects", False), ("basic", "custom_backgrounds", False), ("basic", "bg_library", True),
    ("pro", "team_presets", False), ("pro", "advanced_effects", True), ("team", "team_presets", True),
])
def test_features_used(tokens, who, feat, ok):
    r = export(tokens, who, features=[feat])
    assert r.status_code == (200 if ok else 402), r.text
    if not ok:
        assert r.json()["detail"]["need"] == feat


# ---------- tools / backgrounds / brand ----------
def test_bg_removal_free_402(tokens):
    r = requests.post(f"{API}/tools/bg-removal", headers=H(tokens, "free"), json={"request_id": rid()})
    assert r.status_code == 402


def test_bg_removal_basic_counts(tokens):
    before = requests.get(f"{API}/me", headers=H(tokens, "basic")).json()["entitlements"]
    assert before["bg_removal_limit"] == 10
    r1 = rid()
    r = requests.post(f"{API}/tools/bg-removal", headers=H(tokens, "basic"), json={"request_id": r1})
    assert r.status_code == 200 and r.json()["remaining"] == before["bg_removals_remaining"] - 1
    r = requests.post(f"{API}/tools/bg-removal", headers=H(tokens, "basic"), json={"request_id": r1})
    assert r.status_code == 200 and r.json()["remaining"] == before["bg_removals_remaining"] - 1


def test_backgrounds_locking(tokens):
    anon = {b["id"]: b for b in requests.get(f"{API}/backgrounds").json()}
    assert all(b["locked"] and b["value"] == "" for b in anon.values())
    basic = {b["id"]: b for b in requests.get(f"{API}/backgrounds", headers=H(tokens, "basic")).json()}
    assert not basic["lib_storm"]["locked"] and basic["lib_storm"]["value"]
    assert basic["pre_gold_burst"]["locked"] and basic["pre_gold_burst"]["value"] == ""
    team = requests.get(f"{API}/backgrounds", headers=H(tokens, "team")).json()
    assert all(not b["locked"] and b["value"] for b in team)


def test_me_entitlements(tokens):
    for who, plan, cards in [("free", "free", 2), ("basic", "basic", 5), ("pro", "pro", 15), ("team", "team", 40)]:
        e = requests.get(f"{API}/me", headers=H(tokens, who)).json()["entitlements"]
        assert e["plan_id"] == plan and e["cards_per_month"] == cards
        for k in ("plan_name", "cards_used", "cards_remaining", "reset_at", "bg_removals_remaining", "subscription"):
            assert k in e
        if who != "free":
            assert e["subscription"]["end_at"]


def test_brand_team_only(tokens):
    body = {"team": "TEST_FC", "accent": "#112233", "background_id": "team_home"}
    assert requests.put(f"{API}/me/brand", headers=H(tokens, "pro"), json=body).status_code == 402
    r = requests.put(f"{API}/me/brand", headers=H(tokens, "team"), json=body)
    assert r.status_code == 200
    assert requests.get(f"{API}/me/brand", headers=H(tokens, "team")).json()["team"] == "TEST_FC"


# ---------- billing ----------
def test_billing_config():
    c = requests.get(f"{API}/billing/config").json()
    assert c["enabled"] is True and c["mode"] == "test" and c["key_id"].startswith("rzp_test_")


def test_checkout_and_bad_verify(tokens):
    r = requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "pro", "cycle": "year"})
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["amount"] == 45000 and o["order_id"].startswith("order_")
    m = requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "basic", "cycle": "month"}).json()
    assert m["amount"] == 1800
    assert requests.post(f"{API}/billing/checkout", headers=H(tokens, "free"), json={"plan_id": "free", "cycle": "month"}).status_code == 400
    v = requests.post(f"{API}/billing/verify", headers=H(tokens, "free"),
                      json={"razorpay_order_id": o["order_id"], "razorpay_payment_id": "pay_fake123", "razorpay_signature": "bad"})
    assert v.status_code == 400
    assert requests.get(f"{API}/me", headers=H(tokens, "free")).json()["entitlements"]["plan_id"] == "free"
    assert requests.post(f"{API}/billing/checkout", json={"plan_id": "pro", "cycle": "year"}).status_code == 401


def test_webhook_503_without_secret():
    assert requests.post(f"{API}/billing/webhook", data=b"{}").status_code == 503


# ---------- admin ----------
def test_non_admin_403(tokens):
    for path in ("/admin/plans", "/admin/metrics", "/admin/subscription-report", "/admin/templates"):
        assert requests.get(f"{API}{path}", headers=H(tokens, "pro")).status_code == 403, path


def test_admin_plan_update_and_restore(tokens):
    h = H(tokens, "admin")
    plans = {p["id"]: p for p in requests.get(f"{API}/admin/plans", headers=h).json()}
    orig = plans["basic"]
    keys = ("name", "price_month", "price_year", "cards_per_month", "description", "features", "terms", "entitlements", "active", "order")
    body = {k: orig[k] for k in keys}
    try:
        mod = {**body, "price_month": 19, "price_year": 190, "cards_per_month": 6,
               "entitlements": {**orig["entitlements"], "bg_removal_limit": 11}}
        assert requests.put(f"{API}/admin/plans/basic", headers=h, json=mod).status_code == 200
        pub = {p["id"]: p for p in requests.get(f"{API}/plans").json()}["basic"]
        assert (pub["price_month"], pub["price_year"], pub["cards_per_month"]) == (19, 190, 6)
        assert pub["entitlements"]["bg_removal_limit"] == 11
    finally:
        assert requests.put(f"{API}/admin/plans/basic", headers=h, json=body).status_code == 200
    pub = {p["id"]: p for p in requests.get(f"{API}/plans").json()}["basic"]
    assert (pub["price_month"], pub["price_year"], pub["cards_per_month"]) == (18, 180, 5)
    assert requests.post(f"{API}/admin/plans", headers=h, json=body).status_code == 405
    audit = requests.get(f"{API}/admin/audit", headers=h).json()
    rows = audit if isinstance(audit, list) else audit.get("items") or audit.get("logs") or []
    assert any(a["action"] == "plan.updated" for a in rows)


def test_admin_plan_templates(tokens):
    h = H(tokens, "admin")
    before = [t["id"] for t in requests.get(f"{API}/admin/templates", headers=h).json() if "pro" in t["plans"]]
    try:
        r = requests.put(f"{API}/admin/plans/pro/templates", headers=h, json={"template_ids": before + ["legendary_royal"]})
        assert r.status_code == 200
        t = {x["id"]: x for x in requests.get(f"{API}/templates").json()}
        assert "pro" in t["legendary_royal"]["plans"]
    finally:
        requests.put(f"{API}/admin/plans/pro/templates", headers=h, json={"template_ids": before})
    t = {x["id"]: x for x in requests.get(f"{API}/templates").json()}
    assert t["legendary_royal"]["plans"] == ["team"]


def test_admin_template_crud(tokens):
    h = H(tokens, "admin")
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    body = {"name": "TEST_Frame", "badge": "TST", "layout": "classic_athlete", "collection": "pro", "accent": "#123456",
            "sports": ["cricket"], "plans": ["pro", "team"], "frame_image": png, "active": False}
    c = requests.post(f"{API}/admin/templates", headers=h, json=body)
    assert c.status_code == 200, c.text
    tid = c.json()["id"]
    try:
        assert tid not in [t["id"] for t in requests.get(f"{API}/templates").json()]
        assert requests.put(f"{API}/admin/templates/{tid}", headers=h, json={**body, "active": True}).status_code == 200
        pub = {t["id"]: t for t in requests.get(f"{API}/templates").json()}
        assert tid in pub and pub[tid]["frame_image"].startswith("data:image/png")
        bad = requests.post(f"{API}/admin/templates", headers=h, json={**body, "frame_image": "data:image/jpeg;base64,xx"})
        assert bad.status_code == 422
    finally:
        assert requests.delete(f"{API}/admin/templates/{tid}", headers=h).status_code == 200
    assert tid not in [t["id"] for t in requests.get(f"{API}/admin/templates", headers=h).json()]


def test_admin_subscription_lifecycle(tokens):
    h = H(tokens, "admin")
    free_uid = requests.get(f"{API}/me", headers=H(tokens, "free")).json()["member"]["user_id"]
    r = requests.post(f"{API}/admin/subscriptions", headers=h, json={"user_id": free_uid, "plan_id": "basic", "start_at": "2026-01-01",
                                                                  "end_at": "2026-12-31", "cycle": "year", "source": "complimentary", "note": "TEST_grant"})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    try:
        assert requests.get(f"{API}/me", headers=H(tokens, "free")).json()["entitlements"]["plan_id"] == "basic"
        d = requests.patch(f"{API}/admin/subscriptions/{sid}/dates", headers=h, json={"start_at": "2026-01-02", "end_at": "2026-11-30"})
        assert d.status_code == 200 and d.json()["status"] == "active"
        e = requests.post(f"{API}/admin/subscriptions/{sid}/extend", headers=h, json={"days": 10})
        assert e.status_code == 200 and e.json()["end_at"].startswith("2026-12-10")
        bad = requests.patch(f"{API}/admin/subscriptions/{sid}/dates", headers=h, json={"start_at": "2026-05-01", "end_at": "2026-04-01"})
        assert bad.status_code == 400
        det = requests.get(f"{API}/admin/users/{free_uid}", headers=h).json()
        assert "cards" in det and "usage_history" in det and det["entitlements"]["plan_id"] == "basic"
        audit = requests.get(f"{API}/admin/audit", headers=h).json()
        rows = audit if isinstance(audit, list) else audit.get("items") or audit.get("logs") or []
        assert any(a["action"] == "subscription.granted" for a in rows)
    finally:
        requests.post(f"{API}/admin/subscriptions/{sid}/cancel", headers=h, json={"immediate": True})
    assert requests.get(f"{API}/me", headers=H(tokens, "free")).json()["entitlements"]["plan_id"] == "free"


def test_admin_report_and_metrics(tokens):
    h = H(tokens, "admin")
    rep = requests.get(f"{API}/admin/subscription-report", headers=h)
    assert rep.status_code == 200
    j = rep.json()
    assert {"active", "monthly", "users"} <= set(j) and {"total", "paid", "free"} <= set(j["users"])
    m = requests.get(f"{API}/admin/metrics", headers=h).json()
    assert {"paid", "free", "complimentary"} <= set(m["users"]) and m["payments"]["gateway"] == "test"
    pays = requests.get(f"{API}/admin/payments", headers=h)
    assert pays.status_code == 200 and isinstance(pays.json(), list)


def test_admin_suspend_reactivate(tokens):
    h = H(tokens, "admin")
    uid = requests.get(f"{API}/me", headers=H(tokens, "basic")).json()["member"]["user_id"]
    try:
        assert requests.patch(f"{API}/admin/users/{uid}", headers=h, json={"status": "suspended", "reason": "TEST"}).status_code == 200
        assert requests.get(f"{API}/admin/users/{uid}", headers=h).json()["user"]["status"] == "suspended"
    finally:
        assert requests.patch(f"{API}/admin/users/{uid}", headers=h, json={"status": "active"}).status_code == 200
    assert requests.get(f"{API}/admin/users/{uid}", headers=h).json()["user"]["status"] == "active"
