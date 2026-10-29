import os

from cryptography.fernet import Fernet, InvalidToken

_CACHE: dict = {}
_fernet = Fernet(os.environ["SETTINGS_ENC_KEY"].encode())

SECRET_FIELDS = {"razorpay": {"key_secret", "webhook_secret"}, "email": {"smtp_pass"}, "clerk": {"webhook_secret"}, "database": {"url"}}
SOCIAL_KEYS = ("instagram", "facebook", "x", "youtube", "linkedin", "whatsapp", "telegram", "threads")


def env_defaults(section: str) -> dict:
    e = os.environ.get
    if section == "razorpay":
        return {"key_id": e("RAZORPAY_KEY_ID", ""), "key_secret": e("RAZORPAY_KEY_SECRET", ""), "webhook_secret": e("RAZORPAY_WEBHOOK_SECRET", "")}
    if section == "clerk":
        return {"webhook_secret": e("CLERK_WEBHOOK_SECRET", "")}
    if section == "social":
        return {k: "" for k in SOCIAL_KEYS}
    if section == "database":
        return {"enabled": False, "url": "", "db_name": ""}
    if section == "site":
        return {"cs_enabled": False, "cs_launch_at": "", "cs_title": "Something big is coming", "cs_message": "FlexoCards is getting ready to launch. Stay tuned!",
                "cs_auto_open": True, "mt_enabled": False, "mt_start_at": "", "mt_duration_min": 60,
                "mt_message": "We're upgrading FlexoCards to make it even better. We'll be back shortly."}
    return {"provider": "emergent", "from_name": e("EMAIL_FROM_NAME", "FlexoCards"), "reply_to": e("EMAIL_REPLY_TO", ""),
            "site_url": e("APP_PUBLIC_URL", ""), "smtp_host": e("SMTP_HOST", ""), "smtp_port": int(e("SMTP_PORT", "465") or 465),
            "smtp_secure": e("SMTP_SECURE", "ssl"), "smtp_user": e("SMTP_USER", ""), "smtp_pass": e("SMTP_PASS", ""),
            "smtp_from_email": e("SMTP_FROM_EMAIL", ""), "smtp_from_name": e("SMTP_FROM_NAME", "FlexoCards")}


def _dec(v: str) -> str:
    try:
        return _fernet.decrypt(v.encode()).decode()
    except (InvalidToken, ValueError):
        return ""


async def load_all(db):
    async for doc in db.app_settings.find({}):
        _CACHE[doc["_id"]] = doc


def get(section: str) -> dict:
    """Env defaults overlaid with any non-empty values saved from the admin panel."""
    out = env_defaults(section)
    saved = _CACHE.get(section) or {}
    for k in out:
        v = saved.get(k)
        if v in (None, ""):
            continue
        out[k] = _dec(v) if k in SECRET_FIELDS.get(section, ()) else v
    return out


def saved_keys(section: str) -> set:
    return {k for k, v in (_CACHE.get(section) or {}).items() if v not in (None, "") and k not in ("_id", "updated_at", "updated_by")}


async def save(db, section: str, values: dict, actor: str, now_iso: str):
    doc = dict(_CACHE.get(section) or {"_id": section})
    for k, v in values.items():
        if v is None:
            continue
        doc[k] = _fernet.encrypt(v.encode()).decode() if k in SECRET_FIELDS.get(section, ()) and v else v
    doc.update({"updated_at": now_iso, "updated_by": actor})
    await db.app_settings.replace_one({"_id": section}, doc, upsert=True)
    _CACHE[section] = doc


async def reset(db, section: str):
    await db.app_settings.delete_one({"_id": section})
    _CACHE.pop(section, None)


def hint(secret: str) -> str:
    return f"••••{secret[-4:]}" if secret else ""
