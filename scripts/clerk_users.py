import os, json, urllib.request, urllib.parse, sys
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]
def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))
def ensure(email, pw):
    found = bapi("/users?email_address=" + urllib.parse.quote(email), method="GET")
    if found: return found[0]["id"]
    return bapi("/users", {"email_address": [email], "password": pw, "skip_password_checks": True})["id"]
def token(uid):
    s = bapi("/sessions", {"user_id": uid})
    return bapi(f"/sessions/{s['id']}/tokens", {"expires_in_seconds": 3600})["jwt"]
USERS = [("admin@playercard.app", "admin123"), ("player+clerk_test@example.com", "Test-pass-12345!"), ("staff+clerk_test@example.com", "Test-pass-12345!")]
if __name__ == "__main__":
    ids = {e: ensure(e, p) for e, p in USERS}
    if len(sys.argv) > 1 and sys.argv[1] == "tokens":
        print(json.dumps({e: token(i) for e, i in ids.items()}))
    else:
        print(json.dumps(ids))
