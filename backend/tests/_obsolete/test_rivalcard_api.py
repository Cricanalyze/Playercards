# RivalCard backend regression tests: public APIs, export entitlements, RBAC, subscriptions, invitations, suspend, audit
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/scripts")
import clerk_users  # noqa: E402  (loads Clerk secret from backend/.env, no printing)


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE = _base() + "/api"
ADMIN_EMAIL = "admin@playercard.app"
PLAYER_EMAIL = "player+clerk_test@example.com"
STAFF_EMAIL = "staff+clerk_test@example.com"


@pytest.fixture(scope="session")
def ids():
    return {e: clerk_users.ensure(e, p) for e, p in clerk_users.USERS}


@pytest.fixture(scope="session")
def tokens(ids):
    return {e: clerk_users.token(i) for e, i in ids.items()}


def H(tokens, email):
    return {"Authorization": f"Bearer {tokens[email]}"}


@pytest.fixture(scope="session")
def mdb():
    # local mongo used by the backend (db name given in review request)
    return MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]


# ---------- public ----------
class TestPublic:
    def test_root(self):
        r = requests.get(f"{BASE}/")
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_sports(self):
        r = requests.get(f"{BASE}/sports")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 60
        ids_ = {s["id"] for s in data}
        assert "kabaddi" in ids_ and "cricket" in ids_
        assert all("_id" not in s for s in data)

    def test_templates(self):
        data = requests.get(f"{BASE}/templates").json()
        assert len(data) == 8
        prem = {t["id"] for t in data if t["tier"] == "premium"}
        assert prem == {"black_gold_elite", "legendary_edition", "mvp_edition"}

    def test_plans(self):
        data = requests.get(f"{BASE}/plans").json()
        assert [p["id"] for p in data] == ["free", "premium_card", "pro_creator", "team_pack"]
        assert [p["price_inr"] for p in data] == [0, 49, 149, 999]

    def test_report_submit(self):
        r = requests.post(f"{BASE}/reports", json={"target": "TEST_contact", "reason": "TEST_ hello from tests", "contact": "t@x.com"})
        assert r.status_code == 200 and r.json()["ok"]

    def test_report_validation(self):
        r = requests.post(f"{BASE}/reports", json={"target": "", "reason": "x"})
        assert r.status_code == 422

    def test_export_free_anonymous(self):
        r = requests.post(f"{BASE}/cards/export", json={"sport_id": "kabaddi", "template_id": "classic_athlete", "format": "card"})
        assert r.status_code == 200 and r.json() == {"allowed": True, "watermark": True}

    def test_export_premium_anonymous_402(self):
        r = requests.post(f"{BASE}/cards/export", json={"sport_id": "kabaddi", "template_id": "black_gold_elite", "format": "story"})
        assert r.status_code == 402

    def test_export_unknown_template_404(self):
        r = requests.post(f"{BASE}/cards/export", json={"sport_id": "kabaddi", "template_id": "nope", "format": "card"})
        assert r.status_code == 404


# ---------- authorization ----------
class TestAuthz:
    @pytest.mark.parametrize("path", ["/me", "/admin/metrics", "/admin/users", "/admin/audit", "/admin/subscriptions", "/admin/invitations"])
    def test_no_token_401(self, path):
        assert requests.get(f"{BASE}{path}").status_code == 401

    def test_bad_token_401(self):
        assert requests.get(f"{BASE}/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401

    @pytest.mark.parametrize("path", ["/admin/metrics", "/admin/users", "/admin/audit", "/admin/subscriptions", "/admin/plans", "/admin/meta"])
    def test_user_403(self, tokens, path):
        assert requests.get(f"{BASE}{path}", headers=H(tokens, PLAYER_EMAIL)).status_code == 403

    @pytest.mark.parametrize("path", ["/admin/metrics", "/admin/users", "/admin/audit", "/admin/subscriptions", "/admin/plans", "/admin/meta", "/admin/sports", "/admin/templates", "/admin/reports"])
    def test_super_200(self, tokens, path):
        assert requests.get(f"{BASE}{path}", headers=H(tokens, ADMIN_EMAIL)).status_code == 200

    def test_me_super(self, tokens):
        d = requests.get(f"{BASE}/me", headers=H(tokens, ADMIN_EMAIL)).json()
        assert d["member"]["role"] == "super_admin" and d["member"]["email"] == ADMIN_EMAIL

    def test_metrics_shape(self, tokens):
        d = requests.get(f"{BASE}/admin/metrics", headers=H(tokens, ADMIN_EMAIL)).json()
        assert d["users"]["total"] >= 3 and d["payments"]["gateway"] == "not_configured"


# ---------- subscriptions ----------
class TestSubscriptions:
    def test_grant_export_revoke(self, tokens, ids):
        pid = ids[PLAYER_EMAIL]
        g = requests.post(f"{BASE}/admin/subscriptions", headers=H(tokens, ADMIN_EMAIL), json={"user_id": pid, "plan_id": "pro_creator", "note": "TEST_"})
        assert g.status_code == 200, g.text
        sub = g.json()
        assert sub["status"] == "active" and sub["end_at"]
        me = requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).json()
        assert me["entitlements"]["all_premium_templates"] is True
        e = requests.post(f"{BASE}/cards/export", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "cricket", "template_id": "black_gold_elite", "format": "card"})
        assert e.status_code == 200 and e.json()["watermark"] is False
        c = requests.post(f"{BASE}/admin/subscriptions/{sub['id']}/cancel", headers=H(tokens, ADMIN_EMAIL), json={"immediate": True})
        assert c.status_code == 200
        e2 = requests.post(f"{BASE}/cards/export", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "cricket", "template_id": "black_gold_elite", "format": "card"})
        assert e2.status_code == 402
        me2 = requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).json()
        assert me2["entitlements"]["all_premium_templates"] is False

    def test_grant_free_plan_rejected(self, tokens, ids):
        r = requests.post(f"{BASE}/admin/subscriptions", headers=H(tokens, ADMIN_EMAIL), json={"user_id": ids[PLAYER_EMAIL], "plan_id": "free"})
        assert r.status_code == 400

    def test_user_cannot_grant(self, tokens, ids):
        r = requests.post(f"{BASE}/admin/subscriptions", headers=H(tokens, PLAYER_EMAIL), json={"user_id": ids[PLAYER_EMAIL], "plan_id": "pro_creator"})
        assert r.status_code == 403

    def test_expired_access(self, tokens, ids, mdb):
        pid = ids[PLAYER_EMAIL]
        g = requests.post(f"{BASE}/admin/subscriptions", headers=H(tokens, ADMIN_EMAIL), json={"user_id": pid, "plan_id": "pro_creator", "days": 1})
        sid = g.json()["id"]
        assert requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).json()["entitlements"]["all_premium_templates"] is True
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        mdb.subscriptions.update_one({"id": sid}, {"$set": {"end_at": past}})
        me = requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).json()
        assert me["entitlements"]["all_premium_templates"] is False
        assert mdb.subscriptions.find_one({"id": sid})["status"] == "expired"

    def test_extend_and_cancel(self, tokens, ids):
        pid = ids[PLAYER_EMAIL]
        sub = requests.post(f"{BASE}/admin/subscriptions", headers=H(tokens, ADMIN_EMAIL), json={"user_id": pid, "plan_id": "premium_card", "template_id": "mvp_edition", "days": 5}).json()
        assert sub["template_id"] == "mvp_edition", sub
        ok = requests.post(f"{BASE}/cards/export", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "cricket", "template_id": "mvp_edition", "format": "card"})
        assert ok.status_code == 200
        no = requests.post(f"{BASE}/cards/export", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "cricket", "template_id": "black_gold_elite", "format": "card"})
        assert no.status_code == 402
        x = requests.post(f"{BASE}/admin/subscriptions/{sub['id']}/extend", headers=H(tokens, ADMIN_EMAIL), json={"days": 10})
        assert x.status_code == 200 and x.json()["end_at"] > sub["end_at"]
        c = requests.post(f"{BASE}/admin/subscriptions/{sub['id']}/cancel", headers=H(tokens, ADMIN_EMAIL), json={"immediate": True})
        assert c.status_code == 200
        again = requests.post(f"{BASE}/admin/subscriptions/{sub['id']}/cancel", headers=H(tokens, ADMIN_EMAIL), json={"immediate": True})
        assert again.status_code == 409


# ---------- roles ----------
class TestRoles:
    def test_role_rules(self, tokens, ids):
        sid, aid = ids[STAFF_EMAIL], ids[ADMIN_EMAIL]
        A, S = H(tokens, ADMIN_EMAIL), H(tokens, STAFF_EMAIL)
        try:
            bad = requests.patch(f"{BASE}/admin/users/{sid}/role", headers=A, json={"role": "admin", "confirm_email": "wrong@x.com"})
            assert bad.status_code == 400
            r = requests.patch(f"{BASE}/admin/users/{sid}/role", headers=A, json={"role": "admin", "confirm_email": ADMIN_EMAIL})
            assert r.status_code == 200 and r.json()["role"] == "admin"
            # admin with default perms (no admins.manage)
            assert requests.patch(f"{BASE}/admin/users/{sid}/role", headers=S, json={"role": "support", "confirm_email": STAFF_EMAIL}).status_code == 403
            assert requests.get(f"{BASE}/admin/metrics", headers=S).status_code == 200
            # admin with admins.manage
            r = requests.patch(f"{BASE}/admin/users/{sid}/role", headers=A, json={"role": "admin", "confirm_email": ADMIN_EMAIL,
                               "permissions": ["analytics.view", "users.view", "users.manage", "admins.manage", "audit.view"]})
            assert r.status_code == 200 and "admins.manage" in r.json()["perms"]
            assert requests.patch(f"{BASE}/admin/users/{sid}/role", headers=S, json={"role": "super_admin", "confirm_email": STAFF_EMAIL}).status_code == 403
            assert requests.patch(f"{BASE}/admin/users/{ids[PLAYER_EMAIL]}/role", headers=S, json={"role": "super_admin", "confirm_email": STAFF_EMAIL}).status_code == 403
            assert requests.patch(f"{BASE}/admin/users/{ids[PLAYER_EMAIL]}/role", headers=S, json={"role": "admin", "confirm_email": STAFF_EMAIL}).status_code == 403
            assert requests.patch(f"{BASE}/admin/users/{aid}/role", headers=S, json={"role": "user", "confirm_email": STAFF_EMAIL}).status_code == 403
            assert requests.post(f"{BASE}/admin/invitations", headers=S, json={"email": "TEST_x@example.com", "role": "super_admin"}).status_code == 403
            assert requests.patch(f"{BASE}/admin/users/{aid}", headers=S, json={"status": "suspended"}).status_code == 403
            # super admin self-protection
            assert requests.patch(f"{BASE}/admin/users/{aid}/role", headers=A, json={"role": "user", "confirm_email": ADMIN_EMAIL}).status_code in (403, 409)
            assert requests.patch(f"{BASE}/admin/users/{aid}", headers=A, json={"status": "suspended"}).status_code in (403, 409)
        finally:
            r = requests.patch(f"{BASE}/admin/users/{sid}/role", headers=A, json={"role": "user", "confirm_email": ADMIN_EMAIL})
            assert r.status_code == 200 and r.json()["role"] == "user"
        assert requests.get(f"{BASE}/admin/metrics", headers=S).status_code == 403


# ---------- invitations ----------
class TestInvitations:
    def test_invite_flow(self, tokens):
        A = H(tokens, ADMIN_EMAIL)
        r = requests.post(f"{BASE}/admin/invitations", headers=A, json={"email": "TEST_invitee@example.com", "role": "support", "expires_hours": 2})
        assert r.status_code == 200
        inv = r.json()
        v = requests.get(f"{BASE}/invitations/{inv['token']}").json()
        assert v["email_hint"] == "t***@example.com" and v["status"] == "pending" and v["role"] == "support"
        wrong = requests.post(f"{BASE}/invitations/accept", headers=H(tokens, PLAYER_EMAIL), json={"token": inv["token"]})
        assert wrong.status_code == 403
        lst = requests.get(f"{BASE}/admin/invitations", headers=A).json()
        assert all("token_hash" not in i for i in lst)
        assert requests.delete(f"{BASE}/admin/invitations/{inv['id']}", headers=A).status_code == 200
        assert requests.get(f"{BASE}/invitations/{inv['token']}").json()["status"] == "revoked"
        assert requests.post(f"{BASE}/invitations/accept", headers=H(tokens, PLAYER_EMAIL), json={"token": inv["token"]}).status_code == 400
        assert requests.delete(f"{BASE}/admin/invitations/{inv['id']}", headers=A).status_code == 404

    def test_expired_invite(self, tokens, mdb):
        A = H(tokens, ADMIN_EMAIL)
        inv = requests.post(f"{BASE}/admin/invitations", headers=A, json={"email": PLAYER_EMAIL, "role": "support"}).json()
        mdb.admin_invitations.update_one({"id": inv["id"]}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}})
        assert requests.get(f"{BASE}/invitations/{inv['token']}").json()["status"] == "expired"
        assert requests.post(f"{BASE}/invitations/accept", headers=H(tokens, PLAYER_EMAIL), json={"token": inv["token"]}).status_code == 400

    def test_invalid_role_and_unknown_token(self, tokens):
        assert requests.post(f"{BASE}/admin/invitations", headers=H(tokens, ADMIN_EMAIL), json={"email": "TEST_a@example.com", "role": "user"}).status_code == 400
        assert requests.get(f"{BASE}/invitations/notarealtoken_xxxxxxxxxxxxxxxxxxxx").status_code == 404


# ---------- suspend / users ----------
class TestSuspend:
    def test_suspend_reactivate(self, tokens, ids):
        pid, A = ids[PLAYER_EMAIL], H(tokens, ADMIN_EMAIL)
        try:
            r = requests.patch(f"{BASE}/admin/users/{pid}", headers=A, json={"status": "suspended", "reason": "TEST_"})
            assert r.status_code == 200
            assert requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).status_code == 403
        finally:
            r = requests.patch(f"{BASE}/admin/users/{pid}", headers=A, json={"status": "active"})
            assert r.status_code == 200
        assert requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).status_code == 200

    def test_users_search(self, tokens):
        d = requests.get(f"{BASE}/admin/users", headers=H(tokens, ADMIN_EMAIL), params={"q": "player+clerk"}).json()
        assert d["total"] == 1 and d["users"][0]["email"] == PLAYER_EMAIL


# ---------- saved cards ----------
class TestCards:
    def test_card_crud(self, tokens):
        P = H(tokens, PLAYER_EMAIL)
        c = requests.post(f"{BASE}/me/cards", headers=P, json={"title": "TEST_card", "sport_id": "kabaddi", "template_id": "classic_athlete", "data": {"name": "X", "photo": "data:..."}})
        assert c.status_code == 200
        card = c.json()
        assert "photo" not in card["data"]
        assert any(x["id"] == card["id"] for x in requests.get(f"{BASE}/me/cards", headers=P).json())
        assert requests.put(f"{BASE}/me/cards/{card['id']}", headers=P, json={"title": "TEST_card2", "sport_id": "kabaddi", "template_id": "classic_athlete", "data": {}}).status_code == 200
        assert requests.delete(f"{BASE}/me/cards/{card['id']}", headers=P).status_code == 200
        assert requests.delete(f"{BASE}/me/cards/{card['id']}", headers=P).status_code == 404


# ---------- audit ----------
class TestAudit:
    @pytest.mark.parametrize("action", ["role.changed", "subscription.granted", "user.suspended", "invitation.created", "subscription.revoked", "invitation.revoked"])
    def test_audit_entries(self, tokens, action):
        d = requests.get(f"{BASE}/admin/audit", headers=H(tokens, ADMIN_EMAIL), params={"q": action}).json()
        assert any(x["action"] == action for x in d)
