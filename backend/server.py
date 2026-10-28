import hashlib
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

try:
    from backend.clerk_auth import clerk_router, require_user
    from backend.seed_data import SPORTS, TEMPLATES, PLANS, LAYOUTS
    from backend.rbac import ROLES, RANK, PERMISSIONS, ROLE_DEFAULTS, STAFF_ROLES, RETIRED_ROLES, effective_role, effective_perms
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user
    from seed_data import SPORTS, TEMPLATES, PLANS, LAYOUTS
    from rbac import ROLES, RANK, PERMISSIONS, ROLE_DEFAULTS, STAFF_ROLES, RETIRED_ROLES, effective_role, effective_perms

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="RivalCard API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("rivalcard")
logging.basicConfig(level=logging.INFO)

ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}
NOFIELDS = {"_id": 0}
ACTIVE_STATES = ["active", "trialing", "past_due"]
SUB_STATES = ["pending", "trialing", "active", "past_due", "canceled", "expired", "refunded"]


def now():
    return datetime.now(timezone.utc)


def iso(dt=None):
    return (dt or now()).isoformat()


def new_id():
    return str(uuid.uuid4())


# ---------- rate limiting (in-memory, per process) ----------
_hits: dict = {}


def rate_limit(request: Request, bucket: str, limit: int, window: int = 60):
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    key, t = f"{bucket}:{ip}", time.time()
    arr = [x for x in _hits.get(key, []) if t - x < window]
    if len(arr) >= limit:
        raise HTTPException(429, "Too many requests. Please wait a minute and try again.")
    arr.append(t)
    _hits[key] = arr


# ---------- Clerk backend helpers ----------
def _clerk(method, path, **kw):
    r = requests.request(method, f"https://api.clerk.com/v1{path}", timeout=10,
                         headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "rivalcard-app"}, **kw)
    r.raise_for_status()
    return r.json()


def clerk_profile(user_id: str) -> dict:
    u = _clerk("GET", f"/users/{user_id}")
    verified = [e["email_address"].lower() for e in u.get("email_addresses", [])
                if (e.get("verification") or {}).get("status") == "verified"]
    primary = next((e["email_address"] for e in u.get("email_addresses", []) if e["id"] == u.get("primary_email_address_id")), "")
    name = " ".join(x for x in [u.get("first_name"), u.get("last_name")] if x) or primary.split("@")[0]
    return {"email": primary.lower(), "verified": verified, "name": name, "last_sign_in_at": u.get("last_sign_in_at")}


def revoke_clerk_sessions(user_id: str) -> int:
    sessions = _clerk("GET", "/sessions", params={"user_id": user_id, "status": "active"})
    for s in sessions:
        _clerk("POST", f"/sessions/{s['id']}/revoke")
    return len(sessions)


# ---------- members / auth ----------
async def _load_member(user: dict) -> dict:
    uid = user["user_id"]
    m = await db.users.find_one({"user_id": uid}, NOFIELDS)
    if m is None or not m.get("role"):
        prof = clerk_profile(uid)
        admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
        role = "super_admin" if admins & set(prof["verified"]) else "user"
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        m = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "email": prof["email"], "name": prof["name"],
                              "status": "active", "permissions": None, "favorite_templates": [], "created_at": iso()}},
            upsert=True, projection=NOFIELDS, return_document=ReturnDocument.AFTER)
        if role == "super_admin":
            await audit({"user_id": uid, "email": prof["email"]}, "owner.bootstrap", uid, {"role": role})
    await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV, "last_seen_at": iso()}})
    if m.get("status") in ("suspended", "deleted"):
        raise HTTPException(403, f"This account is {m['status']}. Contact support.")
    role = effective_role(m["role"])
    return {**m, "env": ENV, "role": role, "perms": effective_perms(role, m.get("permissions"))}


async def current_member(user: dict = Depends(require_user)) -> dict:
    return await _load_member(user)


async def optional_member(request: Request) -> Optional[dict]:
    if not request.headers.get("authorization"):
        return None
    return await _load_member(require_user(request))


def require_perm(perm: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if perm not in member["perms"]:
            raise HTTPException(403, "Not allowed")
        return member
    return check


async def audit(actor: dict, action: str, target: str = "", details: Optional[dict] = None):
    await db.audit_logs.insert_one({"id": new_id(), "actor_id": actor.get("user_id"), "actor_email": actor.get("email"),
                                    "action": action, "target": target, "details": details or {}, "at": iso()})


# ---------- entitlements (single source of truth) ----------
async def expire_sweep():
    t = iso()
    await db.subscriptions.update_many(
        {"status": {"$in": ACTIVE_STATES}, "end_at": {"$ne": None, "$lt": t}},
        {"$set": {"status": "expired"}, "$push": {"history": {"at": t, "event": "expired", "by": "system"}}})


async def active_subs(user_id: str) -> list:
    await expire_sweep()
    return await db.subscriptions.find({"user_id": user_id, "status": {"$in": ACTIVE_STATES}}, NOFIELDS).to_list(100)


async def get_entitlements(member: Optional[dict]) -> dict:
    free = await db.plans.find_one({"id": "free"}, NOFIELDS) or PLANS[0]
    ent = {"plan_ids": ["free"], "all_premium_templates": False, "premium_templates": [], "remove_watermark": False,
           "saved_cards": free["entitlements"]["saved_cards"], "team_cards": 0, "sources": []}
    if not member:
        return ent
    for s in await active_subs(member["user_id"]):
        e = s["plan_snapshot"]["entitlements"]
        ent["plan_ids"].append(s["plan_id"])
        ent["sources"].append({"plan": s["plan_snapshot"]["name"], "source": s["source"], "end_at": s.get("end_at")})
        ent["all_premium_templates"] |= bool(e.get("all_premium_templates"))
        ent["remove_watermark"] |= bool(e.get("remove_watermark"))
        ent["saved_cards"] = max(ent["saved_cards"], e.get("saved_cards", 0))
        ent["team_cards"] += e.get("team_cards", 0)
        if s.get("template_id"):
            ent["premium_templates"].append(s["template_id"])
    return ent


def can_use_template(tpl: dict, ent: dict) -> bool:
    return tpl["tier"] == "free" or ent["all_premium_templates"] or tpl["id"] in ent["premium_templates"]


# ---------- startup ----------
@app.on_event("startup")
async def startup():
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    for coll, items in (("sports", SPORTS), ("templates", TEMPLATES), ("plans", PLANS)):
        for it in items:
            await db[coll].update_one({"id": it["id"]}, {"$setOnInsert": it}, upsert=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email")
    await db.subscriptions.create_index([("user_id", 1), ("status", 1)])
    await db.events.create_index([("type", 1), ("at", -1)])
    await db.audit_logs.create_index("at")
    await db.admin_invitations.create_index("token_hash", unique=True)
    await db.saved_cards.create_index("user_id")


# ---------- public ----------
@api.get("/")
async def root():
    return {"app": "RivalCard", "ok": True}


@api.get("/sports")
async def list_sports():
    return await db.sports.find({"active": True}, NOFIELDS).sort("order", 1).to_list(500)


@api.get("/templates")
async def list_templates():
    return await db.templates.find({"active": True}, NOFIELDS).sort("order", 1).to_list(200)


@api.get("/plans")
async def list_plans():
    return await db.plans.find({"active": True}, NOFIELDS).sort("order", 1).to_list(50)


class EventIn(BaseModel):
    type: str = Field(pattern="^(card_created)$")
    sport_id: str = Field(max_length=60)
    template_id: str = Field(max_length=60)


@api.post("/events")
async def track_event(body: EventIn, request: Request):
    rate_limit(request, "events", 30)
    member = await optional_member(request)
    await db.events.insert_one({"id": new_id(), **body.model_dump(), "user_id": member and member["user_id"], "at": iso()})
    return {"ok": True}


class ExportIn(BaseModel):
    sport_id: str = Field(max_length=60)
    template_id: str = Field(max_length=60)
    format: str = Field(pattern="^(card|story)$")


@api.post("/cards/export")
async def authorize_export(body: ExportIn, request: Request):
    rate_limit(request, "export", 40)
    member = await optional_member(request)
    tpl = await db.templates.find_one({"id": body.template_id, "active": True}, NOFIELDS)
    if not tpl:
        raise HTTPException(404, "Template not found")
    ent = await get_entitlements(member)
    if not can_use_template(tpl, ent):
        raise HTTPException(402, "This is a premium template. Upgrade or choose a free template to download.")
    await db.events.insert_one({"id": new_id(), "type": "card_downloaded", "sport_id": body.sport_id,
                                "template_id": body.template_id, "format": body.format,
                                "user_id": member and member["user_id"], "at": iso()})
    return {"allowed": True, "watermark": not ent["remove_watermark"]}


class ReportIn(BaseModel):
    target: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=3, max_length=1000)
    contact: str = Field(default="", max_length=200)


@api.post("/reports")
async def create_report(body: ReportIn, request: Request):
    rate_limit(request, "reports", 5)
    member = await optional_member(request)
    await db.moderation_reports.insert_one({"id": new_id(), **body.model_dump(), "status": "open",
                                            "reporter_id": member and member["user_id"], "created_at": iso()})
    return {"ok": True}


# ---------- me ----------
@api.get("/me")
async def me(member: dict = Depends(current_member)):
    subs = await db.subscriptions.find({"user_id": member["user_id"]}, NOFIELDS).sort("created_at", -1).to_list(100)
    return {"member": {k: member.get(k) for k in ("user_id", "email", "name", "role", "perms", "status", "created_at", "favorite_templates")},
            "entitlements": await get_entitlements(member), "subscriptions": subs,
            "payments": await db.payments.find({"user_id": member["user_id"]}, NOFIELDS).to_list(100)}


class FavIn(BaseModel):
    template_ids: List[str] = Field(max_length=20)


@api.put("/me/favorites")
async def set_favorites(body: FavIn, member: dict = Depends(current_member)):
    valid = [t for t in body.template_ids if await db.templates.find_one({"id": t})]
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"favorite_templates": valid}})
    return {"favorite_templates": valid}


class CardIn(BaseModel):
    title: str = Field(default="", max_length=80)
    sport_id: str = Field(max_length=60)
    template_id: str = Field(max_length=60)
    data: dict

    @field_validator("data")
    @classmethod
    def small(cls, v):
        if len(str(v)) > 20000:
            raise ValueError("Card data too large")
        v.pop("photo", None)
        return v


@api.get("/me/cards")
async def my_cards(member: dict = Depends(current_member)):
    return await db.saved_cards.find({"user_id": member["user_id"]}, NOFIELDS).sort("updated_at", -1).to_list(500)


@api.post("/me/cards")
async def save_card(body: CardIn, member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    if await db.saved_cards.count_documents({"user_id": member["user_id"]}) >= ent["saved_cards"]:
        raise HTTPException(402, f"Your plan allows {ent['saved_cards']} saved cards. Delete one or upgrade.")
    doc = {"id": new_id(), "user_id": member["user_id"], **body.model_dump(), "created_at": iso(), "updated_at": iso()}
    await db.saved_cards.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/me/cards/{card_id}")
async def update_card(card_id: str, body: CardIn, member: dict = Depends(current_member)):
    r = await db.saved_cards.update_one({"id": card_id, "user_id": member["user_id"]},
                                        {"$set": {**body.model_dump(), "updated_at": iso()}})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/me/cards/{card_id}")
async def delete_card(card_id: str, member: dict = Depends(current_member)):
    if not (await db.saved_cards.delete_one({"id": card_id, "user_id": member["user_id"]})).deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


async def _is_last_super(user_id: str) -> bool:
    return await db.users.count_documents({"role": "super_admin", "status": "active", "user_id": {"$ne": user_id}, **IN_ENV}) == 0


@api.delete("/me")
async def delete_me(member: dict = Depends(current_member)):
    if member["role"] == "super_admin" and await _is_last_super(member["user_id"]):
        raise HTTPException(409, "You are the last Super Admin. Transfer ownership first.")
    await db.saved_cards.delete_many({"user_id": member["user_id"]})
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"status": "deleted", "deleted_at": iso(), "name": "Deleted user"}})
    await audit(member, "account.self_delete", member["user_id"])
    return {"ok": True}


# ---------- invitations ----------
def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@api.get("/invitations/{token}")
async def view_invitation(token: str, request: Request):
    rate_limit(request, "invite_view", 20)
    inv = await db.admin_invitations.find_one({"token_hash": _hash(token)}, NOFIELDS)
    if not inv:
        raise HTTPException(404, "Invitation not found")
    email = inv["email"]
    masked = email[0] + "***" + email[email.index("@"):]
    expired = inv["expires_at"] < iso()
    return {"email_hint": masked, "role": inv["role"], "status": "expired" if expired and inv["status"] == "pending" else inv["status"],
            "expires_at": inv["expires_at"]}


class AcceptIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


@api.post("/invitations/accept")
async def accept_invitation(body: AcceptIn, request: Request, member: dict = Depends(current_member)):
    rate_limit(request, "invite_accept", 10)
    inv = await db.admin_invitations.find_one({"token_hash": _hash(body.token)}, NOFIELDS)
    if not inv or inv["status"] != "pending" or inv["expires_at"] < iso():
        raise HTTPException(400, "This invitation is invalid, used, revoked or expired.")
    if inv["email"] not in clerk_profile(member["user_id"])["verified"]:
        raise HTTPException(403, "Sign in with the verified email address this invitation was sent to.")
    r = await db.admin_invitations.update_one({"id": inv["id"], "status": "pending"},
                                              {"$set": {"status": "accepted", "accepted_by": member["user_id"], "accepted_at": iso()}})
    if not r.modified_count:
        raise HTTPException(400, "Invitation already used.")
    if RANK[inv["role"]] > RANK[member["role"]]:
        await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"role": inv["role"], "permissions": inv["permissions"]}})
    await audit(member, "invitation.accepted", member["user_id"], {"role": inv["role"], "invitation": inv["id"]})
    return {"ok": True, "role": inv["role"]}


# ---------- admin: analytics ----------
admin = APIRouter(prefix="/api/admin")


@admin.get("/meta")
async def admin_meta(member: dict = Depends(current_member)):
    if not member["perms"]:
        raise HTTPException(403, "Not allowed")
    return {"roles": ROLES, "staff_roles": STAFF_ROLES, "permissions": PERMISSIONS, "role_defaults": ROLE_DEFAULTS,
            "assignable_roles": [r for r in ROLES if RANK[r] < RANK[member["role"]] or member["role"] == "super_admin"],
            "my_perms": member["perms"], "my_role": member["role"], "sub_states": SUB_STATES, "layouts": LAYOUTS}


def _range(frm: Optional[str], to: Optional[str]) -> dict:
    q = {}
    if frm:
        q["$gte"] = frm
    if to:
        q["$lte"] = to + "T23:59:59.999999+00:00" if len(to) == 10 else to
    return q


async def _top(coll_filter: dict, field: str):
    rows = await db.events.aggregate([{"$match": coll_filter}, {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
                                      {"$sort": {"count": -1}}, {"$limit": 8}]).to_list(8)
    return [{"id": r["_id"], "count": r["count"]} for r in rows]


@admin.get("/metrics")
async def metrics(frm: Optional[str] = None, to: Optional[str] = None, member: dict = Depends(require_perm("analytics.view"))):
    await expire_sweep()
    rng = _range(frm, to)
    at = {"at": rng} if rng else {}
    users_q = {**IN_ENV, "status": {"$ne": "deleted"}}
    premium_ids = await db.subscriptions.distinct("user_id", {"status": {"$in": ACTIVE_STATES}})
    total = await db.users.count_documents(users_q)
    premium = await db.users.count_documents({**users_q, "user_id": {"$in": premium_ids}})
    active_since = iso(now() - timedelta(days=30))
    pay = lambda st: {"status": st, **({"created_at": rng} if rng else {})}
    gross = await db.payments.aggregate([{"$match": pay("captured")}, {"$group": {"_id": None, "s": {"$sum": "$amount_inr"}}}]).to_list(1)
    refunds = await db.payments.aggregate([{"$match": pay("refunded")}, {"$group": {"_id": None, "s": {"$sum": "$amount_inr"}}}]).to_list(1)
    paid_recurring = await db.subscriptions.find({"status": {"$in": ["active", "past_due"]}, "source": "payment",
                                                  "plan_snapshot.type": "subscription"}, NOFIELDS).to_list(10000)
    mrr = sum(s["plan_snapshot"]["price_inr"] / (12 if s["plan_snapshot"].get("interval") == "year" else 1) for s in paid_recurring)
    g, r = (gross[0]["s"] if gross else 0), (refunds[0]["s"] if refunds else 0)
    sub_count = lambda st: db.subscriptions.count_documents({"status": st})
    return {
        "users": {"total": total, "new": await db.users.count_documents({**users_q, **({"created_at": rng} if rng else {"created_at": {"$gte": active_since}})}),
                  "active_30d": await db.users.count_documents({**users_q, "last_seen_at": {"$gte": active_since}}),
                  "free": total - premium, "premium": premium,
                  "suspended": await db.users.count_documents({**IN_ENV, "status": "suspended"})},
        "subscriptions": {"active": await db.subscriptions.count_documents({"status": {"$in": ACTIVE_STATES}}),
                          "expired": await sub_count("expired"), "canceled": await sub_count("canceled"),
                          "by_source": {s: await db.subscriptions.count_documents({"status": {"$in": ACTIVE_STATES}, "source": s})
                                        for s in ("payment", "promotion", "complimentary")}},
        "payments": {"successful": await db.payments.count_documents(pay("captured")), "failed": await db.payments.count_documents(pay("failed")),
                     "gross_inr": g, "refunds_inr": r, "net_inr": g - r, "mrr_inr": round(mrr, 2), "gateway": "not_configured"},
        "cards": {"created": await db.events.count_documents({"type": "card_created", **at}),
                  "downloaded": await db.events.count_documents({"type": "card_downloaded", **at})},
        "popular_sports": await _top({"type": "card_created", **at}, "sport_id"),
        "popular_templates": await _top({"type": "card_downloaded", **at}, "template_id"),
        "definitions": {"active_30d": "Signed-in users who made an authenticated request in the last 30 days.",
                        "new": "Accounts created in the selected range (default: last 30 days).",
                        "mrr": "Monthly value of active paid recurring subscriptions only (excludes complimentary/promotion).",
                        "net": "Gross captured payments minus refunds (before gateway fees)."},
    }


# ---------- admin: users ----------
@admin.get("/users")
async def admin_users(q: str = "", role: str = "", status: str = "", page: int = 1, sort: str = "-created_at",
                      member: dict = Depends(require_perm("users.view"))):
    f = {**IN_ENV}
    if q:
        import re
        rx = {"$regex": re.escape(q[:80]), "$options": "i"}
        f["$or"] = [{"email": rx}, {"name": rx}, {"user_id": rx}]
    if role in ROLES:
        f["role"] = role
    elif role == "staff":
        f["role"] = {"$in": STAFF_ROLES}
    if status in ("active", "suspended", "deleted"):
        f["status"] = status
    field = sort.lstrip("-") if sort.lstrip("-") in ("created_at", "last_seen_at", "email", "name") else "created_at"
    size, page = 20, max(1, page)
    total = await db.users.count_documents(f)
    rows = await db.users.find(f, NOFIELDS).sort(field, -1 if sort.startswith("-") else 1).skip((page - 1) * size).limit(size).to_list(size)
    return {"total": total, "page": page, "pages": max(1, -(-total // size)),
            "users": [{**u, "role": effective_role(u.get("role"))} for u in rows]}


async def _target(user_id: str) -> dict:
    t = await db.users.find_one({"user_id": user_id, **IN_ENV}, NOFIELDS)
    if not t:
        raise HTTPException(404, "Not found")
    t["role"] = effective_role(t.get("role"))
    return t


def _guard_staff_target(actor: dict, target: dict):
    if target["user_id"] == actor["user_id"]:
        raise HTTPException(403, "You cannot perform this action on your own account.")
    if target["role"] != "user" and RANK[target["role"]] >= RANK[actor["role"]] and actor["role"] != "super_admin":
        raise HTTPException(403, "You cannot manage an account with an equal or higher role.")


@admin.get("/users/{user_id}")
async def admin_user_detail(user_id: str, member: dict = Depends(require_perm("users.view"))):
    t = await _target(user_id)
    t["perms"] = effective_perms(t["role"], t.get("permissions"))
    subs = await db.subscriptions.find({"user_id": user_id}, NOFIELDS).sort("created_at", -1).to_list(100)
    return {"user": t, "subscriptions": subs, "payments": await db.payments.find({"user_id": user_id}, NOFIELDS).to_list(100),
            "saved_cards": await db.saved_cards.count_documents({"user_id": user_id}),
            "entitlements": await get_entitlements(t)}


class UserPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    status: Optional[str] = Field(default=None, pattern="^(active|suspended)$")
    reason: str = Field(default="", max_length=300)


@admin.patch("/users/{user_id}")
async def admin_user_patch(user_id: str, body: UserPatch, member: dict = Depends(require_perm("users.manage"))):
    t = await _target(user_id)
    _guard_staff_target(member, t)
    upd = {k: v for k, v in body.model_dump(exclude={"reason"}).items() if v is not None}
    if upd.get("status") == "suspended" and t["role"] == "super_admin" and await _is_last_super(user_id):
        raise HTTPException(409, "Cannot suspend the last Super Admin.")
    if t.get("status") == "deleted":
        raise HTTPException(409, "Account is deleted.")
    await db.users.update_one({"user_id": user_id}, {"$set": upd})
    revoked = 0
    if upd.get("status") == "suspended":
        try:
            revoked = revoke_clerk_sessions(user_id)
        except requests.RequestException:
            logger.warning("session revoke failed for %s", user_id)
    action = {"suspended": "user.suspended", "active": "user.reactivated"}.get(upd.get("status"), "user.updated")
    await audit(member, action, user_id, {**upd, "reason": body.reason, "sessions_revoked": revoked})
    return {"ok": True, "sessions_revoked": revoked}


@admin.post("/users/{user_id}/revoke-sessions")
async def admin_revoke(user_id: str, member: dict = Depends(require_perm("users.manage"))):
    t = await _target(user_id)
    _guard_staff_target(member, t)
    try:
        n = revoke_clerk_sessions(user_id)
    except requests.RequestException:
        raise HTTPException(502, "Could not reach the auth provider. Try again.")
    await audit(member, "user.sessions_revoked", user_id, {"count": n})
    return {"revoked": n}


class ConfirmIn(BaseModel):
    confirm_email: str
    reason: str = Field(default="", max_length=300)


@admin.post("/users/{user_id}/soft-delete")
async def admin_soft_delete(user_id: str, body: ConfirmIn, member: dict = Depends(require_perm("users.manage"))):
    t = await _target(user_id)
    _guard_staff_target(member, t)
    if body.confirm_email.strip().lower() != (t.get("email") or "").lower():
        raise HTTPException(400, "Type the user's email exactly to confirm.")
    if t["role"] == "super_admin" and await _is_last_super(user_id):
        raise HTTPException(409, "Cannot delete the last Super Admin.")
    await db.saved_cards.delete_many({"user_id": user_id})
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "deleted", "deleted_at": iso(), "role": "user", "permissions": None}})
    try:
        revoke_clerk_sessions(user_id)
    except requests.RequestException:
        pass
    await audit(member, "user.soft_deleted", user_id, {"reason": body.reason})
    return {"ok": True}


class RoleIn(BaseModel):
    role: str
    permissions: Optional[List[str]] = None
    confirm_email: str


@admin.patch("/users/{user_id}/role")
async def admin_set_role(user_id: str, body: RoleIn, member: dict = Depends(require_perm("admins.manage"))):
    t = await _target(user_id)
    if body.role not in ROLES:
        raise HTTPException(400, "Unknown role")
    if user_id == member["user_id"]:
        raise HTTPException(403, "You cannot change your own role or permissions.")
    if body.confirm_email.strip().lower() != (member.get("email") or "").lower():
        raise HTTPException(400, "Re-enter your own email to confirm this sensitive action.")
    is_owner = member["role"] == "super_admin"
    if (body.role == "super_admin" or t["role"] == "super_admin") and not is_owner:
        raise HTTPException(403, "Only a Super Admin can grant or change Super Admin.")
    if not is_owner and (RANK[body.role] >= RANK[member["role"]] or RANK[t["role"]] >= RANK[member["role"]]):
        raise HTTPException(403, "You can only manage roles below your own.")
    perms = None if body.permissions is None else [p for p in body.permissions if p in PERMISSIONS]
    if perms is not None and not is_owner and not set(perms) <= set(member["perms"]):
        raise HTTPException(403, "You cannot grant permissions you do not have.")
    if t["role"] == "super_admin" and body.role != "super_admin" and await _is_last_super(user_id):
        raise HTTPException(409, "Keep at least one Super Admin.")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role, "permissions": perms}})
    await audit(member, "role.changed", user_id, {"from": t["role"], "to": body.role, "permissions": perms})
    return {"user_id": user_id, "role": body.role, "perms": effective_perms(body.role, perms)}


# ---------- admin: subscriptions ----------
@admin.get("/subscriptions")
async def admin_subs(status: str = "", user_id: str = "", member: dict = Depends(require_perm("subscriptions.view"))):
    await expire_sweep()
    f = {}
    if status in SUB_STATES:
        f["status"] = status
    if user_id:
        f["user_id"] = user_id
    subs = await db.subscriptions.find(f, NOFIELDS).sort("created_at", -1).to_list(500)
    emails = {u["user_id"]: u.get("email") for u in await db.users.find({"user_id": {"$in": [s["user_id"] for s in subs]}}, {"_id": 0, "user_id": 1, "email": 1}).to_list(1000)}
    return [{**s, "user_email": emails.get(s["user_id"])} for s in subs]


class GrantIn(BaseModel):
    user_id: str
    plan_id: str
    days: Optional[int] = Field(default=None, ge=1, le=3650)
    template_id: Optional[str] = None
    source: str = Field(default="complimentary", pattern="^(complimentary|promotion)$")
    note: str = Field(default="", max_length=300)


@admin.post("/subscriptions")
async def admin_grant(body: GrantIn, member: dict = Depends(require_perm("subscriptions.manage"))):
    t = await _target(body.user_id)
    if t.get("status") == "deleted":
        raise HTTPException(409, "Account is deleted.")
    plan = await db.plans.find_one({"id": body.plan_id}, NOFIELDS)
    if not plan or plan["type"] == "free":
        raise HTTPException(400, "Choose a paid plan to grant.")
    if plan["entitlements"].get("premium_template_choices"):
        if body.template_id not in plan.get("eligible_templates", []):
            raise HTTPException(400, "Pick one of this plan's eligible premium templates.")
    days = body.days or plan.get("default_days")
    sub = {"id": new_id(), "user_id": body.user_id, "plan_id": plan["id"], "template_id": body.template_id if plan["entitlements"].get("premium_template_choices") else None,
           "plan_snapshot": {k: plan[k] for k in ("name", "type", "price_inr", "interval", "entitlements")},
           "status": "active", "source": body.source, "granted_by": member["user_id"], "note": body.note,
           "start_at": iso(), "end_at": iso(now() + timedelta(days=days)) if days else None, "auto_renew": False,
           "created_at": iso(), "history": [{"at": iso(), "event": f"granted_{body.source}", "by": member["user_id"], "days": days}]}
    await db.subscriptions.insert_one(sub)
    sub.pop("_id", None)
    await audit(member, "subscription.granted", body.user_id, {"plan": plan["id"], "days": days, "source": body.source, "subscription": sub["id"]})
    return sub


class SubAction(BaseModel):
    days: Optional[int] = Field(default=None, ge=1, le=3650)
    immediate: bool = False
    note: str = Field(default="", max_length=300)


async def _sub(sub_id: str) -> dict:
    s = await db.subscriptions.find_one({"id": sub_id}, NOFIELDS)
    if not s:
        raise HTTPException(404, "Not found")
    return s


@admin.post("/subscriptions/{sub_id}/extend")
async def admin_extend(sub_id: str, body: SubAction, member: dict = Depends(require_perm("subscriptions.manage"))):
    s = await _sub(sub_id)
    if not body.days:
        raise HTTPException(400, "Days required")
    if s["status"] in ("refunded",):
        raise HTTPException(409, "Refunded subscriptions cannot be extended.")
    base = max(now(), datetime.fromisoformat(s["end_at"])) if s.get("end_at") else now()
    end = iso(base + timedelta(days=body.days))
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"end_at": end, "status": "active"},
                                                       "$push": {"history": {"at": iso(), "event": "extended", "by": member["user_id"], "days": body.days, "note": body.note}}})
    await audit(member, "subscription.extended", s["user_id"], {"subscription": sub_id, "days": body.days, "end_at": end})
    return {"ok": True, "end_at": end}


@admin.post("/subscriptions/{sub_id}/cancel")
async def admin_cancel(sub_id: str, body: SubAction, member: dict = Depends(require_perm("subscriptions.manage"))):
    s = await _sub(sub_id)
    if s["status"] not in ACTIVE_STATES:
        raise HTTPException(409, "Subscription is not active.")
    if body.immediate:
        upd, ev = {"status": "canceled", "end_at": iso(), "auto_renew": False}, "revoked"
    else:
        upd, ev = {"auto_renew": False, "cancel_at_period_end": True}, "renewal_canceled"
    await db.subscriptions.update_one({"id": sub_id}, {"$set": upd, "$push": {"history": {"at": iso(), "event": ev, "by": member["user_id"], "note": body.note}}})
    await audit(member, f"subscription.{ev}", s["user_id"], {"subscription": sub_id, "note": body.note})
    return {"ok": True}


@admin.get("/payments")
async def admin_payments(member: dict = Depends(require_perm("subscriptions.view"))):
    return await db.payments.find({}, NOFIELDS).sort("created_at", -1).to_list(500)


# ---------- admin: plans ----------
class PlanIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    type: str = Field(pattern="^(one_time|subscription|team)$")
    price_inr: float = Field(ge=0, le=100000)
    interval: str = Field(pattern="^(none|month|year)$")
    default_days: Optional[int] = Field(default=None, ge=1, le=3650)
    trial_days: int = Field(default=0, ge=0, le=90)
    description: str = Field(default="", max_length=300)
    features: List[str] = Field(default_factory=list, max_length=12)
    terms: str = Field(default="", max_length=500)
    entitlements: dict
    eligible_templates: List[str] = Field(default_factory=list)
    active: bool = True
    order: int = 10

    @field_validator("entitlements")
    @classmethod
    def ent(cls, v):
        return {"all_premium_templates": bool(v.get("all_premium_templates")), "premium_template_choices": int(v.get("premium_template_choices", 0)),
                "remove_watermark": bool(v.get("remove_watermark")), "saved_cards": max(0, min(10000, int(v.get("saved_cards", 5)))),
                "team_cards": max(0, min(1000, int(v.get("team_cards", 0))))}


@admin.get("/plans")
async def admin_plans(member: dict = Depends(require_perm("subscriptions.view"))):
    return await db.plans.find({}, NOFIELDS).sort("order", 1).to_list(100)


@admin.post("/plans")
async def admin_plan_create(body: PlanIn, member: dict = Depends(require_perm("plans.manage"))):
    doc = {"id": "plan_" + secrets.token_hex(4), **body.model_dump()}
    await db.plans.insert_one(doc)
    doc.pop("_id", None)
    await audit(member, "plan.created", doc["id"], {"name": body.name, "price_inr": body.price_inr})
    return doc


@admin.put("/plans/{plan_id}")
async def admin_plan_update(plan_id: str, body: PlanIn, member: dict = Depends(require_perm("plans.manage"))):
    old = await db.plans.find_one({"id": plan_id}, NOFIELDS)
    if not old:
        raise HTTPException(404, "Not found")
    data = body.model_dump()
    if plan_id == "free":
        data.update(type="free", price_inr=0, interval="none", active=True)
    await db.plans.update_one({"id": plan_id}, {"$set": data})
    await audit(member, "plan.updated", plan_id, {"price_from": old["price_inr"], "price_to": data["price_inr"], "active": data["active"],
                                                  "note": "Existing subscriptions keep their plan snapshot."})
    return {"ok": True}


# ---------- admin: sports ----------
class StatIn(BaseModel):
    key: str = Field(pattern="^[a-z0-9_]{1,40}$")
    label: str = Field(min_length=1, max_length=30)


class SportIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    category: str = Field(pattern="^(team|racket|combat|individual|motorsport|esports)$")
    kind: str = Field(pattern="^(team|individual|esports)$")
    position_label: str = Field(default="Position", max_length=30)
    stats: List[StatIn] = Field(min_length=1, max_length=12)
    active: bool = True
    order: int = 100


@admin.get("/sports")
async def admin_sports(member: dict = Depends(require_perm("sports.manage"))):
    return await db.sports.find({}, NOFIELDS).sort("order", 1).to_list(500)


@admin.post("/sports")
async def admin_sport_create(body: SportIn, member: dict = Depends(require_perm("sports.manage"))):
    import re
    sid = re.sub(r"[^a-z0-9]+", "_", body.name.lower()).strip("_")
    if await db.sports.find_one({"id": sid}):
        raise HTTPException(409, "A sport with this name already exists.")
    doc = {"id": sid, **body.model_dump()}
    await db.sports.insert_one(doc)
    doc.pop("_id", None)
    await audit(member, "sport.created", sid, {"name": body.name})
    return doc


@admin.put("/sports/{sport_id}")
async def admin_sport_update(sport_id: str, body: SportIn, member: dict = Depends(require_perm("sports.manage"))):
    r = await db.sports.update_one({"id": sport_id}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    await audit(member, "sport.updated", sport_id, {"name": body.name, "active": body.active})
    return {"ok": True}


# ---------- admin: templates ----------
class TemplateIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    badge: str = Field(min_length=1, max_length=14)
    layout: str
    tier: str = Field(pattern="^(free|premium)$")
    description: str = Field(default="", max_length=200)
    accent: str = Field(pattern="^#[0-9A-Fa-f]{6}$")
    sports: List[str] = Field(default_factory=list)
    recommended: List[str] = Field(default_factory=list)
    watermark_free: bool = True
    active: bool = True
    order: int = 100

    @field_validator("layout")
    @classmethod
    def layout_ok(cls, v):
        if v not in LAYOUTS:
            raise ValueError("Unknown layout")
        return v


@admin.get("/templates")
async def admin_templates(member: dict = Depends(require_perm("templates.manage"))):
    return await db.templates.find({}, NOFIELDS).sort("order", 1).to_list(200)


@admin.post("/templates")
async def admin_template_create(body: TemplateIn, member: dict = Depends(require_perm("templates.manage"))):
    doc = {"id": "tpl_" + secrets.token_hex(4), **body.model_dump()}
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    await audit(member, "template.created", doc["id"], {"name": body.name, "tier": body.tier})
    return doc


@admin.put("/templates/{tpl_id}")
async def admin_template_update(tpl_id: str, body: TemplateIn, member: dict = Depends(require_perm("templates.manage"))):
    r = await db.templates.update_one({"id": tpl_id}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    await audit(member, "template.updated", tpl_id, {"tier": body.tier, "active": body.active})
    return {"ok": True}


# ---------- admin: invitations ----------
class InviteIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=200)
    role: str
    permissions: Optional[List[str]] = None
    expires_hours: int = Field(default=72, ge=1, le=720)


@admin.get("/invitations")
async def admin_invites(member: dict = Depends(require_perm("admins.manage"))):
    invs = await db.admin_invitations.find({}, {"_id": 0, "token_hash": 0}).sort("created_at", -1).to_list(200)
    t = iso()
    return [{**i, "status": "expired" if i["status"] == "pending" and i["expires_at"] < t else i["status"]} for i in invs]


@admin.post("/invitations")
async def admin_invite(body: InviteIn, member: dict = Depends(require_perm("admins.manage"))):
    if body.role not in STAFF_ROLES:
        raise HTTPException(400, "Choose an admin role.")
    is_owner = member["role"] == "super_admin"
    if body.role == "super_admin" and not is_owner:
        raise HTTPException(403, "Only a Super Admin can invite a Super Admin.")
    if not is_owner and RANK[body.role] >= RANK[member["role"]]:
        raise HTTPException(403, "You can only invite roles below your own.")
    perms = None if body.permissions is None else [p for p in body.permissions if p in PERMISSIONS]
    if perms is not None and not is_owner and not set(perms) <= set(member["perms"]):
        raise HTTPException(403, "You cannot grant permissions you do not have.")
    token = secrets.token_urlsafe(32)
    inv = {"id": new_id(), "email": body.email.lower(), "role": body.role, "permissions": perms, "token_hash": _hash(token),
           "status": "pending", "created_by": member["user_id"], "created_by_email": member.get("email"),
           "created_at": iso(), "expires_at": iso(now() + timedelta(hours=body.expires_hours))}
    await db.admin_invitations.insert_one(inv)
    await audit(member, "invitation.created", inv["email"], {"role": body.role, "permissions": perms, "expires_at": inv["expires_at"]})
    return {"id": inv["id"], "token": token, "expires_at": inv["expires_at"]}


@admin.delete("/invitations/{inv_id}")
async def admin_invite_revoke(inv_id: str, member: dict = Depends(require_perm("admins.manage"))):
    r = await db.admin_invitations.update_one({"id": inv_id, "status": "pending"}, {"$set": {"status": "revoked", "revoked_by": member["user_id"]}})
    if not r.modified_count:
        raise HTTPException(404, "No pending invitation found")
    await audit(member, "invitation.revoked", inv_id)
    return {"ok": True}


# ---------- admin: audit & moderation ----------
@admin.get("/audit")
async def admin_audit(q: str = "", member: dict = Depends(require_perm("audit.view"))):
    f = {}
    if q:
        import re
        rx = {"$regex": re.escape(q[:60]), "$options": "i"}
        f["$or"] = [{"action": rx}, {"actor_email": rx}, {"target": rx}]
    return await db.audit_logs.find(f, NOFIELDS).sort("at", -1).to_list(300)


@admin.get("/reports")
async def admin_reports(member: dict = Depends(require_perm("moderation.manage"))):
    return await db.moderation_reports.find({}, NOFIELDS).sort("created_at", -1).to_list(300)


class ReportPatch(BaseModel):
    status: str = Field(pattern="^(open|reviewing|resolved|dismissed)$")


@admin.patch("/reports/{rid}")
async def admin_report_patch(rid: str, body: ReportPatch, member: dict = Depends(require_perm("moderation.manage"))):
    r = await db.moderation_reports.update_one({"id": rid}, {"$set": {"status": body.status, "handled_by": member["user_id"]}})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    await audit(member, "report.updated", rid, {"status": body.status})
    return {"ok": True}


app.include_router(api)
app.include_router(admin)
app.include_router(clerk_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
