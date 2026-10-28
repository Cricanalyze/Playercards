import json
import os
import sys
import urllib.parse
import urllib.request

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
SK = os.environ.get("CLERK_SECRET_KEY") or os.environ["CLERK_OWN_SECRET_KEY"]
BASE = os.environ["REACT_APP_BACKEND_URL"] + "/api"
PW = "Rival-QA-2026!"
USERS = {"admin": "qa.admin+clerk_test@example.com", "free": "qa.free+clerk_test@example.com", "basic": "qa.basic+clerk_test@example.com",
         "pro": "qa.pro+clerk_test@example.com", "team": "qa.team+clerk_test@example.com"}


def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "rivalcard-qa"})
    return json.load(urllib.request.urlopen(req))


def ensure(email):
    found = bapi("/users?email_address=" + urllib.parse.quote(email), method="GET")
    if found:
        return found[0]["id"]
    return bapi("/users", {"email_address": [email], "password": PW, "skip_password_checks": True})["id"]


def token(uid):
    s = bapi("/sessions", {"user_id": uid})
    return bapi(f"/sessions/{s['id']}/tokens", {"expires_in_seconds": 3600})["jwt"]


def main():
    ids = {k: ensure(e) for k, e in USERS.items()}
    toks = {k: token(i) for k, i in ids.items()}
    if len(sys.argv) > 1 and sys.argv[1] == "tokens":
        print(json.dumps(toks))
        return
    for t in toks.values():
        requests.get(f"{BASE}/me", headers={"Authorization": f"Bearer {t}"}, timeout=20)
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db.users.update_one({"user_id": ids["admin"]}, {"$set": {"role": "super_admin", "permissions": None}})
    A = {"Authorization": f"Bearer {toks['admin']}"}
    for plan in ("basic", "pro", "team"):
        if not db.subscriptions.find_one({"user_id": ids[plan], "plan_id": plan, "status": "active"}):
            r = requests.post(f"{BASE}/admin/subscriptions", headers=A, timeout=20, json={"user_id": ids[plan], "plan_id": plan, "cycle": "month", "source": "complimentary", "note": "QA account"})
            print(plan, r.status_code)
    print(json.dumps(ids))


if __name__ == "__main__":
    main()
