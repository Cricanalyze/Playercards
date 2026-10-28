# ruff: noqa: F811
# RivalCard extra regression tests (testing agent iteration 1): staff invite accept, premium_card grant rules,
# saved-card limits/isolation, admin users filters, admin sports/templates/plans CRUD, audit hygiene
import pytest
import requests

from test_rivalcard_api import BASE, ADMIN_EMAIL, PLAYER_EMAIL, STAFF_EMAIL, H, ids, tokens, mdb  # noqa: F401

CARD = {"title": "TEST_lim", "sport_id": "cricket", "template_id": "classic_athlete", "data": {"name": "T"}}


# ---------- invitations: staff accepts ----------
class TestStaffInvite:
    def test_staff_accept_and_reuse(self, tokens, ids):
        A = H(tokens, ADMIN_EMAIL)
        sid = ids[STAFF_EMAIL]
        try:
            inv = requests.post(f"{BASE}/admin/invitations", headers=A, json={"email": STAFF_EMAIL, "role": "support", "expires_hours": 24}).json()
            assert "token" in inv and len(inv["token"]) > 20
            v = requests.get(f"{BASE}/invitations/{inv['token']}").json()
            assert v["email_hint"].startswith("s***@") and v["role"] == "support"
            # player (different email) gets 403
            assert requests.post(f"{BASE}/invitations/accept", headers=H(tokens, PLAYER_EMAIL), json={"token": inv["token"]}).status_code == 403
            r = requests.post(f"{BASE}/invitations/accept", headers=H(tokens, STAFF_EMAIL), json={"token": inv["token"]})
            assert r.status_code == 200 and r.json()["role"] == "support"
            me = requests.get(f"{BASE}/me", headers=H(tokens, STAFF_EMAIL)).json()["member"]
            assert me["role"] == "support" and set(me["perms"]) == {"users.view", "subscriptions.view"}
            assert requests.get(f"{BASE}/admin/users", headers=H(tokens, STAFF_EMAIL)).status_code == 200
            assert requests.get(f"{BASE}/admin/metrics", headers=H(tokens, STAFF_EMAIL)).status_code == 403
            # reuse
            assert requests.post(f"{BASE}/invitations/accept", headers=H(tokens, STAFF_EMAIL), json={"token": inv["token"]}).status_code == 400
            # audit hygiene - no raw token in audit logs
            logs = requests.get(f"{BASE}/admin/audit", headers=A, params={"q": "invitation"}).json()
            assert inv["token"] not in str(logs)
            assert "invitation.accepted" in {x["action"] for x in logs}
        finally:
            requests.patch(f"{BASE}/admin/users/{sid}/role", headers=A, json={"role": "user", "confirm_email": ADMIN_EMAIL})


# ---------- premium_card grant ----------
class TestPremiumCardGrant:
    def test_requires_eligible_template(self, tokens, ids):
        A, pid = H(tokens, ADMIN_EMAIL), ids[PLAYER_EMAIL]
        r = requests.post(f"{BASE}/admin/subscriptions", headers=A, json={"user_id": pid, "plan_id": "premium_card"})
        assert r.status_code == 400
        r = requests.post(f"{BASE}/admin/subscriptions", headers=A, json={"user_id": pid, "plan_id": "premium_card", "template_id": "classic_athlete"})
        assert r.status_code == 400
        r = requests.post(f"{BASE}/admin/subscriptions", headers=A, json={"user_id": pid, "plan_id": "nope"})
        assert r.status_code == 400
        r = requests.post(f"{BASE}/admin/subscriptions", headers=A, json={"user_id": "user_doesnotexist", "plan_id": "pro_creator"})
        assert r.status_code == 404

    def test_player_has_no_active_subs(self, tokens):
        me = requests.get(f"{BASE}/me", headers=H(tokens, PLAYER_EMAIL)).json()
        assert me["entitlements"]["plan_ids"] == ["free"], me["entitlements"]
        e = requests.post(f"{BASE}/cards/export", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "cricket", "template_id": "classic_athlete", "format": "story"})
        assert e.status_code == 200 and e.json() == {"allowed": True, "watermark": True}


# ---------- saved cards ----------
class TestSavedCards:
    def test_limit_and_isolation(self, tokens, mdb, ids):
        P, S = H(tokens, PLAYER_EMAIL), H(tokens, STAFF_EMAIL)
        mdb.saved_cards.delete_many({"user_id": ids[PLAYER_EMAIL]})
        created = []
        try:
            for i in range(5):
                r = requests.post(f"{BASE}/me/cards", headers=P, json={**CARD, "title": f"TEST_lim{i}"})
                assert r.status_code == 200, r.text
                created.append(r.json()["id"])
            r6 = requests.post(f"{BASE}/me/cards", headers=P, json=CARD)
            assert r6.status_code == 402
            cid = created[0]
            assert requests.put(f"{BASE}/me/cards/{cid}", headers=S, json=CARD).status_code == 404
            assert requests.delete(f"{BASE}/me/cards/{cid}", headers=S).status_code == 404
            assert all(c["id"] not in created for c in requests.get(f"{BASE}/me/cards", headers=S).json())
            up = requests.put(f"{BASE}/me/cards/{cid}", headers=P, json={**CARD, "title": "TEST_upd"})
            assert up.status_code == 200
            got = [c for c in requests.get(f"{BASE}/me/cards", headers=P).json() if c["id"] == cid][0]
            assert got["title"] == "TEST_upd"
        finally:
            for c in created:
                requests.delete(f"{BASE}/me/cards/{c}", headers=P)

    def test_card_validation(self, tokens):
        r = requests.post(f"{BASE}/me/cards", headers=H(tokens, PLAYER_EMAIL), json={"sport_id": "x", "template_id": "y"})
        assert r.status_code == 422
        assert requests.get(f"{BASE}/me/cards").status_code == 401


# ---------- admin users filters ----------
class TestAdminUsers:
    def test_filters(self, tokens):
        A = H(tokens, ADMIN_EMAIL)
        d = requests.get(f"{BASE}/admin/users", headers=A, params={"role": "super_admin"}).json()
        assert d["total"] >= 1 and all(u["role"] == "super_admin" for u in d["users"])
        d = requests.get(f"{BASE}/admin/users", headers=A, params={"status": "active", "sort": "email", "page": 1}).json()
        emails = [u["email"] for u in d["users"]]
        assert emails == sorted(emails) and d["page"] == 1 and d["pages"] >= 1
        d = requests.get(f"{BASE}/admin/users", headers=A, params={"page": 99}).json()
        assert d["users"] == []
        d = requests.get(f"{BASE}/admin/users", headers=A, params={"q": ".*"}).json()
        assert d["total"] == 0  # regex escaped

    def test_user_detail(self, tokens, ids):
        d = requests.get(f"{BASE}/admin/users/{ids[PLAYER_EMAIL]}", headers=H(tokens, ADMIN_EMAIL)).json()
        assert d["user"]["email"] == PLAYER_EMAIL and "entitlements" in d and "_id" not in d["user"]

    def test_soft_delete_confirm_mismatch(self, tokens, ids):
        r = requests.post(f"{BASE}/admin/users/{ids[PLAYER_EMAIL]}/soft-delete", headers=H(tokens, ADMIN_EMAIL), json={"confirm_email": "wrong@example.com"})
        assert r.status_code == 400

    def test_meta_user_forbidden(self, tokens):
        assert requests.get(f"{BASE}/admin/meta", headers=H(tokens, PLAYER_EMAIL)).status_code == 403
        m = requests.get(f"{BASE}/admin/meta", headers=H(tokens, ADMIN_EMAIL)).json()
        assert "super_admin" in m["assignable_roles"] and len(m["layouts"]) >= 8


# ---------- admin catalog ----------
class TestCatalog:
    def test_sport_lifecycle(self, tokens, mdb):
        A = H(tokens, ADMIN_EMAIL)
        mdb.sports.delete_many({"id": "test_zorbing"})
        body = {"name": "TEST Zorbing", "category": "individual", "kind": "individual", "stats": [{"key": "rolls", "label": "Rolls"}]}
        r = requests.post(f"{BASE}/admin/sports", headers=A, json=body)
        assert r.status_code == 200 and r.json()["id"] == "test_zorbing"
        assert requests.post(f"{BASE}/admin/sports", headers=A, json=body).status_code == 409
        assert any(s["id"] == "test_zorbing" for s in requests.get(f"{BASE}/sports").json())
        upd = {**body, "stats": [{"key": "rolls", "label": "Rolls"}, {"key": "wins", "label": "Wins"}], "active": False}
        assert requests.put(f"{BASE}/admin/sports/test_zorbing", headers=A, json=upd).status_code == 200
        assert not any(s["id"] == "test_zorbing" for s in requests.get(f"{BASE}/sports").json())
        assert len(mdb.sports.find_one({"id": "test_zorbing"})["stats"]) == 2
        assert requests.post(f"{BASE}/admin/sports", headers=A, json={**body, "stats": []}).status_code == 422
        mdb.sports.delete_many({"id": "test_zorbing"})

    def test_template_invalid_layout(self, tokens):
        A = H(tokens, ADMIN_EMAIL)
        tpl = [t for t in requests.get(f"{BASE}/admin/templates", headers=A).json() if t["id"] == "classic_athlete"][0]
        body = {k: tpl[k] for k in ("name", "badge", "layout", "tier", "description", "accent", "sports", "recommended", "watermark_free", "active", "order") if k in tpl}
        assert requests.put(f"{BASE}/admin/templates/classic_athlete", headers=A, json={**body, "layout": "bogus"}).status_code == 422
        assert requests.put(f"{BASE}/admin/templates/classic_athlete", headers=A, json={**body, "accent": "red"}).status_code == 422
        assert requests.put(f"{BASE}/admin/templates/classic_athlete", headers=A, json=body).status_code == 200

    def test_plan_price_snapshot(self, tokens, ids):
        A, pid = H(tokens, ADMIN_EMAIL), ids[PLAYER_EMAIL]
        plan = [p for p in requests.get(f"{BASE}/admin/plans", headers=A).json() if p["id"] == "pro_creator"][0]
        body = {k: plan[k] for k in ("name", "type", "price_inr", "interval", "default_days", "trial_days", "description", "features", "terms", "entitlements", "eligible_templates", "active", "order") if k in plan}
        old_price = plan["price_inr"]
        sub = requests.post(f"{BASE}/admin/subscriptions", headers=A, json={"user_id": pid, "plan_id": "pro_creator", "days": 2}).json()
        try:
            assert requests.put(f"{BASE}/admin/plans/pro_creator", headers=A, json={**body, "price_inr": old_price + 111}).status_code == 200
            assert [p for p in requests.get(f"{BASE}/plans").json() if p["id"] == "pro_creator"][0]["price_inr"] == old_price + 111
            s = [x for x in requests.get(f"{BASE}/admin/subscriptions", headers=A, params={"user_id": pid}).json() if x["id"] == sub["id"]][0]
            assert s["plan_snapshot"]["price_inr"] == old_price
        finally:
            requests.put(f"{BASE}/admin/plans/pro_creator", headers=A, json=body)
            requests.post(f"{BASE}/admin/subscriptions/{sub['id']}/cancel", headers=A, json={"immediate": True})
        assert [p for p in requests.get(f"{BASE}/plans").json() if p["id"] == "pro_creator"][0]["price_inr"] == old_price

    def test_catalog_forbidden_for_user(self, tokens):
        P = H(tokens, PLAYER_EMAIL)
        for p in ("sports", "templates", "plans", "audit", "invitations", "subscriptions"):
            assert requests.get(f"{BASE}/admin/{p}", headers=P).status_code == 403, p
