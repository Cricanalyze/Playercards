# Probe: a future-dated admin grant should become active once start_at passes
import json, time, requests
from datetime import datetime, timezone, timedelta
BASE = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0] + "/api"
t = json.load(open("/tmp/tokens.json"))
h = {"Authorization": f"Bearer {t['admin']}"}
fh = {"Authorization": f"Bearer {t['free']}"}
uid = requests.get(f"{BASE}/me", headers=fh).json()["member"]["user_id"]
start = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
end = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
r = requests.post(f"{BASE}/admin/subscriptions", headers=h, json={"user_id": uid, "plan_id": "pro", "start_at": start, "end_at": end, "note": "TEST_pending"})
print("grant", r.status_code, r.json().get("status"))
sid = r.json()["id"]
time.sleep(10)
e = requests.get(f"{BASE}/me", headers=fh).json()["entitlements"]
print("after start passed -> plan", e["plan_id"])
subs = requests.get(f"{BASE}/admin/subscriptions", headers=h, params={"user_id": uid}).json()
print([(s["id"] == sid, s["status"]) for s in subs][:3])
requests.post(f"{BASE}/admin/subscriptions/{sid}/extend", headers=h, json={"days": 1})
requests.post(f"{BASE}/admin/subscriptions/{sid}/cancel", headers=h, json={"immediate": True})
print("cleanup plan", requests.get(f"{BASE}/me", headers=fh).json()["entitlements"]["plan_id"])
