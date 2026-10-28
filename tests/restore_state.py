# Restores test-user state: revokes player's active subs, ensures staff role user, prints summary
import sys
import requests
sys.path.insert(0, "/app/backend/tests")
sys.path.insert(0, "/app/scripts")
import clerk_users
from test_rivalcard_api import BASE, ADMIN_EMAIL, PLAYER_EMAIL, STAFF_EMAIL

ids = {e: clerk_users.ensure(e, p) for e, p in clerk_users.USERS}
A = {"Authorization": "Bearer " + clerk_users.token(ids[ADMIN_EMAIL])}
for s in requests.get(f"{BASE}/admin/subscriptions", headers=A, params={"user_id": ids[PLAYER_EMAIL]}).json():
    if s["status"] in ("active", "trialing", "past_due"):
        print("revoke", s["id"], requests.post(f"{BASE}/admin/subscriptions/{s['id']}/cancel", headers=A, json={"immediate": True}).status_code)
for email in (PLAYER_EMAIL, STAFF_EMAIL, ADMIN_EMAIL):
    d = requests.get(f"{BASE}/admin/users/{ids[email]}", headers=A).json()
    print(email, d["user"]["role"], d["user"]["status"], d["entitlements"]["plan_ids"], "saved:", d["saved_cards"])
