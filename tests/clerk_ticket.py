# Prints a Clerk sign-in ticket URL for a test user (usage: python3 clerk_ticket.py <email>)
import sys
sys.path.insert(0, "/app/scripts")
import clerk_users

email = sys.argv[1]
pw = dict(clerk_users.USERS)[email]
uid = clerk_users.ensure(email, pw)
t = clerk_users.bapi("/sign_in_tokens", {"user_id": uid, "expires_in_seconds": 600})
print(t["token"])
