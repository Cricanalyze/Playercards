import asyncio
import hashlib
import hmac
import json
import re
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
import requests
from dotenv import load_dotenv
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, StreamingResponse
from pymongo.errors import BulkWriteError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

try:
    from backend.clerk_auth import clerk_router, require_user, _publishable_key, _secret_key
    from backend.seed_data import SPORTS
    from backend.seed_catalog import TEMPLATES, PLANS, LAYOUTS, BACKGROUNDS, BG_TIER_FEATURE, COLLECTIONS
    from backend.rbac import ROLES, RANK, PERMISSIONS, ROLE_DEFAULTS, STAFF_ROLES, RETIRED_ROLES, effective_role, effective_perms
    from backend.storage import init_storage, put_object, get_object, APP_PREFIX
    from backend import settings_store
    from backend.mailer import send_email, render, EmailError
    from backend import email_templates as ET
except ModuleNotFoundError:
    from clerk_auth import clerk_router, require_user, _publishable_key, _secret_key
    from seed_data import SPORTS
    from seed_catalog import TEMPLATES, PLANS, LAYOUTS, BACKGROUNDS, BG_TIER_FEATURE, COLLECTIONS
    from rbac import ROLES, RANK, PERMISSIONS, ROLE_DEFAULTS, STAFF_ROLES, RETIRED_ROLES, effective_role, effective_perms
    from storage import init_storage, put_object, get_object, APP_PREFIX
    import settings_store
    from mailer import send_email, render, EmailError
    import email_templates as ET

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
cfg_db = db  # platform DB: always holds app_settings, even when app data lives in a custom MongoDB
DB_STATE = {"mode": "default", "error": ""}


async def connect_mongo(url: str, name: str):
    c = AsyncIOMotorClient(url, serverSelectionTimeoutMS=6000, connectTimeoutMS=6000)
    await c.admin.command("ping")
    return c, c[name]


async def activate_db(url: str, name: str):
    global client, db
    client, db = await connect_mongo(url, name)
    DB_STATE.update(mode="custom", error="")


def use_default_db():
    global client, db
    if db is not cfg_db:
        client, db = cfg_db.client, cfg_db
    DB_STATE.update(mode="default")
app = FastAPI(title="FlexoCards API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("rivalcard")
logging.basicConfig(level=logging.INFO)

ENV = "live" if _publishable_key().startswith("pk_live_") else "preview"
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
                         headers={"Authorization": f"Bearer {_secret_key()}", "User-Agent": "flexocards-app"}, **kw)
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
    is_new = m is None
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
        if is_new and prof["email"] and not prof["email"].endswith("@example.com"):
            notify(prof["email"], ET.welcome(prof["name"]), "welcome")
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
        {"status": "pending", "source": {"$ne": "payment"}, "start_at": {"$lte": t}},
        {"$set": {"status": "active"}, "$push": {"history": {"at": t, "event": "started", "by": "system"}}})
    await db.subscriptions.update_many(
        {"status": {"$in": ACTIVE_STATES}, "end_at": {"$ne": None, "$lt": t}},
        {"$set": {"status": "expired"}, "$push": {"history": {"at": t, "event": "expired", "by": "system"}}})


async def active_subs(user_id: str) -> list:
    await expire_sweep()
    return await db.subscriptions.find({"user_id": user_id, "status": {"$in": ACTIVE_STATES}}, NOFIELDS).to_list(100)


def period_of(dt=None):
    d = dt or now()
    start = datetime(d.year, d.month, 1, tzinfo=timezone.utc)
    return start.strftime("%Y-%m"), start + relativedelta(months=1)


async def get_entitlements(member: Optional[dict]) -> dict:
    plans = {p["id"]: p for p in await db.plans.find({}, NOFIELDS).to_list(100)}
    plan, sub = plans.get("free") or PLANS[0], None
    if member:
        for s in await active_subs(member["user_id"]):
            p = plans.get(s["plan_id"])
            if p and p["order"] >= plan["order"]:
                plan, sub = p, s
    period, reset_at = period_of()
    used = (await db.usage.find_one({"user_id": member["user_id"], "period": period}, NOFIELDS) or {}) if member else {}
    wallet = (await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "bonus_cards": 1, "watermark_passes": 1}) or {}) if member else {}
    e = plan["entitlements"]
    cards_used, bg_used = used.get("cards", 0), used.get("bg_removals", 0)
    return {
        "plan_id": plan["id"], "plan_name": plan["name"], "plan_ids": [plan["id"]],
        "subscription": sub and {k: sub.get(k) for k in ("id", "status", "source", "cycle", "start_at", "end_at")},
        "sources": [{"plan": plan["name"], "source": sub["source"], "end_at": sub.get("end_at")}] if sub else [],
        "cards_per_month": plan["cards_per_month"], "cards_used": cards_used,
        "cards_remaining": max(0, plan["cards_per_month"] - cards_used) + wallet.get("bonus_cards", 0),
        "monthly_remaining": max(0, plan["cards_per_month"] - cards_used),
        "bonus_cards": wallet.get("bonus_cards", 0), "watermark_passes": wallet.get("watermark_passes", 0),
        "bg_removal_limit": e.get("bg_removal_limit", 0) if e.get("bg_removal") else 0, "bg_removals_used": bg_used,
        "bg_removals_remaining": max(0, (e.get("bg_removal_limit", 0) if e.get("bg_removal") else 0) - bg_used),
        "period": period, "reset_at": iso(reset_at), "features": e,
        "remove_watermark": bool(e.get("remove_watermark")), "saved_cards": e.get("saved_cards", 5),
        "premium_templates": [],
    }


def can_use_template(tpl: dict, ent: dict) -> bool:
    return not tpl.get("plans") or ent["plan_id"] in tpl["plans"]


async def consume(member: dict, kind: str, request_id: str, limit: int, extra: dict) -> dict:
    """Atomically use one credit; the same request_id never charges twice."""
    period, _ = period_of()
    key = f"{member['user_id']}:{kind}:{request_id}"
    try:
        await db.usage_events.insert_one({"key": key, "user_id": member["user_id"], "kind": kind, "period": period, "at": iso(), **extra})
    except DuplicateKeyError:
        return {"duplicate": True}
    await db.usage.update_one({"user_id": member["user_id"], "period": period},
                              {"$setOnInsert": {"cards": 0, "bg_removals": 0, "created_at": iso()}}, upsert=True)
    r = await db.usage.find_one_and_update({"user_id": member["user_id"], "period": period, kind: {"$lt": limit}},
                                           {"$inc": {kind: 1}, "$set": {"updated_at": iso()}})
    if r is None:
        await db.usage_events.delete_one({"key": key})
        return {"denied": True}
    return {"ok": True}


# ---------- startup ----------
async def migrate_catalog():
    if await db.meta.find_one({"id": "subs_v2"}):
        return
    old = ["premium_card", "pro_creator", "team_pack"]
    for pid in old:
        if await db.subscriptions.count_documents({"plan_id": pid}):
            await db.plans.update_one({"id": pid}, {"$set": {"active": False, "legacy": True, "order": 90}})
        else:
            await db.plans.delete_one({"id": pid})
    for p in PLANS:
        await db.plans.update_one({"id": p["id"]}, {"$set": p}, upsert=True)
    for t in TEMPLATES:
        await db.templates.update_one({"id": t["id"]}, {"$set": t}, upsert=True)
    await db.meta.insert_one({"id": "subs_v2", "at": iso()})


@app.on_event("startup")
async def startup():
    await settings_store.load_all(cfg_db)
    dbc = settings_store.get("database")
    if dbc["enabled"] and dbc["url"]:
        try:
            await activate_db(dbc["url"], dbc["db_name"])
        except Exception as e:
            DB_STATE["error"] = f"Custom MongoDB unreachable at startup, using default: {str(e)[:200]}"
            logger.error(DB_STATE["error"])
    await prepare_db()
    try:
        init_storage()
    except Exception as e:
        logger.error("storage init failed: %s", e)


async def prepare_db():
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    await migrate_catalog()
    for coll, items in (("sports", SPORTS), ("templates", TEMPLATES), ("plans", PLANS), ("backgrounds", BACKGROUNDS)):
        for it in items:
            await db[coll].update_one({"id": it["id"]}, {"$setOnInsert": it}, upsert=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email")
    await db.subscriptions.create_index([("user_id", 1), ("status", 1)])
    await db.events.create_index([("type", 1), ("at", -1)])
    await db.audit_logs.create_index("at")
    await db.admin_invitations.create_index("token_hash", unique=True)
    await db.saved_cards.create_index("user_id")
    await db.usage.create_index([("user_id", 1), ("period", 1)], unique=True)
    await db.usage_events.create_index("key", unique=True)
    await db.payments.create_index("order_id")
    await db.webhook_events.create_index("event_id", unique=True)
    await db.blog_posts.create_index("slug", unique=True)
    await db.blog_posts.create_index([("status", 1), ("published_at", -1)])
    await db.saved_cards.create_index("share.id", sparse=True)
    await db.files.create_index("storage_path")
    await db.storybook_pages.create_index([("user_id", 1), ("created_at", 1)])
    await db.referrals.create_index("referee_id", unique=True)
    await db.referrals.create_index("referrer_id")
    await db.coupons.create_index("code", unique=True)
    await db.users.create_index("ref_code", sparse=True)


# ---------- public ----------
@api.get("/")
async def root():
    return {"app": "FlexoCards", "ok": True}


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


FEATURE_LABELS = {"custom_backgrounds": "Custom background uploads", "advanced_effects": "Advanced photo effects",
                  "bg_library": "Background library", "premium_backgrounds": "Premium backgrounds", "team_presets": "Team background presets",
                  "shared_branding": "Shared team branding"}


class ExportIn(BaseModel):
    sport_id: str = Field(max_length=60)
    template_id: str = Field(max_length=60)
    format: str = Field(pattern="^(card|story)$")
    request_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")
    features_used: List[str] = Field(default_factory=list, max_length=10)
    no_watermark: bool = False


def upgrade_error(msg: str, need: str = ""):
    raise HTTPException(402, {"message": msg, "upgrade": True, "need": need})


@api.post("/cards/export")
async def authorize_export(body: ExportIn, request: Request):
    rate_limit(request, "export", 40)
    member = await optional_member(request)
    if not member:
        raise HTTPException(401, "Sign in to download your card. Free accounts get 2 card downloads a month.")
    tpl = await db.templates.find_one({"id": body.template_id, "active": True}, NOFIELDS)
    if not tpl:
        raise HTTPException(404, "Template not found")
    ent = await get_entitlements(member)
    if not can_use_template(tpl, ent):
        upgrade_error(f"{tpl['name']} is in the {tpl.get('collection', 'premium').title()} collection. Upgrade your plan or choose a template included in {ent['plan_name']}.", "template")
    for f in body.features_used:
        if f in FEATURE_LABELS and not ent["features"].get(f):
            upgrade_error(f"{FEATURE_LABELS[f]} is not included in your {ent['plan_name']} plan. Remove it or upgrade.", f)
    use_pass = body.no_watermark and not ent["remove_watermark"]
    if use_pass and ent["watermark_passes"] < 1:
        upgrade_error("You have no watermark-free passes left. Buy one on the Pricing page or upgrade.", "watermark")
    r = await consume(member, "cards", body.request_id, ent["cards_per_month"],
                      {"template_id": body.template_id, "sport_id": body.sport_id, "format": body.format})
    if r.get("denied"):
        r = await use_wallet(member, "bonus_cards", f"bonus:{body.request_id}")
    if r.get("denied"):
        upgrade_error(f"You've used all {ent['cards_per_month']} card downloads in your {ent['plan_name']} plan this month. "
                      f"Credits reset on {period_of()[1].strftime('%d %b %Y')}, or upgrade for more.", "credits")
    if r.get("ok"):
        await db.events.insert_one({"id": new_id(), "type": "card_downloaded", "sport_id": body.sport_id,
                                    "template_id": body.template_id, "format": body.format, "user_id": member["user_id"], "at": iso()})
    if r.get("duplicate"):
        use_pass = bool(await db.usage_events.find_one({"key": f"{member['user_id']}:wm:{body.request_id}"}))
    elif use_pass:
        use_pass = not (await use_wallet(member, "watermark_passes", f"wm:{body.request_id}")).get("denied")
    ent = await get_entitlements(member)
    return {"allowed": True, "watermark": not (ent["remove_watermark"] or use_pass), "cards_remaining": ent["cards_remaining"],
            "duplicate": bool(r.get("duplicate"))}


async def use_wallet(member: dict, field: str, key: str) -> dict:
    try:
        await db.usage_events.insert_one({"key": f"{member['user_id']}:{key}", "user_id": member["user_id"], "kind": field, "at": iso()})
    except DuplicateKeyError:
        return {"duplicate": True}
    r = await db.users.find_one_and_update({"user_id": member["user_id"], field: {"$gte": 1}}, {"$inc": {field: -1}})
    if r is None:
        await db.usage_events.delete_one({"key": f"{member['user_id']}:{key}"})
        return {"denied": True}
    return {"ok": True}


class ToolIn(BaseModel):
    request_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")


@api.post("/tools/bg-removal")
async def authorize_bg_removal(body: ToolIn, member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    if not ent["features"].get("bg_removal"):
        upgrade_error(f"Background removal is not included in the {ent['plan_name']} plan. Upgrade to Basic or higher.", "bg_removal")
    r = await consume(member, "bg_removals", body.request_id, ent["bg_removal_limit"], {})
    if r.get("denied"):
        upgrade_error(f"You've used all {ent['bg_removal_limit']} background removals this month.", "bg_limit")
    ent = await get_entitlements(member)
    return {"allowed": True, "remaining": ent["bg_removals_remaining"]}


@api.get("/backgrounds")
async def list_backgrounds(request: Request):
    ent = await get_entitlements(await optional_member(request))
    rows = await db.backgrounds.find({"active": True}, NOFIELDS).sort("order", 1).to_list(200)
    out = []
    for b in rows:
        ok = bool(ent["features"].get(BG_TIER_FEATURE.get(b["tier"], ""), False))
        preview = b["value"] if b["type"] == "gradient" else b["value"].split("?")[0] + "?auto=compress&w=120" if "pexels" in b["value"] else b["value"].replace("w=900", "w=120")
        out.append({"id": b["id"], "name": b["name"], "tier": b["tier"], "type": b["type"], "locked": not ok,
                    "preview": preview, "value": b["value"] if ok else ""})
    return out


class BrandIn(BaseModel):
    team: str = Field(default="", max_length=40)
    accent: str = Field(default="", pattern="^(#[0-9A-Fa-f]{6})?$")
    background_id: str = Field(default="", max_length=60)


@api.get("/me/brand")
async def get_brand(member: dict = Depends(current_member)):
    return (await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "brand": 1}) or {}).get("brand") or {}


@api.put("/me/brand")
async def set_brand(body: BrandIn, member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    if not ent["features"].get("shared_branding"):
        upgrade_error("Shared team branding is part of the Team plan.", "shared_branding")
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"brand": body.model_dump()}})
    return body.model_dump()


# ---------- billing (Razorpay) ----------
RZP_API = "https://api.razorpay.com/v1"


def rzp_keys():
    c = settings_store.get("razorpay")
    return c["key_id"], c["key_secret"]


def rzp(method: str, path: str, **kw):
    kid, sec = rzp_keys()
    r = requests.request(method, RZP_API + path, auth=(kid, sec), timeout=15, **kw)
    if r.status_code >= 400:
        logger.warning("razorpay %s %s -> %s %s", method, path, r.status_code, r.text[:300])
        raise HTTPException(502, "Payment gateway error. Please try again.")
    return r.json()


@api.get("/billing/config")
async def billing_config():
    kid, sec = rzp_keys()
    return {"enabled": bool(kid and sec), "key_id": kid if kid and sec else "", "webhooks": bool(settings_store.get("razorpay")["webhook_secret"]),
            "mode": "test" if kid.startswith("rzp_test_") else "live" if kid else "not_configured"}


class BillingInfo(BaseModel):
    name: str = Field(default="", max_length=120)
    gstin: str = Field(default="", pattern=r"^$|^[0-9]{2}[A-Z0-9]{13}$")
    state: str = Field(default="", max_length=40)


class CheckoutIn(BaseModel):
    kind: str = Field(default="plan", pattern="^(plan|pack|watermark)$")
    plan_id: str = Field(default="", max_length=60)
    cycle: str = Field(default="month", pattern="^(month|year)$")
    item_id: str = Field(default="", max_length=40)
    coupon: str = Field(default="", max_length=30)
    billing: BillingInfo = Field(default_factory=BillingInfo)


async def price_item(body: CheckoutIn) -> dict:
    st = settings_store.get("store")
    if body.kind == "plan":
        plan = await db.plans.find_one({"id": body.plan_id, "active": True}, NOFIELDS)
        if not plan or plan["type"] == "free":
            raise HTTPException(400, "Choose an available paid plan.")
        amount = plan["price_month"] if body.cycle == "month" else plan["price_year"]
        return {"amount": amount, "label": f"{plan['name']} plan ({'monthly' if body.cycle == 'month' else 'yearly'})", "plan": plan}
    if body.kind == "pack":
        pk = next((p for p in st["packs"] if p["id"] == body.item_id), None)
        if not pk:
            raise HTTPException(400, "Choose an available card pack.")
        return {"amount": pk["price"], "label": f"{pk['cards']} extra cards", "qty": pk["cards"]}
    qty = st["wm_bundle_qty"] if body.item_id == "bundle" else 1
    return {"amount": st["wm_bundle_price"] if qty > 1 else st["wm_price"], "label": f"{qty} watermark-free download{'s' if qty > 1 else ''}", "qty": qty}


def _aware(v: str):
    d = _dt(v)
    return d.replace(tzinfo=timezone.utc) if d and d.tzinfo is None else d


def add_tax(amount: float) -> float:
    inv = settings_store.get("invoice")
    return round(amount * (1 + float(inv["gst_rate"]) / 100), 2) if inv["gstin"] and not inv["inclusive"] else amount


async def apply_coupon(code: str, body: CheckoutIn, amount: float, member: dict) -> dict:
    c = await db.coupons.find_one({"code": code.strip().upper(), "active": True}, NOFIELDS)
    if not c:
        raise HTTPException(400, "This coupon code isn't valid.")
    exp = _aware(c.get("expires_at", ""))
    if exp and now() > exp:
        raise HTTPException(400, "This coupon has expired.")
    if c.get("max_uses"):
        pending = await db.payments.count_documents({"coupon": c["code"], "status": "created", "created_at": {"$gt": iso(now() - timedelta(minutes=30))}})
        if c.get("uses", 0) + pending >= c["max_uses"]:
            raise HTTPException(400, "This coupon has been fully used.")
    if c.get("applies_to", "all") not in ("all", "plans" if body.kind == "plan" else "extras"):
        raise HTTPException(400, f"This coupon only works on {'plans' if c['applies_to'] == 'plans' else 'card packs and watermark passes'}.")
    if c.get("once_per_user") and await db.payments.find_one({"user_id": member["user_id"], "coupon": c["code"], "status": "captured"}):
        raise HTTPException(400, "You've already used this coupon.")
    off = round(amount * c["value"] / 100, 2) if c["type"] == "percent" else float(c["value"])
    final = max(1.0, round(amount - off, 2))
    return {"code": c["code"], "discount": round(amount - final, 2), "final": final}


@api.post("/billing/quote")
async def billing_quote(body: CheckoutIn, member: dict = Depends(current_member)):
    it = await price_item(body)
    q = {"amount": it["amount"], "label": it["label"], "final": it["amount"], "discount": 0, "coupon": ""}
    if body.coupon.strip():
        cp = await apply_coupon(body.coupon, body, it["amount"], member)
        q.update(final=cp["final"], discount=cp["discount"], coupon=cp["code"])
    q["payable"] = add_tax(q["final"])
    return q


@api.post("/billing/checkout")
async def checkout(body: CheckoutIn, request: Request, member: dict = Depends(current_member)):
    rate_limit(request, "checkout", 10)
    kid, sec = rzp_keys()
    if not (kid and sec):
        raise HTTPException(503, "Online payments are pending setup. Please try again later.")
    it = await price_item(body)
    amount, cp = it["amount"], None
    if amount < 1:
        raise HTTPException(400, "This item has no price set.")
    if body.coupon.strip():
        cp = await apply_coupon(body.coupon, body, amount, member)
    final = add_tax(cp["final"] if cp else amount)
    plan = it.get("plan")
    pid = new_id()
    order = rzp("POST", "/orders", json={"amount": int(round(final * 100)), "currency": "INR", "receipt": pid[:40],
                                         "notes": {"user_id": member["user_id"], "kind": body.kind, "item": body.plan_id or body.item_id}})
    await db.payments.insert_one({"id": pid, "user_id": member["user_id"], "user_email": member.get("email"), "kind": body.kind,
                                  "plan_id": plan["id"] if plan else None, "plan_name": plan["name"] if plan else it["label"], "item_label": it["label"],
                                  "qty": it.get("qty"), "cycle": body.cycle if plan else None, "list_price_inr": amount,
                                  "coupon": cp["code"] if cp else None, "discount_inr": cp["discount"] if cp else 0, "amount_inr": final,
                                  "billing": body.billing.model_dump(), "currency": "INR",
                                  "gateway": "razorpay", "order_id": order["id"], "status": "created", "created_at": iso(),
                                  "history": [{"at": iso(), "event": "order_created"}]})
    return {"payment_id": pid, "order_id": order["id"], "amount": order["amount"], "currency": "INR", "key_id": kid,
            "plan_name": plan["name"] if plan else it["label"], "label": it["label"], "cycle": body.cycle, "email": member.get("email"), "name": member.get("name")}


async def activate_payment(pay: dict, rzp_payment_id: str, via: str):
    r = await db.payments.find_one_and_update(
        {"id": pay["id"], "status": {"$in": ["created", "authorized", "failed"]}},
        {"$set": {"status": "captured", "razorpay_payment_id": rzp_payment_id, "paid_at": iso()},
         "$push": {"history": {"at": iso(), "event": "captured", "via": via}}}, return_document=ReturnDocument.AFTER)
    if not r:
        return
    seq = await db.counters.find_one_and_update({"_id": "invoice"}, {"$inc": {"n": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    inv = settings_store.get("invoice")
    await db.payments.update_one({"id": pay["id"]}, {"$set": {"invoice_no": f"{inv['prefix']}-{now().year}-{seq['n']:05d}"}})
    if pay.get("coupon"):
        await db.coupons.update_one({"code": pay["coupon"]}, {"$inc": {"uses": 1}})
    if pay.get("kind") in ("pack", "watermark"):
        field = "bonus_cards" if pay["kind"] == "pack" else "watermark_passes"
        await db.users.update_one({"user_id": pay["user_id"]}, {"$inc": {field: int(pay["qty"])}})
        if pay.get("user_email"):
            notify(pay["user_email"], ET.purchase(pay["item_label"], pay["amount_inr"], [("Added", f"{pay['qty']} {'cards' if pay['kind'] == 'pack' else 'passes'}")], rzp_payment_id), "receipt")
        return
    plan = await db.plans.find_one({"id": pay["plan_id"]}, NOFIELDS)
    delta = relativedelta(months=1) if pay["cycle"] == "month" else relativedelta(years=1)
    snap = {"name": plan["name"], "type": plan["type"], "price_inr": pay["amount_inr"], "interval": pay["cycle"],
            "cards_per_month": plan["cards_per_month"], "entitlements": plan["entitlements"]}
    same = await db.subscriptions.find_one({"user_id": pay["user_id"], "plan_id": plan["id"], "source": "payment",
                                            "status": {"$in": ACTIVE_STATES}}, NOFIELDS)
    if same:
        end = iso(max(now(), datetime.fromisoformat(same["end_at"])) + delta)
        await db.subscriptions.update_one({"id": same["id"]}, {"$set": {"end_at": end, "cycle": pay["cycle"], "payment_id": pay["id"]},
                                                               "$push": {"history": {"at": iso(), "event": "renewed", "payment": pay["id"]}}})
        sub_id = same["id"]
    else:
        await db.subscriptions.update_many({"user_id": pay["user_id"], "source": "payment", "status": {"$in": ACTIVE_STATES}},
                                           {"$set": {"status": "canceled", "end_at": iso()},
                                            "$push": {"history": {"at": iso(), "event": "replaced_by_plan_change", "by": "system"}}})
        sub_id = new_id()
        await db.subscriptions.insert_one({"id": sub_id, "user_id": pay["user_id"], "plan_id": plan["id"], "plan_snapshot": snap,
                                           "status": "active", "source": "payment", "cycle": pay["cycle"], "payment_id": pay["id"],
                                           "start_at": iso(), "end_at": iso(now() + delta), "auto_renew": False, "created_at": iso(),
                                           "history": [{"at": iso(), "event": "activated", "payment": pay["id"], "via": via}]})
    await db.payments.update_one({"id": pay["id"]}, {"$set": {"subscription_id": sub_id}})
    if pay.get("user_email"):
        end = (await db.subscriptions.find_one({"id": sub_id}, NOFIELDS))["end_at"][:10]
        notify(pay["user_email"], ET.receipt(plan["name"], pay["cycle"], pay["amount_inr"], plan["cards_per_month"], end, rzp_payment_id), "receipt")


class VerifyIn(BaseModel):
    razorpay_order_id: str = Field(max_length=80)
    razorpay_payment_id: str = Field(max_length=80)
    razorpay_signature: str = Field(max_length=200)


@api.post("/billing/verify")
async def verify_payment(body: VerifyIn, member: dict = Depends(current_member)):
    kid, sec = rzp_keys()
    if not sec:
        raise HTTPException(503, "Online payments are pending setup.")
    pay = await db.payments.find_one({"order_id": body.razorpay_order_id, "user_id": member["user_id"]}, NOFIELDS)
    if not pay:
        raise HTTPException(404, "Payment not found")
    expected = hmac.new(sec.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.payments.update_one({"id": pay["id"]}, {"$push": {"history": {"at": iso(), "event": "signature_mismatch"}}})
        raise HTTPException(400, "Payment could not be verified.")
    p = rzp("GET", f"/payments/{body.razorpay_payment_id}")
    if p.get("order_id") != pay["order_id"] or int(p.get("amount", 0)) != int(round(pay["amount_inr"] * 100)):
        raise HTTPException(400, "Payment details do not match this order.")
    if p.get("status") == "authorized":
        p = rzp("POST", f"/payments/{p['id']}/capture", json={"amount": p["amount"], "currency": "INR"})
    if p.get("status") == "captured":
        await activate_payment(pay, p["id"], "checkout")
    elif p.get("status") == "authorized":
        await db.payments.update_one({"id": pay["id"], "status": "created"}, {"$set": {"status": "authorized", "razorpay_payment_id": p["id"]}})
    elif p.get("status") == "failed":
        await db.payments.update_one({"id": pay["id"], "status": {"$in": ["created", "authorized"]}}, {"$set": {"status": "failed"}})
    final = await db.payments.find_one({"id": pay["id"]}, NOFIELDS)
    return {"status": final["status"], "subscription_id": final.get("subscription_id")}


@api.post("/billing/webhook")
async def razorpay_webhook(request: Request):
    secret = settings_store.get("razorpay")["webhook_secret"]
    if not secret:
        raise HTTPException(503, "Webhook secret not configured")
    raw = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    if not hmac.compare_digest(hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(), sig):
        raise HTTPException(400, "Invalid signature")
    ev = json.loads(raw)
    event_id = request.headers.get("x-razorpay-event-id") or hashlib.sha256(raw).hexdigest()
    try:
        await db.webhook_events.insert_one({"event_id": event_id, "event": ev.get("event"), "at": iso()})
    except DuplicateKeyError:
        return {"ok": True, "duplicate": True}
    kind = ev.get("event", "")
    ent = ev.get("payload", {})
    payment = (ent.get("payment") or {}).get("entity") or {}
    refund = (ent.get("refund") or {}).get("entity") or {}
    if kind.startswith("refund."):
        pay = await db.payments.find_one({"razorpay_payment_id": refund.get("payment_id")}, NOFIELDS)
        if pay and kind in ("refund.processed", "refund.created"):
            await db.payments.update_one({"id": pay["id"]}, {"$set": {"status": "refunded", "refunded_at": iso(), "refund_amount_inr": refund.get("amount", 0) / 100},
                                                             "$push": {"history": {"at": iso(), "event": kind}}})
            if pay.get("subscription_id"):
                await db.subscriptions.update_one({"id": pay["subscription_id"]}, {"$set": {"status": "refunded", "end_at": iso()},
                                                                                   "$push": {"history": {"at": iso(), "event": "refunded", "by": "gateway"}}})
        return {"ok": True}
    pay = await db.payments.find_one({"order_id": payment.get("order_id")}, NOFIELDS) if payment.get("order_id") else None
    if not pay:
        return {"ok": True, "ignored": True}
    if int(payment.get("amount", 0)) != int(round(pay["amount_inr"] * 100)):
        return {"ok": True, "ignored": "amount_mismatch"}
    if kind in ("payment.captured", "order.paid"):
        await activate_payment(pay, payment["id"], "webhook")
    elif kind == "payment.authorized":
        await db.payments.update_one({"id": pay["id"], "status": "created"}, {"$set": {"status": "authorized", "razorpay_payment_id": payment["id"]}})
    elif kind == "payment.failed":
        await db.payments.update_one({"id": pay["id"], "status": {"$in": ["created", "authorized"]}},
                                     {"$set": {"status": "failed", "failure_reason": payment.get("error_description", "")},
                                      "$push": {"history": {"at": iso(), "event": "failed"}}})
    return {"ok": True}


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
    keys = ("user_id", "email", "name", "role", "perms", "status", "created_at", "favorite_templates")
    return {"member": {**{k: member.get(k) for k in keys}, "can_blog": can_write_blog(member)},
            "entitlements": await get_entitlements(member), "subscriptions": subs,
            "payments": await db.payments.find({"user_id": member["user_id"]}, {"_id": 0, "history": 0}).sort("created_at", -1).to_list(100)}


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


EDIT_WINDOW = timedelta(hours=6)


def edit_state(card: dict, ent: dict) -> dict:
    until = datetime.fromisoformat(card["created_at"]) + EDIT_WINDOW
    paid = ent["plan_id"] != "free"
    reason = "" if paid and now() < until else "free_plan" if not paid else "window_closed"
    return {"editable": not reason, "editable_until": iso(until), "lock_reason": reason}


def public_card(c: dict, ent: dict) -> dict:
    share = c.get("share")
    return {**{k: v for k, v in c.items() if k != "share"}, **edit_state(c, ent),
            "share_id": share["id"] if share else None}


@api.get("/me/cards")
async def my_cards(member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    rows = await db.saved_cards.find({"user_id": member["user_id"]}, NOFIELDS).sort("updated_at", -1).to_list(500)
    return [public_card(c, ent) for c in rows]


@api.post("/me/cards")
async def save_card(body: CardIn, member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    if await db.saved_cards.count_documents({"user_id": member["user_id"]}) >= ent["saved_cards"]:
        raise HTTPException(402, f"Your plan allows {ent['saved_cards']} saved cards. Delete one or upgrade.")
    doc = {"id": new_id(), "user_id": member["user_id"], **body.model_dump(), "created_at": iso(), "updated_at": iso()}
    await db.saved_cards.insert_one(doc)
    doc.pop("_id", None)
    return public_card(doc, ent)


@api.put("/me/cards/{card_id}")
async def update_card(card_id: str, body: CardIn, member: dict = Depends(current_member)):
    card = await db.saved_cards.find_one({"id": card_id, "user_id": member["user_id"]}, NOFIELDS)
    if not card:
        raise HTTPException(404, "Not found")
    st = edit_state(card, await get_entitlements(member))
    if st["lock_reason"] == "free_plan":
        upgrade_error("Editing a card after it's created is part of paid plans. Create a new card or upgrade.", "edit")
    if st["lock_reason"]:
        raise HTTPException(403, "The 6-hour edit window for this card has closed. Create a new card instead.")
    await db.saved_cards.update_one({"id": card_id}, {"$set": {**body.model_dump(), "updated_at": iso()}})
    return {"ok": True}


class ShareIn(BaseModel):
    image: str = Field(max_length=12_000_000)


@api.post("/me/cards/{card_id}/share")
async def share_card(card_id: str, body: ShareIn, request: Request, member: dict = Depends(current_member)):
    rate_limit(request, "share", 10)
    card = await db.saved_cards.find_one({"id": card_id, "user_id": member["user_id"]}, NOFIELDS)
    if not card:
        raise HTTPException(404, "Not found")
    if (await get_entitlements(member))["plan_id"] == "free":
        upgrade_error("Public share links are part of paid plans. Upgrade to Basic or higher.", "public_share")
    prefix = "data:image/png;base64,"
    if not body.image.startswith(prefix):
        raise HTTPException(400, "Card image must be a PNG")
    import base64
    try:
        raw = base64.b64decode(body.image[len(prefix):], validate=True)
    except ValueError:
        raise HTTPException(400, "Invalid image")
    path = f"{APP_PREFIX}/shares/{member['user_id']}/{new_id()}.png"
    try:
        res = put_object(path, raw, "image/png")
    except requests.RequestException:
        raise HTTPException(502, "Could not store the card image. Try again.")
    await db.files.insert_one({"id": new_id(), "storage_path": res["path"], "content_type": "image/png", "public": True,
                               "owner_id": member["user_id"], "kind": "share", "size": len(raw), "is_deleted": False, "created_at": iso()})
    share_id = (card.get("share") or {}).get("id") or secrets.token_urlsafe(8)
    await db.saved_cards.update_one({"id": card_id}, {"$set": {"share": {"id": share_id, "image_path": res["path"], "shared_at": iso()}}})
    return {"share_id": share_id}


@api.delete("/me/cards/{card_id}/share")
async def unshare_card(card_id: str, member: dict = Depends(current_member)):
    r = await db.saved_cards.update_one({"id": card_id, "user_id": member["user_id"]}, {"$unset": {"share": ""}})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/share/{share_id}")
async def view_share(share_id: str):
    c = await db.saved_cards.find_one({"share.id": share_id}, NOFIELDS)
    owner = c and await db.users.find_one({"user_id": c["user_id"], "status": "active"}, NOFIELDS)
    if not owner:
        raise HTTPException(404, "This card link doesn't exist or was turned off.")
    if (await get_entitlements(owner))["plan_id"] == "free":
        raise HTTPException(410, "This card is no longer public.")
    sport = await db.sports.find_one({"id": c["sport_id"]}, {"_id": 0, "name": 1})
    return {"title": c.get("title") or c["data"].get("name") or "Player card", "sport": (sport or {}).get("name", ""),
            "owner": owner.get("name", ""), "image_url": f"/api/files/{c['share']['image_path']}", "shared_at": c["share"]["shared_at"]}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False, "public": True}, NOFIELDS)
    if not rec:
        raise HTTPException(404, "File not found")
    try:
        data, ctype = get_object(path)
    except requests.RequestException:
        raise HTTPException(502, "Could not load file")
    return Response(content=data, media_type=rec.get("content_type") or ctype, headers={"Cache-Control": "public, max-age=86400"})


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
    paid_ids = await db.subscriptions.distinct("user_id", {"status": {"$in": ACTIVE_STATES}, "source": "payment"})
    total = await db.users.count_documents(users_q)
    premium = await db.users.count_documents({**users_q, "user_id": {"$in": premium_ids}})
    paid = await db.users.count_documents({**users_q, "user_id": {"$in": paid_ids}})
    active_since = iso(now() - timedelta(days=30))
    pay = lambda st: {"status": st, **({"created_at": rng} if rng else {})}
    gross = await db.payments.aggregate([{"$match": pay("captured")}, {"$group": {"_id": None, "s": {"$sum": "$amount_inr"}}}]).to_list(1)
    refunds = await db.payments.aggregate([{"$match": pay("refunded")}, {"$group": {"_id": None, "s": {"$sum": "$amount_inr"}}}]).to_list(1)
    paid_recurring = await db.subscriptions.find({"status": {"$in": ["active", "past_due"]}, "source": "payment"}, NOFIELDS).to_list(10000)
    mrr = sum(s["plan_snapshot"]["price_inr"] / (12 if s["plan_snapshot"].get("interval") == "year" else 1) for s in paid_recurring)
    g, r = (gross[0]["s"] if gross else 0), (refunds[0]["s"] if refunds else 0)
    sub_count = lambda st: db.subscriptions.count_documents({"status": st})
    return {
        "users": {"total": total, "new": await db.users.count_documents({**users_q, **({"created_at": rng} if rng else {"created_at": {"$gte": active_since}})}),
                  "active_30d": await db.users.count_documents({**users_q, "last_seen_at": {"$gte": active_since}}),
                  "free": total - premium, "premium": premium, "paid": paid, "complimentary": premium - paid,
                  "suspended": await db.users.count_documents({**IN_ENV, "status": "suspended"})},
        "subscriptions": {"active": await db.subscriptions.count_documents({"status": {"$in": ACTIVE_STATES}}),
                          "expired": await sub_count("expired"), "canceled": await sub_count("canceled"),
                          "by_source": {s: await db.subscriptions.count_documents({"status": {"$in": ACTIVE_STATES}, "source": s})
                                        for s in ("payment", "promotion", "complimentary")}},
        "payments": {"successful": await db.payments.count_documents(pay("captured")), "failed": await db.payments.count_documents(pay("failed")),
                     "gross_inr": g, "refunds_inr": r, "net_inr": g - r, "mrr_inr": round(mrr, 2),
                     "gateway": (await billing_config())["mode"], "pending": await db.payments.count_documents(pay({"$in": ["created", "authorized"]})),
                     "refunded": await db.payments.count_documents(pay("refunded"))},
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
            "cards": await db.saved_cards.find({"user_id": user_id}, {"_id": 0, "id": 1, "title": 1, "sport_id": 1, "template_id": 1, "updated_at": 1}).sort("updated_at", -1).to_list(50),
            "usage_history": await db.usage.find({"user_id": user_id}, NOFIELDS).sort("period", -1).to_list(12),
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
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    cycle: str = Field(default="month", pattern="^(month|year)$")
    source: str = Field(default="complimentary", pattern="^(complimentary|promotion|manual)$")
    note: str = Field(default="", max_length=300)


def parse_dt(v: Optional[str]):
    if not v:
        return None
    try:
        d = datetime.fromisoformat(v if "T" in v else v + "T00:00:00+00:00")
    except ValueError:
        raise HTTPException(400, "Use a valid date (YYYY-MM-DD).")
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


@admin.post("/subscriptions")
async def admin_grant(body: GrantIn, member: dict = Depends(require_perm("subscriptions.manage"))):
    t = await _target(body.user_id)
    if t.get("status") == "deleted":
        raise HTTPException(409, "Account is deleted.")
    plan = await db.plans.find_one({"id": body.plan_id}, NOFIELDS)
    if not plan or plan["type"] == "free":
        raise HTTPException(400, "Choose a paid plan to assign.")
    start = parse_dt(body.start_at) or now()
    end = parse_dt(body.end_at) or (start + timedelta(days=body.days) if body.days else
                                    start + (relativedelta(years=1) if body.cycle == "year" else relativedelta(months=1)))
    if end <= start:
        raise HTTPException(400, "Expiry must be after the start date.")
    if start <= now():
        await db.subscriptions.update_many({"user_id": body.user_id, "status": {"$in": ACTIVE_STATES}, "source": {"$ne": "payment"}},
                                           {"$set": {"status": "canceled", "end_at": iso()},
                                            "$push": {"history": {"at": iso(), "event": "replaced_by_admin_assignment", "by": member["user_id"]}}})
    sub = {"id": new_id(), "user_id": body.user_id, "plan_id": plan["id"], "template_id": None,
           "plan_snapshot": {"name": plan["name"], "type": plan["type"], "price_inr": 0, "interval": body.cycle,
                             "cards_per_month": plan["cards_per_month"], "entitlements": plan["entitlements"]},
           "status": "active" if start <= now() else "pending", "source": body.source, "cycle": body.cycle, "granted_by": member["user_id"], "note": body.note,
           "start_at": iso(start), "end_at": iso(end), "auto_renew": False,
           "created_at": iso(), "history": [{"at": iso(), "event": f"granted_{body.source}", "by": member["user_id"], "end_at": iso(end)}]}
    await db.subscriptions.insert_one(sub)
    sub.pop("_id", None)
    await audit(member, "subscription.granted", body.user_id, {"plan": plan["id"], "source": body.source, "start_at": sub["start_at"], "end_at": sub["end_at"], "subscription": sub["id"]})
    return sub


class DatesIn(BaseModel):
    start_at: str
    end_at: str
    note: str = Field(default="", max_length=300)


@admin.patch("/subscriptions/{sub_id}/dates")
async def admin_sub_dates(sub_id: str, body: DatesIn, member: dict = Depends(require_perm("subscriptions.manage"))):
    s = await _sub(sub_id)
    start, end = parse_dt(body.start_at), parse_dt(body.end_at)
    if end <= start:
        raise HTTPException(400, "Expiry must be after the start date.")
    status = s["status"]
    if status in ("expired", "pending", "active") and s["status"] not in ("refunded", "canceled"):
        status = "pending" if start > now() else "expired" if end < now() else "active"
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"start_at": iso(start), "end_at": iso(end), "status": status},
                                                       "$push": {"history": {"at": iso(), "event": "dates_changed", "by": member["user_id"], "note": body.note}}})
    await audit(member, "subscription.dates_changed", s["user_id"], {"subscription": sub_id, "from": [s.get("start_at"), s.get("end_at")], "to": [iso(start), iso(end)]})
    return {"ok": True, "status": status}


@admin.get("/subscription-report")
async def admin_sub_report(member: dict = Depends(require_perm("subscriptions.view"))):
    await expire_sweep()
    active = await db.subscriptions.find({"status": {"$in": ACTIVE_STATES}}, NOFIELDS).to_list(10000)
    by_plan = {}
    for x in active:
        k = (x["plan_id"], x.get("cycle") or "month", x["source"])
        by_plan[k] = by_plan.get(k, 0) + 1
    months = await db.payments.aggregate([
        {"$match": {"status": {"$in": ["captured", "refunded"]}}},
        {"$group": {"_id": {"m": {"$substr": ["$created_at", 0, 7]}, "cycle": "$cycle", "status": "$status"},
                    "count": {"$sum": 1}, "amount": {"$sum": "$amount_inr"}}}, {"$sort": {"_id.m": -1}}]).to_list(500)
    users_q = {**IN_ENV, "status": {"$ne": "deleted"}}
    paid_ids = await db.subscriptions.distinct("user_id", {"status": {"$in": ACTIVE_STATES}, "source": "payment"})
    any_ids = await db.subscriptions.distinct("user_id", {"status": {"$in": ACTIVE_STATES}})
    total = await db.users.count_documents(users_q)
    return {"active": [{"plan_id": k[0], "cycle": k[1], "source": k[2], "count": v} for k, v in sorted(by_plan.items())],
            "monthly": [{"month": r["_id"]["m"], "cycle": r["_id"].get("cycle"), "status": r["_id"]["status"], "count": r["count"], "amount_inr": r["amount"]} for r in months],
            "users": {"total": total, "paid": await db.users.count_documents({**users_q, "user_id": {"$in": paid_ids}}),
                      "free": total - await db.users.count_documents({**users_q, "user_id": {"$in": any_ids}})}}


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
    if s["status"] in ("refunded", "canceled"):
        raise HTTPException(409, f"{s['status'].title()} subscriptions cannot be extended. Assign a new plan instead.")
    base = max(now(), datetime.fromisoformat(s["end_at"])) if s.get("end_at") else now()
    end = iso(base + timedelta(days=body.days))
    status = "pending" if s["status"] == "pending" else "active"
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"end_at": end, "status": status},
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
async def admin_payments(status: str = "", member: dict = Depends(require_perm("subscriptions.view"))):
    f = {"status": status} if status in ("created", "authorized", "captured", "failed", "refunded") else {}
    return await db.payments.find(f, NOFIELDS).sort("created_at", -1).to_list(500)


# ---------- admin: plans ----------
ENT_BOOLS = ["remove_watermark", "photo_editing", "standard_backgrounds", "bg_removal", "bg_library", "custom_backgrounds",
             "premium_backgrounds", "advanced_effects", "team_presets", "shared_branding"]


class PlanIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    price_month: float = Field(ge=0, le=100000)
    price_year: float = Field(ge=0, le=1000000)
    cards_per_month: int = Field(ge=0, le=100000)
    description: str = Field(default="", max_length=300)
    features: List[str] = Field(default_factory=list, max_length=12)
    terms: str = Field(default="", max_length=500)
    entitlements: dict
    active: bool = True
    order: int = Field(default=10, ge=0, le=100)

    @field_validator("entitlements")
    @classmethod
    def ent(cls, v):
        out = {k: bool(v.get(k)) for k in ENT_BOOLS}
        out["photo_editing"] = out["standard_backgrounds"] = True
        out["saved_cards"] = max(0, min(10000, int(v.get("saved_cards", 5))))
        out["bg_removal_limit"] = max(0, min(10000, int(v.get("bg_removal_limit", 0))))
        return out


@admin.get("/plans")
async def admin_plans(member: dict = Depends(require_perm("subscriptions.view"))):
    plans = await db.plans.find({}, NOFIELDS).sort("order", 1).to_list(100)
    for p in plans:
        p["subscribers"] = await db.subscriptions.count_documents({"plan_id": p["id"], "status": {"$in": ACTIVE_STATES}})
        p["template_count"] = await db.templates.count_documents({"$or": [{"plans": p["id"]}, {"plans": []}]})
    return plans


@admin.put("/plans/{plan_id}")
async def admin_plan_update(plan_id: str, body: PlanIn, member: dict = Depends(require_perm("plans.manage"))):
    old = await db.plans.find_one({"id": plan_id}, NOFIELDS)
    if not old:
        raise HTTPException(404, "Not found")
    data = body.model_dump()
    if plan_id == "free":
        data.update(price_month=0, price_year=0, active=True)
    data["price_inr"] = data["price_month"]
    await db.plans.update_one({"id": plan_id}, {"$set": data})
    await audit(member, "plan.updated", plan_id, {"from": {k: old.get(k) for k in ("price_month", "price_year", "cards_per_month", "active")},
                                                  "to": {k: data[k] for k in ("price_month", "price_year", "cards_per_month", "active")},
                                                  "entitlements": data["entitlements"]})
    return {"ok": True}


class TemplateAccessIn(BaseModel):
    template_ids: List[str] = Field(max_length=500)


@admin.put("/plans/{plan_id}/templates")
async def admin_plan_templates(plan_id: str, body: TemplateAccessIn, member: dict = Depends(require_perm("plans.manage"))):
    if not await db.plans.find_one({"id": plan_id}):
        raise HTTPException(404, "Not found")
    await db.templates.update_many({"id": {"$in": body.template_ids}, "plans": {"$ne": plan_id}}, {"$push": {"plans": plan_id}})
    await db.templates.update_many({"id": {"$nin": body.template_ids}}, {"$pull": {"plans": plan_id}})
    await audit(member, "plan.template_access", plan_id, {"templates": len(body.template_ids)})
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
    collection: str
    description: str = Field(default="", max_length=200)
    accent: str = Field(pattern="^#[0-9A-Fa-f]{6}$")
    sports: List[str] = Field(default_factory=list)
    plans: List[str] = Field(default_factory=list)
    recommended: List[str] = Field(default_factory=list)
    frame_image: str = Field(default="", max_length=2_000_000)
    watermark_free: bool = True
    active: bool = True
    order: int = 100

    @field_validator("layout")
    @classmethod
    def layout_ok(cls, v):
        if v not in LAYOUTS:
            raise ValueError("Unknown layout")
        return v

    @field_validator("collection")
    @classmethod
    def coll_ok(cls, v):
        if v not in COLLECTIONS:
            raise ValueError("Unknown collection")
        return v

    @field_validator("frame_image")
    @classmethod
    def frame_ok(cls, v):
        if v and not v.startswith(("data:image/png;base64,", "data:image/webp;base64,")):
            raise ValueError("Frame overlay must be a PNG or WebP image")
        return v


async def _tpl_doc(body: TemplateIn) -> dict:
    d = body.model_dump()
    valid = {p["id"] for p in await db.plans.find({}, {"_id": 0, "id": 1}).to_list(100)}
    d["plans"] = [p for p in d["plans"] if p in valid]
    d["tier"] = d["collection"]
    return d


@admin.get("/templates")
async def admin_templates(member: dict = Depends(require_perm("templates.manage"))):
    return await db.templates.find({}, NOFIELDS).sort("order", 1).to_list(200)


@admin.post("/templates")
async def admin_template_create(body: TemplateIn, member: dict = Depends(require_perm("templates.manage"))):
    doc = {"id": "tpl_" + secrets.token_hex(4), **(await _tpl_doc(body))}
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    await audit(member, "template.created", doc["id"], {"name": body.name, "collection": body.collection})
    return doc


@admin.put("/templates/{tpl_id}")
async def admin_template_update(tpl_id: str, body: TemplateIn, member: dict = Depends(require_perm("templates.manage"))):
    r = await db.templates.update_one({"id": tpl_id}, {"$set": await _tpl_doc(body)})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    await audit(member, "template.updated", tpl_id, {"collection": body.collection, "active": body.active, "plans": body.plans})
    return {"ok": True}


@admin.delete("/templates/{tpl_id}")
async def admin_template_delete(tpl_id: str, member: dict = Depends(require_perm("templates.manage"))):
    t = await db.templates.find_one({"id": tpl_id}, NOFIELDS)
    if not t:
        raise HTTPException(404, "Not found")
    if await db.templates.count_documents({"active": True, "id": {"$ne": tpl_id}, "plans": "free"}) == 0:
        raise HTTPException(409, "Keep at least one published Free template.")
    await db.templates.delete_one({"id": tpl_id})
    await audit(member, "template.deleted", tpl_id, {"name": t["name"]})
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
    notify(inv["email"], ET.admin_invite(member.get("name"), body.role, inv["expires_at"][:10], token), "invitation")
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


# ---------- blog ----------
def can_write_blog(m: dict) -> bool:
    return "blog.manage" in (m.get("perms") or []) or bool(m.get("can_blog"))


async def blog_writer(member: dict = Depends(current_member)) -> dict:
    if not can_write_blog(member):
        raise HTTPException(403, "You don't have blog access. Ask an admin to add you as an author.")
    return member


IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


@api.post("/uploads/image")
async def upload_image(file: UploadFile = File(...), member: dict = Depends(blog_writer)):
    ext = IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Upload a JPG, PNG, WebP or GIF image.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be 5 MB or smaller.")
    try:
        res = put_object(f"{APP_PREFIX}/blog/{member['user_id']}/{new_id()}.{ext}", data, file.content_type)
    except requests.RequestException:
        raise HTTPException(502, "Upload failed. Try again.")
    await db.files.insert_one({"id": new_id(), "storage_path": res["path"], "content_type": file.content_type, "public": True,
                               "owner_id": member["user_id"], "kind": "blog", "original_filename": file.filename, "size": len(data),
                               "is_deleted": False, "created_at": iso()})
    return {"url": f"/api/files/{res['path']}"}


class PostIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    excerpt: str = Field(default="", max_length=300)
    content: str = Field(default="", max_length=100_000)
    cover_image: str = Field(default="", max_length=500)
    category: str = Field(default="", max_length=40)
    tags: List[str] = Field(default_factory=list, max_length=10)
    seo_title: str = Field(default="", max_length=70)
    seo_description: str = Field(default="", max_length=170)
    featured: bool = False
    status: str = Field(default="draft", pattern="^(draft|pending|published)$")

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v):
        return list(dict.fromkeys(t.strip().lower()[:30] for t in v if t.strip()))


POST_LIST_FIELDS = {"_id": 0, "content": 0, "review_note": 0}


async def _slug(title: str, exclude_id: str = "") -> str:
    import re
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:70] or "post"
    slug, i = base, 2
    while await db.blog_posts.find_one({"slug": slug, "id": {"$ne": exclude_id}}):
        slug, i = f"{base}-{i}", i + 1
    return slug


def _post_fields(body: PostIn, member: dict, old: Optional[dict] = None) -> dict:
    d = body.model_dump()
    is_editor = "blog.manage" in member["perms"]
    if not is_editor:
        d["featured"] = (old or {}).get("featured", False)
        if d["status"] == "published":
            d["status"] = "pending"
    d["reading_minutes"] = max(1, round(len(d["content"].split()) / 200))
    d["updated_at"] = iso()
    if d["status"] == "published" and not (old or {}).get("published_at"):
        d["published_at"] = iso()
    return d


async def _own_post(post_id: str, member: dict) -> dict:
    p = await db.blog_posts.find_one({"id": post_id}, NOFIELDS)
    if not p or (p["author_id"] != member["user_id"] and "blog.manage" not in member["perms"]):
        raise HTTPException(404, "Post not found")
    return p


@api.get("/blog")
async def blog_list(q: str = "", tag: str = "", category: str = "", page: int = 1):
    f = {"status": "published"}
    if q:
        import re
        rx = {"$regex": re.escape(q[:60]), "$options": "i"}
        f["$or"] = [{"title": rx}, {"excerpt": rx}, {"tags": rx}]
    if tag:
        f["tags"] = tag.lower()
    if category:
        f["category"] = category
    size, page = 12, max(1, page)
    total = await db.blog_posts.count_documents(f)
    rows = await db.blog_posts.find(f, POST_LIST_FIELDS).sort([("featured", -1), ("published_at", -1)]).skip((page - 1) * size).limit(size).to_list(size)
    cats = await db.blog_posts.distinct("category", {"status": "published"})
    return {"posts": rows, "total": total, "page": page, "pages": max(1, -(-total // size)), "categories": [c for c in cats if c]}


@api.get("/blog/{slug}")
async def blog_post(slug: str):
    p = await db.blog_posts.find_one_and_update({"slug": slug, "status": "published"}, {"$inc": {"views": 1}},
                                                projection={"_id": 0, "review_note": 0}, return_document=ReturnDocument.AFTER)
    if not p:
        raise HTTPException(404, "Post not found")
    related = await db.blog_posts.find({"status": "published", "id": {"$ne": p["id"]}, "tags": {"$in": p.get("tags") or ["-"]}},
                                       POST_LIST_FIELDS).sort("published_at", -1).limit(3).to_list(3)
    return {"post": p, "related": related}


@api.get("/me/posts")
async def my_posts(member: dict = Depends(blog_writer)):
    return await db.blog_posts.find({"author_id": member["user_id"]}, {"_id": 0, "content": 0}).sort("updated_at", -1).to_list(500)


@api.get("/me/posts/{post_id}")
async def get_my_post(post_id: str, member: dict = Depends(blog_writer)):
    return await _own_post(post_id, member)


@api.post("/me/posts")
async def create_post(body: PostIn, member: dict = Depends(blog_writer)):
    doc = {"id": new_id(), "slug": await _slug(body.title), "author_id": member["user_id"], "author_name": member.get("name") or "FlexoCards",
           "views": 0, "created_at": iso(), "published_at": None, **_post_fields(body, member)}
    await db.blog_posts.insert_one(doc)
    doc.pop("_id", None)
    await audit(member, "blog.created", doc["id"], {"title": body.title, "status": doc["status"]})
    return doc


@api.put("/me/posts/{post_id}")
async def update_post(post_id: str, body: PostIn, member: dict = Depends(blog_writer)):
    old = await _own_post(post_id, member)
    d = _post_fields(body, member, old)
    if body.title != old["title"] and old["status"] != "published":
        d["slug"] = await _slug(body.title, post_id)
    await db.blog_posts.update_one({"id": post_id}, {"$set": d})
    await audit(member, "blog.updated", post_id, {"status": d["status"]})
    return await db.blog_posts.find_one({"id": post_id}, NOFIELDS)


@api.delete("/me/posts/{post_id}")
async def delete_post(post_id: str, member: dict = Depends(blog_writer)):
    await _own_post(post_id, member)
    await db.blog_posts.delete_one({"id": post_id})
    await audit(member, "blog.deleted", post_id)
    return {"ok": True}


@admin.get("/blog/posts")
async def admin_blog_posts(status: str = "", member: dict = Depends(require_perm("blog.manage"))):
    f = {"status": status} if status in ("draft", "pending", "published", "rejected") else {}
    return await db.blog_posts.find(f, {"_id": 0, "content": 0}).sort("updated_at", -1).to_list(500)


class PostStatusIn(BaseModel):
    status: str = Field(pattern="^(draft|pending|published|rejected)$")
    note: str = Field(default="", max_length=300)


@admin.patch("/blog/posts/{post_id}/status")
async def admin_blog_status(post_id: str, body: PostStatusIn, member: dict = Depends(require_perm("blog.manage"))):
    p = await db.blog_posts.find_one({"id": post_id}, NOFIELDS)
    if not p:
        raise HTTPException(404, "Post not found")
    upd = {"status": body.status, "review_note": body.note, "updated_at": iso()}
    if body.status == "published" and not p.get("published_at"):
        upd["published_at"] = iso()
    await db.blog_posts.update_one({"id": post_id}, {"$set": upd})
    await audit(member, f"blog.{body.status}", post_id, {"note": body.note})
    author = await db.users.find_one({"user_id": p["author_id"]}, NOFIELDS)
    if author and author["user_id"] != member["user_id"] and body.status in ("published", "rejected"):
        tpl = ET.blog_published(p["title"], p["slug"]) if body.status == "published" else ET.blog_rejected(p["title"], body.note)
        notify(author["email"], tpl, "blog")
    return {"ok": True}


@admin.get("/blog/authors")
async def admin_blog_authors(member: dict = Depends(require_perm("blog.manage"))):
    rows = await db.users.find({"can_blog": True, **IN_ENV}, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "blog_granted_at": 1}).to_list(500)
    for r in rows:
        r["posts"] = await db.blog_posts.count_documents({"author_id": r["user_id"]})
    return rows


class AuthorIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=200)


@admin.post("/blog/authors")
async def admin_blog_add_author(body: AuthorIn, member: dict = Depends(require_perm("blog.manage"))):
    u = await db.users.find_one({"email": body.email.strip().lower(), "status": "active", **IN_ENV}, NOFIELDS)
    if not u:
        raise HTTPException(404, "No active FlexoCards account uses this email. Ask them to sign up first.")
    await db.users.update_one({"user_id": u["user_id"]}, {"$set": {"can_blog": True, "blog_granted_at": iso(), "blog_granted_by": member["user_id"]}})
    await audit(member, "blog.author_added", u["user_id"], {"email": u["email"]})
    notify(u["email"], ET.blog_author(), "blog")
    return {"user_id": u["user_id"], "email": u["email"], "name": u.get("name")}


@admin.delete("/blog/authors/{user_id}")
async def admin_blog_remove_author(user_id: str, member: dict = Depends(require_perm("blog.manage"))):
    r = await db.users.update_one({"user_id": user_id, "can_blog": True}, {"$set": {"can_blog": False}})
    if not r.modified_count:
        raise HTTPException(404, "Not an author")
    await audit(member, "blog.author_removed", user_id)
    return {"ok": True}


# ---------- email + settings ----------
def email_cfg() -> dict:
    return settings_store.get("email")


def render_tpl(cfg: dict, tpl: dict) -> str:
    return render({**cfg, "social": settings_store.get("social")}, tpl["heading"], tpl["paras"], tpl["cta"], tpl["details"], tpl["eyebrow"], tpl["code"])


async def _deliver(to: str, tpl: dict, kind: str, cfg: dict = None):
    cfg = cfg or email_cfg()
    log = {"id": new_id(), "to": to, "subject": tpl["subject"], "kind": kind, "provider": cfg["provider"], "created_at": iso()}
    try:
        await send_email(cfg, to, tpl["subject"], render_tpl(cfg, tpl))
        log["status"] = "sent"
    except (EmailError, ValueError, httpx.HTTPError) as e:
        log.update(status="failed", error=str(e)[:300])
        logger.warning("email %s to %s failed: %s", kind, to, e)
    await db.email_log.insert_one(log)
    log.pop("_id", None)
    return log


def notify(to: str, tpl: dict, kind: str = "notice"):
    asyncio.create_task(_deliver(to, tpl, kind))


def _rzp_view() -> dict:
    c = settings_store.get("razorpay")
    saved = settings_store.saved_keys("razorpay")
    return {"key_id": c["key_id"], "key_secret_hint": settings_store.hint(c["key_secret"]), "webhook_secret_hint": settings_store.hint(c["webhook_secret"]),
            "source": "admin" if "key_id" in saved else "server", "mode": "test" if c["key_id"].startswith("rzp_test_") else "live" if c["key_id"] else "not_configured",
            "webhook_url": f"{(email_cfg()['site_url'] or '').rstrip('/')}/api/billing/webhook"}


def _email_view() -> dict:
    c = email_cfg()
    return {**{k: v for k, v in c.items() if k != "smtp_pass"}, "smtp_pass_hint": settings_store.hint(c["smtp_pass"]),
            "customized": bool(settings_store.saved_keys("email"))}


@admin.get("/settings")
async def admin_settings(member: dict = Depends(require_perm("settings.manage"))):
    logs = await db.email_log.find({}, NOFIELDS).sort("created_at", -1).limit(15).to_list(15)
    return {"store": settings_store.get("store"), "invoice": settings_store.get("invoice"),
            "razorpay": _rzp_view(), "email": _email_view(), "email_log": logs, "clerk": _clerk_view(), "database": await _db_view(), "site": settings_store.get("site"), "site_status": site_status(),
            "social": settings_store.get("social"), "templates": [{"id": k, "label": v[0]} for k, v in ET.SAMPLES.items()]}


class RzpSettingsIn(BaseModel):
    key_id: str = Field(pattern=r"^rzp_(test|live)_[A-Za-z0-9]{6,40}$")
    key_secret: str = Field(default="", max_length=100)
    webhook_secret: str = Field(default="", max_length=200)


@admin.put("/settings/razorpay")
async def admin_set_razorpay(body: RzpSettingsIn, member: dict = Depends(require_perm("settings.manage"))):
    secret = body.key_secret.strip() or settings_store.get("razorpay")["key_secret"]
    if not secret:
        raise HTTPException(400, "Enter the Key Secret.")
    r = await asyncio.to_thread(requests.get, f"{RZP_API}/orders", params={"count": 1}, auth=(body.key_id.strip(), secret), timeout=15)
    if r.status_code in (401, 403):
        raise HTTPException(400, "Razorpay rejected these keys. Check the Key ID and Key Secret.")
    if r.status_code >= 400:
        raise HTTPException(400, "Couldn't reach Razorpay to check the keys. Try again.")
    await settings_store.save(cfg_db, "razorpay", {"key_id": body.key_id.strip(), "key_secret": body.key_secret.strip() or None,
                                               "webhook_secret": body.webhook_secret.strip() or None}, member["user_id"], iso())
    await audit(member, "settings.razorpay_updated", "razorpay", {"key_id": body.key_id[:14] + "…", "webhook": bool(body.webhook_secret)})
    return _rzp_view()


class EmailSettingsIn(BaseModel):
    provider: str = Field(pattern="^(emergent|smtp)$")
    from_name: str = Field(min_length=2, max_length=60)
    reply_to: str = Field(default="", max_length=200, pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")
    site_url: str = Field(default="", max_length=200, pattern=r"^$|^https://[^\s/]+(/[^\s]*)?$")
    smtp_host: str = Field(default="", max_length=200)
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_secure: str = Field(default="ssl", pattern="^(ssl|starttls|none)$")
    smtp_user: str = Field(default="", max_length=200)
    smtp_pass: str = Field(default="", max_length=300)
    smtp_from_email: str = Field(default="", max_length=200, pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")
    smtp_from_name: str = Field(default="", max_length=60)


@admin.put("/settings/email")
async def admin_set_email(body: EmailSettingsIn, member: dict = Depends(require_perm("settings.manage"))):
    vals = body.model_dump()
    vals["smtp_pass"] = vals["smtp_pass"] or None
    if body.provider == "smtp":
        merged = {**email_cfg(), **{k: v for k, v in vals.items() if v is not None}}
        if not (merged["smtp_host"] and merged["smtp_user"] and merged["smtp_pass"]):
            raise HTTPException(400, "To use SMTP, fill in host, username and password.")
    await settings_store.save(cfg_db, "email", vals, member["user_id"], iso())
    await audit(member, "settings.email_updated", "email", {"provider": body.provider, "smtp_host": body.smtp_host})
    return _email_view()


@admin.delete("/settings/{section}")
async def admin_reset_settings(section: str, member: dict = Depends(require_perm("settings.manage"))):
    if section not in ("razorpay", "email", "clerk", "social"):
        raise HTTPException(404, "Unknown settings section")
    await settings_store.reset(cfg_db, section)
    await audit(member, f"settings.{section}_reset", section)
    return {"razorpay": _rzp_view(), "email": _email_view(), "clerk": _clerk_view(), "social": settings_store.get("social")}


@admin.post("/settings/email/test")
async def admin_test_email(request: Request, member: dict = Depends(require_perm("settings.manage"))):
    rate_limit(request, "email_test", 5)
    if not member.get("email"):
        raise HTTPException(400, "Your account has no email address.")
    cfg = email_cfg()
    log = await _deliver(member["email"], ET.test_email("SMTP · " + cfg["smtp_host"] if cfg["provider"] == "smtp" else "Emergent email", cfg["from_name"]), "test", cfg)
    if log["status"] != "sent":
        raise HTTPException(400, f"Test email failed: {log.get('error', 'unknown error')}")
    return {"ok": True, "to": member["email"], "provider": cfg["provider"]}


@admin.get("/settings/email/preview/{tid}")
async def admin_email_preview(tid: str, member: dict = Depends(require_perm("settings.manage"))):
    if tid not in ET.SAMPLES:
        raise HTTPException(404, "Unknown template")
    tpl = ET.SAMPLES[tid][1]()
    return {"subject": tpl["subject"], "html": render_tpl(email_cfg(), tpl)}


@admin.post("/settings/email/preview/{tid}/send")
async def admin_email_preview_send(tid: str, request: Request, member: dict = Depends(require_perm("settings.manage"))):
    rate_limit(request, "email_test", 10)
    if tid not in ET.SAMPLES or not member.get("email"):
        raise HTTPException(404, "Unknown template")
    tpl = ET.SAMPLES[tid][1]()
    log = await _deliver(member["email"], {**tpl, "subject": f"[Sample] {tpl['subject']}"}, f"sample:{tid}")
    if log["status"] != "sent":
        raise HTTPException(400, f"Sample email failed: {log.get('error', 'unknown error')}")
    return {"ok": True, "to": member["email"]}


def _clerk_view() -> dict:
    sec = settings_store.get("clerk")["webhook_secret"]
    return {"webhook_secret_hint": settings_store.hint(sec), "connected": bool(sec),
            "webhook_url": f"{(email_cfg()['site_url'] or '').rstrip('/')}/api/clerk/webhook"}


class ClerkSettingsIn(BaseModel):
    webhook_secret: str = Field(pattern=r"^whsec_[A-Za-z0-9+/=]{10,200}$")


@admin.put("/settings/clerk")
async def admin_set_clerk(body: ClerkSettingsIn, member: dict = Depends(require_perm("settings.manage"))):
    await settings_store.save(cfg_db, "clerk", {"webhook_secret": body.webhook_secret.strip()}, member["user_id"], iso())
    await audit(member, "settings.clerk_updated", "clerk")
    return _clerk_view()


SOCIAL_URL = r"^$|^https://[^\s]{4,300}$"


class SocialIn(BaseModel):
    instagram: str = Field(default="", pattern=SOCIAL_URL)
    facebook: str = Field(default="", pattern=SOCIAL_URL)
    x: str = Field(default="", pattern=SOCIAL_URL)
    youtube: str = Field(default="", pattern=SOCIAL_URL)
    linkedin: str = Field(default="", pattern=SOCIAL_URL)
    whatsapp: str = Field(default="", pattern=SOCIAL_URL)
    telegram: str = Field(default="", pattern=SOCIAL_URL)
    threads: str = Field(default="", pattern=SOCIAL_URL)


@admin.put("/settings/social")
async def admin_set_social(body: SocialIn, member: dict = Depends(require_perm("settings.manage"))):
    await settings_store.reset(cfg_db, "social")
    await settings_store.save(cfg_db, "social", {k: v.strip() for k, v in body.model_dump().items()}, member["user_id"], iso())
    await audit(member, "settings.social_updated", "social", {k: bool(v) for k, v in body.model_dump().items()})
    return settings_store.get("social")


@api.get("/site/social")
async def site_social():
    return {k: v for k, v in settings_store.get("social").items() if v}


@api.post("/clerk/webhook")
async def clerk_webhook(request: Request):
    import base64
    secret = settings_store.get("clerk")["webhook_secret"]
    if not secret:
        raise HTTPException(503, "Clerk webhook is not set up")
    raw = await request.body()
    sid, ts, sigs = (request.headers.get(h, "") for h in ("svix-id", "svix-timestamp", "svix-signature"))
    if not (sid and ts.isdigit() and sigs) or abs(time.time() - int(ts)) > 300:
        raise HTTPException(400, "Invalid webhook headers")
    key = base64.b64decode(secret.split("_", 1)[1])
    expected = base64.b64encode(hmac.new(key, f"{sid}.{ts}.".encode() + raw, hashlib.sha256).digest()).decode()
    if not any(hmac.compare_digest(expected, s.split(",", 1)[1]) for s in sigs.split() if "," in s):
        raise HTTPException(401, "Invalid signature")
    if await db.webhook_events.find_one({"event_id": f"clerk:{sid}"}):
        return {"ok": True, "duplicate": True}
    evt = json.loads(raw)
    d = evt.get("data") or {}
    if evt.get("type") != "email.created" or d.get("delivered_by_clerk") or not d.get("to_email_address"):
        return {"ok": True, "skipped": True}
    slug, v = d.get("slug") or "", d.get("data") or {}
    link = v.get("magic_link") or v.get("action_url") or v.get("url") or ""
    if v.get("otp_code"):
        tpl = ET.auth_code(slug, str(v["otp_code"])[:12], v.get("ttl_minutes"))
    elif link.startswith("https://"):
        tpl = ET.auth_link(slug, link)
    else:
        tpl = ET.security_notice(slug, d.get("subject") or "FlexoCards account update")
    log = await _deliver(d["to_email_address"], tpl, f"clerk:{slug}")
    if log["status"] != "sent":
        raise HTTPException(500, "Email delivery failed")
    await db.webhook_events.insert_one({"event_id": f"clerk:{sid}", "type": "clerk.email.created", "slug": slug, "received_at": iso()})
    return {"ok": True}


# ---------- database settings ----------
def _mask_url(url: str) -> str:
    return re.sub(r"//[^@/]+@", "//••••@", url or "")


async def _db_stats(d) -> dict:
    t = time.time()
    await d.command("ping")
    ping = round((time.time() - t) * 1000)
    st = await d.command("dbstats")
    names = sorted(n for n in await d.list_collection_names() if not n.startswith("system."))
    counts = {n: await d[n].estimated_document_count() for n in names}
    return {"ping_ms": ping, "data_mb": round(st.get("dataSize", 0) / 1048576, 2), "storage_mb": round(st.get("storageSize", 0) / 1048576, 2), "collections": counts}


async def _db_view() -> dict:
    c = settings_store.get("database")
    out = {"mode": DB_STATE["mode"], "error": DB_STATE["error"], "db_name": db.name,
           "custom_url": _mask_url(c["url"]), "custom_db_name": c["db_name"], "custom_saved": bool(c["url"])}
    try:
        out.update(ok=True, **await _db_stats(db))
    except Exception as e:
        out.update(ok=False, error=out["error"] or f"Database check failed: {str(e)[:200]}")
    return out


class DbIn(BaseModel):
    url: str = Field(default="", max_length=1000)
    db_name: str = Field(pattern=r"^[A-Za-z0-9_-]{1,60}$")
    copy_data: bool = False


async def _check_target(body: DbIn):
    url = body.url.strip() or settings_store.get("database")["url"]
    if not re.match(r"^mongodb(\+srv)?://", url):
        raise HTTPException(400, "Enter a MongoDB URL starting with mongodb:// or mongodb+srv://")
    try:
        c, d = await connect_mongo(url, body.db_name)
        return url, c, d, await _db_stats(d)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Couldn't connect: {str(e)[:220]}")


@admin.post("/settings/database/test")
async def admin_db_test(body: DbIn, member: dict = Depends(require_perm("settings.manage"))):
    _, c, _, stats = await _check_target(body)
    c.close()
    return {"ok": True, **stats}


@admin.put("/settings/database")
async def admin_db_switch(body: DbIn, member: dict = Depends(require_perm("settings.manage"))):
    url, c, target, _ = await _check_target(body)
    copied = {}
    if body.copy_data:
        for name in await db.list_collection_names():
            if name.startswith("system.") or name == "app_settings":
                continue
            docs = await db[name].find({}).to_list(None)
            if not docs:
                continue
            try:
                res = await target[name].insert_many(docs, ordered=False)
                copied[name] = len(res.inserted_ids)
            except BulkWriteError as e:
                copied[name] = e.details.get("nInserted", 0)
    c.close()
    await settings_store.save(cfg_db, "database", {"enabled": True, "url": url, "db_name": body.db_name}, member["user_id"], iso())
    await activate_db(url, body.db_name)
    await prepare_db()
    _STAFF_CACHE.clear()
    await audit(member, "settings.database_switched", "database", {"db_name": body.db_name, "copied": copied})
    return {"copied": copied, "database": await _db_view()}


@admin.post("/settings/database/use-default")
async def admin_db_default(member: dict = Depends(require_perm("settings.manage"))):
    await settings_store.save(cfg_db, "database", {"enabled": False}, member["user_id"], iso())
    use_default_db()
    _STAFF_CACHE.clear()
    await audit(member, "settings.database_default", "database")
    return await _db_view()


@admin.get("/settings/database/backup")
async def admin_db_backup(member: dict = Depends(require_perm("settings.manage"))):
    from bson import json_util
    names = [n for n in await db.list_collection_names() if not n.startswith("system.") and n != "app_settings"]

    async def gen():
        yield '{"app":"FlexoCards","exported_at":"' + iso() + '","collections":{'
        for i, n in enumerate(names):
            yield ("," if i else "") + json.dumps(n) + ":["
            first = True
            async for doc in db[n].find({}):
                yield ("" if first else ",") + json_util.dumps(doc)
                first = False
            yield "]"
        yield "}}"
    await audit(member, "settings.database_backup", "database")
    fname = f"flexocards-backup-{now().strftime('%Y%m%d-%H%M')}.json"
    return StreamingResponse(gen(), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ---------- storybook (Pro & Team) ----------
STORYBOOK_PLANS = ("pro", "team")


class PageIn(BaseModel):
    image: str = Field(max_length=15_000_000)
    title: str = Field(default="", max_length=120)
    sport_id: str = Field(default="", max_length=60)
    template_id: str = Field(default="", max_length=60)
    format: str = Field(default="card", pattern="^(card|story)$")


@api.post("/me/storybook")
async def add_story_page(body: PageIn, request: Request, member: dict = Depends(current_member)):
    rate_limit(request, "storybook", 30)
    if (await get_entitlements(member))["plan_id"] not in STORYBOOK_PLANS:
        upgrade_error("The storybook is part of the Pro and Team plans.", "storybook")
    if await db.storybook_pages.count_documents({"user_id": member["user_id"]}) >= 300:
        raise HTTPException(400, "Your storybook is full (300 pages). Remove some pages first.")
    import base64
    prefix = "data:image/png;base64,"
    if not body.image.startswith(prefix):
        raise HTTPException(400, "Card image must be a PNG")
    try:
        raw = base64.b64decode(body.image[len(prefix):], validate=True)
    except ValueError:
        raise HTTPException(400, "Invalid image")
    try:
        res = put_object(f"{APP_PREFIX}/storybook/{member['user_id']}/{new_id()}.png", raw, "image/png")
    except requests.RequestException:
        raise HTTPException(400, "Couldn't save to your storybook. Try again.")
    await db.files.insert_one({"id": new_id(), "storage_path": res["path"], "content_type": "image/png", "public": False, "owner_id": member["user_id"],
                               "kind": "storybook", "size": len(raw), "is_deleted": False, "created_at": iso()})
    sport = await db.sports.find_one({"id": body.sport_id}, {"_id": 0, "name": 1})
    page = {"id": new_id(), "user_id": member["user_id"], "image_path": res["path"], "title": body.title or "Player card",
            "sport": (sport or {}).get("name", ""), "template_id": body.template_id, "format": body.format, "created_at": iso()}
    await db.storybook_pages.insert_one(page)
    page.pop("_id", None)
    return {k: v for k, v in page.items() if k != "image_path"}


@api.get("/me/storybook")
async def list_story_pages(member: dict = Depends(current_member)):
    ent = await get_entitlements(member)
    pages = await db.storybook_pages.find({"user_id": member["user_id"]}, {"_id": 0, "image_path": 0}).sort("created_at", 1).to_list(300)
    return {"enabled": ent["plan_id"] in STORYBOOK_PLANS, "pages": pages}


@api.get("/me/storybook/{page_id}/image")
async def story_page_image(page_id: str, member: dict = Depends(current_member)):
    p = await db.storybook_pages.find_one({"id": page_id, "user_id": member["user_id"]}, NOFIELDS)
    if not p:
        raise HTTPException(404, "Page not found")
    try:
        data, _ = get_object(p["image_path"])
    except requests.RequestException:
        raise HTTPException(400, "Couldn't load this page")
    return Response(content=data, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


@api.delete("/me/storybook/{page_id}")
async def delete_story_page(page_id: str, member: dict = Depends(current_member)):
    p = await db.storybook_pages.find_one_and_delete({"id": page_id, "user_id": member["user_id"]})
    if not p:
        raise HTTPException(404, "Page not found")
    await db.files.update_one({"storage_path": p["image_path"]}, {"$set": {"is_deleted": True}})
    return {"ok": True}


# ---------- coupons ----------
class CouponIn(BaseModel):
    code: str = Field(pattern=r"^[A-Za-z0-9_-]{3,30}$")
    type: str = Field(pattern="^(percent|flat)$")
    value: float = Field(gt=0, le=100000)
    applies_to: str = Field(default="all", pattern="^(all|plans|extras)$")
    max_uses: int = Field(default=0, ge=0, le=1000000)
    once_per_user: bool = True
    expires_at: str = Field(default="", max_length=40)
    active: bool = True


@admin.get("/coupons")
async def admin_coupons(member: dict = Depends(require_perm("plans.manage"))):
    return await db.coupons.find({}, NOFIELDS).sort("created_at", -1).to_list(500)


@admin.post("/coupons")
async def admin_coupon_save(body: CouponIn, member: dict = Depends(require_perm("plans.manage"))):
    if body.type == "percent" and body.value > 100:
        raise HTTPException(400, "A percent discount can't be more than 100.")
    if body.expires_at and not _dt(body.expires_at):
        raise HTTPException(400, "Enter a valid expiry date.")
    d = {**body.model_dump(), "code": body.code.upper(), "expires_at": iso(_aware(body.expires_at)) if body.expires_at else ""}
    await db.coupons.update_one({"code": d["code"]}, {"$set": d, "$setOnInsert": {"uses": 0, "created_at": iso(), "id": new_id()}}, upsert=True)
    await audit(member, "coupon.saved", d["code"], {k: d[k] for k in ("type", "value", "applies_to", "max_uses", "active")})
    return await db.coupons.find_one({"code": d["code"]}, NOFIELDS)


@admin.delete("/coupons/{code}")
async def admin_coupon_delete(code: str, member: dict = Depends(require_perm("plans.manage"))):
    await db.coupons.delete_one({"code": code.upper()})
    await audit(member, "coupon.deleted", code.upper())
    return {"ok": True}


# ---------- store / invoice settings ----------
class PackIn(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9_-]{2,20}$")
    cards: int = Field(ge=1, le=1000)
    price: float = Field(ge=1, le=100000)


class StoreIn(BaseModel):
    packs: List[PackIn] = Field(max_length=6)
    wm_price: float = Field(ge=1, le=10000)
    wm_bundle_qty: int = Field(ge=2, le=100)
    wm_bundle_price: float = Field(ge=1, le=100000)
    ref_enabled: bool = True
    ref_reward_cards: int = Field(ge=0, le=50)
    ref_max_rewards: int = Field(ge=0, le=10000)


@api.get("/store")
async def store_public():
    st = settings_store.get("store")
    return {k: st[k] for k in ("packs", "wm_price", "wm_bundle_qty", "wm_bundle_price", "ref_enabled", "ref_reward_cards")}


@admin.put("/settings/store")
async def admin_set_store(body: StoreIn, member: dict = Depends(require_perm("settings.manage"))):
    await settings_store.save(cfg_db, "store", body.model_dump(), member["user_id"], iso())
    await audit(member, "settings.store_updated", "store", body.model_dump())
    return settings_store.get("store")


class InvoiceIn(BaseModel):
    legal_name: str = Field(min_length=2, max_length=160)
    gstin: str = Field(default="", pattern=r"^$|^[0-9]{2}[A-Z0-9]{13}$")
    address: str = Field(default="", max_length=400)
    state: str = Field(default="", max_length=40)
    state_code: str = Field(default="", pattern=r"^$|^[0-9]{2}$")
    gst_rate: float = Field(ge=0, le=28)
    inclusive: bool = True
    sac: str = Field(default="998439", max_length=10)
    prefix: str = Field(pattern=r"^[A-Z0-9]{1,8}$")
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=30)


@admin.put("/settings/invoice")
async def admin_set_invoice(body: InvoiceIn, member: dict = Depends(require_perm("settings.manage"))):
    await settings_store.save(cfg_db, "invoice", body.model_dump(), member["user_id"], iso())
    await audit(member, "settings.invoice_updated", "invoice", {"gstin": body.gstin, "rate": body.gst_rate})
    return settings_store.get("invoice")


def build_invoice(pay: dict) -> dict:
    inv = settings_store.get("invoice")
    total = float(pay["amount_inr"])
    rate = float(inv["gst_rate"]) if inv["gstin"] else 0.0
    taxable = round(total / (1 + rate / 100), 2)  # amount_inr is what was charged, tax included either way
    tax = round(total - taxable, 2)
    grand = round(taxable + tax, 2)
    b = pay.get("billing") or {}
    intra = not b.get("state") or not inv["state"] or b["state"].strip().lower() == inv["state"].strip().lower()
    lines = [{"desc": pay.get("item_label") or f"{pay['plan_name']} plan", "sac": inv["sac"], "qty": 1, "list_price": pay.get("list_price_inr", total),
              "discount": pay.get("discount_inr", 0), "taxable": taxable}]
    taxes = ([{"name": f"CGST {rate / 2:g}%", "amount": round(tax / 2, 2)}, {"name": f"SGST {rate / 2:g}%", "amount": round(tax - round(tax / 2, 2), 2)}]
             if intra else [{"name": f"IGST {rate:g}%", "amount": tax}]) if rate else []
    return {"title": "Tax Invoice" if inv["gstin"] else "Payment Receipt", "number": pay.get("invoice_no"), "date": pay.get("paid_at"),
            "seller": {k: inv[k] for k in ("legal_name", "gstin", "address", "state", "state_code", "email", "phone")},
            "buyer": {"name": b.get("name") or pay.get("user_email", ""), "gstin": b.get("gstin", ""), "state": b.get("state", ""), "email": pay.get("user_email", "")},
            "lines": lines, "taxes": taxes, "taxable": taxable, "tax": tax, "total": grand, "coupon": pay.get("coupon"),
            "payment_id": pay.get("razorpay_payment_id"), "status": pay["status"]}


@api.get("/me/payments/{payment_id}/invoice")
async def my_invoice(payment_id: str, member: dict = Depends(current_member)):
    pay = await db.payments.find_one({"id": payment_id, "user_id": member["user_id"], "status": {"$in": ["captured", "refunded"]}}, NOFIELDS)
    if not pay or not pay.get("invoice_no"):
        raise HTTPException(404, "Invoice not available for this payment.")
    return build_invoice(pay)


@admin.get("/payments/{payment_id}/invoice")
async def admin_invoice(payment_id: str, member: dict = Depends(require_perm("subscriptions.view"))):
    pay = await db.payments.find_one({"id": payment_id}, NOFIELDS)
    if not pay or not pay.get("invoice_no"):
        raise HTTPException(404, "Invoice not available for this payment.")
    return build_invoice(pay)


# ---------- referrals ----------
async def _ref_code(member: dict) -> str:
    u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "ref_code": 1})
    if u and u.get("ref_code"):
        return u["ref_code"]
    while True:
        code = secrets.token_urlsafe(5).replace("-", "").replace("_", "")[:6].upper()
        if len(code) == 6 and not await db.users.find_one({"ref_code": code}):
            break
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"ref_code": code}})
    return code


@api.get("/me/referral")
async def my_referral(member: dict = Depends(current_member)):
    st = settings_store.get("store")
    count = await db.referrals.count_documents({"referrer_id": member["user_id"]})
    return {"enabled": st["ref_enabled"], "code": await _ref_code(member), "reward_cards": st["ref_reward_cards"],
            "count": count, "earned": await db.referrals.count_documents({"referrer_id": member["user_id"], "rewarded": True}) * st["ref_reward_cards"]}


class ClaimIn(BaseModel):
    code: str = Field(pattern=r"^[A-Za-z0-9]{6}$")


@api.post("/me/referral/claim")
async def claim_referral(body: ClaimIn, member: dict = Depends(current_member)):
    st = settings_store.get("store")
    if not st["ref_enabled"]:
        raise HTTPException(400, "Referrals are paused right now.")
    if datetime.fromisoformat(member["created_at"]) < now() - timedelta(days=7):
        raise HTTPException(400, "Invite links only work for new accounts.")
    ref = await db.users.find_one({"ref_code": body.code.upper()}, NOFIELDS)
    if not ref or ref["user_id"] == member["user_id"]:
        raise HTTPException(400, "This invite code isn't valid.")
    if await db.referrals.find_one({"referee_id": ref["user_id"], "referrer_id": member["user_id"]}):
        raise HTTPException(400, "You can't use the invite code of someone you invited.")
    try:
        await db.referrals.insert_one({"id": new_id(), "referee_id": member["user_id"], "referrer_id": ref["user_id"], "code": body.code.upper(), "created_at": iso()})
    except DuplicateKeyError:
        raise HTTPException(400, "You've already used an invite code.")
    n = st["ref_reward_cards"]
    await db.users.update_one({"user_id": member["user_id"]}, {"$inc": {"bonus_cards": n}})
    rewarded = await db.referrals.count_documents({"referrer_id": ref["user_id"], "rewarded": True}) < st["ref_max_rewards"]
    if rewarded:
        await db.users.update_one({"user_id": ref["user_id"]}, {"$inc": {"bonus_cards": n}})
        await db.referrals.update_one({"referee_id": member["user_id"]}, {"$set": {"rewarded": True}})
        if ref.get("email"):
            notify(ref["email"], ET.referral_reward(n, member.get("name")), "referral")
    return {"ok": True, "bonus_cards": n}


def _dt(v: str):
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None
    except ValueError:
        return None


def site_status() -> dict:
    c, n = settings_store.get("site"), now()
    launch = _dt(c["cs_launch_at"])
    start = _dt(c["mt_start_at"])
    end = start + timedelta(minutes=int(c["mt_duration_min"])) if start else None
    state = "live"
    if c["cs_enabled"] and not (c["cs_auto_open"] and launch and n >= launch):
        state = "coming_soon"
    elif c["mt_enabled"] and start and n < end:
        state = "maintenance" if n >= start else "maintenance_scheduled"
    return {"state": state, "blocked": state in ("coming_soon", "maintenance"), "server_time": iso(),
            "coming_soon": {"launch_at": iso(launch) if launch else None, "title": c["cs_title"], "message": c["cs_message"]},
            "maintenance": {"start_at": iso(start) if start else None, "end_at": iso(end) if end else None,
                            "duration_min": int(c["mt_duration_min"]), "message": c["mt_message"]}}


@api.get("/site/status")
async def get_site_status():
    return site_status()


class SiteIn(BaseModel):
    cs_enabled: bool
    cs_launch_at: str = Field(default="", max_length=40)
    cs_title: str = Field(default="", max_length=80)
    cs_message: str = Field(default="", max_length=300)
    cs_auto_open: bool = True
    mt_enabled: bool
    mt_start_at: str = Field(default="", max_length=40)
    mt_duration_min: int = Field(default=60, ge=5, le=10080)
    mt_message: str = Field(default="", max_length=300)


@admin.put("/settings/site")
async def admin_set_site(body: SiteIn, member: dict = Depends(require_perm("settings.manage"))):
    for f in ("cs_launch_at", "mt_start_at"):
        if getattr(body, f) and not _dt(getattr(body, f)):
            raise HTTPException(400, "Enter a valid date and time.")
    if body.cs_enabled and body.cs_auto_open and not body.cs_launch_at:
        raise HTTPException(400, "Set a launch date and time, or turn off automatic opening.")
    if body.mt_enabled and not body.mt_start_at:
        raise HTTPException(400, "Set when maintenance starts (or press Start now).")
    vals = body.model_dump()
    await settings_store.reset(cfg_db, "site")
    await settings_store.save(cfg_db, "site", vals, member["user_id"], iso())
    await audit(member, "settings.site_updated", "site", {"coming_soon": body.cs_enabled, "maintenance": body.mt_enabled,
                                                           "launch_at": body.cs_launch_at, "mt_start_at": body.mt_start_at, "mt_minutes": body.mt_duration_min})
    _STAFF_CACHE.clear()
    return {"site": settings_store.get("site"), "status": site_status()}


_STAFF_CACHE: dict = {}
GATE_OPEN = ("/api/site/", "/api/clerk/", "/api/admin/", "/api/billing/webhook", "/api/billing/config")


async def _is_staff_request(request: Request) -> bool:
    try:
        uid = require_user(request)["user_id"]
    except HTTPException:
        return False
    hit = _STAFF_CACHE.get(uid)
    if hit and hit[1] > time.time():
        return hit[0]
    u = await db.users.find_one({"user_id": uid}, {"_id": 0, "role": 1, "status": 1})
    ok = bool(u and u.get("status") == "active" and effective_role(u.get("role")) != "user")
    _STAFF_CACHE[uid] = (ok, time.time() + 30)
    return ok


@app.middleware("http")
async def site_gate(request: Request, call_next):
    p = request.url.path
    if p.startswith("/api/") and p not in ("/api/", "/api/me") and request.method != "OPTIONS" and not p.startswith(GATE_OPEN):
        st = site_status()
        if st["blocked"] and not await _is_staff_request(request):
            msg = "FlexoCards is launching soon." if st["state"] == "coming_soon" else "FlexoCards is under maintenance. Please try again soon."
            return JSONResponse({"detail": msg, "site_state": st["state"]}, status_code=423)
    return await call_next(request)


app.include_router(api)
app.include_router(admin)
app.include_router(clerk_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
