import asyncio
import ipaddress
import logging
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]


class EmailError(Exception):
    pass


# ---------- guardrail gate (G2/G3) ----------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


# ---------- template ----------
NAVY, GOLD, INK = "#0b1a3a", "#f5b400", "#1f2937"
FONT = "font-family:'Segoe UI',Helvetica,Arial,sans-serif"


def _brand_text(brand: str, size: int) -> str:
    return (f'<span style="{FONT};font-size:{size}px;font-weight:900;font-style:italic;letter-spacing:-.5px;color:{NAVY}">Flexo</span>'
            f'<span style="{FONT};font-size:{size}px;font-weight:900;font-style:italic;letter-spacing:-.5px;color:{GOLD}">Cards</span>'
            if brand.lower() == "flexocards" else f'<span style="{FONT};font-size:{size}px;font-weight:900;color:{NAVY}">{brand}</span>')


def render(cfg: dict, heading: str, paragraphs: list, cta: tuple = None, details: list = None, eyebrow: str = "", code: str = "") -> str:
    brand = escape(cfg["from_name"] or "FlexoCards")
    site = (cfg.get("site_url") or "").rstrip("/")
    https = site.startswith("https://")
    logo = (f'<a href="{escape(site)}/" style="text-decoration:none"><img src="{escape(site)}/logo-wordmark.png" width="220" alt="{brand}" '
            f'style="display:block;width:220px;max-width:70%;height:auto;border:0;margin:0 auto"></a>') if https else _brand_text(brand, 30)
    body = "".join(f'<p style="margin:0 0 16px;{FONT};font-size:15px;line-height:1.65;color:{INK}">{escape(p)}</p>' for p in paragraphs)
    box = ""
    if details:
        rows = "".join(
            f'<tr><td style="padding:10px 16px;{FONT};font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb">{escape(k)}</td>'
            f'<td align="right" style="padding:10px 16px;{FONT};font-size:14px;font-weight:700;color:{NAVY};border-bottom:1px solid #e5e7eb">{escape(str(v))}</td></tr>'
            for k, v in details)
        box = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;background:#f8fafc;'
               f'border:1px solid #e5e7eb;border-left:4px solid {GOLD};border-radius:10px;border-collapse:separate">{rows}</table>')
    otp = ""
    if code:
        otp = (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px"><tr><td align="center" '
               f'style="background:{NAVY};border-radius:14px;padding:22px 12px;border:2px dashed {GOLD}">'
               f'<p style="margin:0 0 6px;{FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8">Your code</p>'
               f'<p style="margin:0;font-family:Consolas,Menlo,monospace;font-size:38px;font-weight:800;letter-spacing:12px;color:{GOLD}">{escape(code)}</p>'
               f'</td></tr></table>')
    button = ""
    href = (cta[1] if cta and cta[1].startswith("https://") else site + cta[1] if cta and https else "") if cta else ""
    if href:
        button = (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="background:{GOLD};border-radius:999px">'
                  f'<a href="{escape(href)}" style="display:inline-block;padding:14px 30px;{FONT};font-size:15px;font-weight:800;'
                  f'color:{NAVY};text-decoration:none;text-transform:uppercase;letter-spacing:.6px">{escape(cta[0])} &rarr;</a></td></tr></table>')
    links = ""
    if https:
        links = " &nbsp;·&nbsp; ".join(f'<a href="{escape(site + p)}" style="color:{GOLD};text-decoration:none;font-weight:600">{label}</a>'
                                       for label, p in (("Create a card", "/create"), ("Pricing", "/pricing"), ("Blog", "/blog"), ("Help", "/help")))
        links = f'<p style="margin:0 0 14px;{FONT};font-size:13px">{links}</p>'
    social = " &nbsp;&nbsp; ".join(f'<a href="{escape(u)}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:12px">{label}</a>'
                                   for label, u in social_links(cfg.get("social") or {}))
    if social:
        links += f'<p style="margin:0 0 14px;{FONT}">{social}</p>'
    return (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0">{escape(heading)} — {brand}</div>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 12px"><tr><td align="center">'
        f'<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;'
        f'overflow:hidden;border-collapse:separate;box-shadow:0 8px 30px rgba(11,26,58,.12)">'
        f'<tr><td align="center" style="padding:26px 24px 20px;background:#ffffff">{logo}</td></tr>'
        f'<tr><td style="height:5px;line-height:5px;font-size:0;background:{GOLD};background-image:linear-gradient(90deg,{NAVY},{GOLD},{NAVY})">&nbsp;</td></tr>'
        f'<tr><td style="background:{NAVY};padding:34px 32px 30px">'
        f'<p style="margin:0 0 10px;{FONT};font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:{GOLD}">{escape(eyebrow or brand)}</p>'
        f'<h1 style="margin:0;{FONT};font-size:28px;line-height:1.15;font-weight:900;color:#ffffff;text-transform:uppercase;letter-spacing:-.3px">{escape(heading)}</h1>'
        f'</td></tr>'
        f'<tr><td style="padding:30px 32px 26px">{body}{otp}{box}{button}</td></tr>'
        f'<tr><td style="background:#081330;padding:26px 32px;text-align:center">'
        f'<p style="margin:0 0 4px;{FONT};font-size:20px;font-weight:900;font-style:italic"><span style="color:#ffffff">Flexo</span><span style="color:{GOLD}">Cards</span></p>'
        f'<p style="margin:0 0 14px;{FONT};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8">Create &nbsp;·&nbsp; Customize &nbsp;·&nbsp; Share</p>'
        f'{links}'
        f'<p style="margin:0 0 6px;{FONT};font-size:11px;line-height:1.6;color:#94a3b8">Sent by {brand}, a product of Buddy Innovations and Technologies Private Limited.</p>'
        f'<p style="margin:0;{FONT};font-size:11px;color:#64748b">We never ask for your password or card details by email.</p>'
        f'</td></tr></table></td></tr></table>')


SOCIAL = (("instagram", "Instagram"), ("facebook", "Facebook"), ("x", "X"), ("youtube", "YouTube"), ("linkedin", "LinkedIn"),
          ("whatsapp", "WhatsApp"), ("telegram", "Telegram"), ("threads", "Threads"))


def social_links(social: dict) -> list:
    return [(label, social[k]) for k, label in SOCIAL if (social.get(k) or "").startswith("https://")]


# ---------- providers ----------
async def _send_emergent(cfg: dict, to: str, subject: str, html: str) -> str:
    payload = {"to": [to], "subject": subject, "html": html, "from_name": cfg["from_name"] or "FlexoCards"}
    if cfg.get("reply_to"):
        payload["contact_email"] = cfg["reply_to"]
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    if r.status_code >= 400:
        try:
            msg = r.json().get("message") or r.json().get("error") or r.text
        except ValueError:
            msg = r.text
        raise EmailError(f"Emergent email {r.status_code}: {msg[:200]}")
    return r.json().get("id", "")


def _send_smtp_sync(cfg: dict, to: str, subject: str, html: str) -> str:
    if not (cfg["smtp_host"] and cfg["smtp_user"] and cfg["smtp_pass"]):
        raise EmailError("SMTP is not fully set up (host, username and password are required).")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((cfg["smtp_from_name"] or cfg["from_name"], cfg["smtp_from_email"] or cfg["smtp_user"]))
    msg["To"] = to
    if cfg.get("reply_to"):
        msg["Reply-To"] = cfg["reply_to"]
    msg.set_content("Open this email in an HTML-capable client.")
    msg.add_alternative(html, subtype="html")
    port, mode = int(cfg["smtp_port"]), cfg["smtp_secure"]
    try:
        if mode == "ssl":
            server = smtplib.SMTP_SSL(cfg["smtp_host"], port, context=ssl.create_default_context(), timeout=20)
        else:
            server = smtplib.SMTP(cfg["smtp_host"], port, timeout=20)
            if mode == "starttls":
                server.starttls(context=ssl.create_default_context())
        with server:
            server.login(cfg["smtp_user"], cfg["smtp_pass"])
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        raise EmailError(f"SMTP error: {str(e)[:200]}")
    return ""


async def send_email(cfg: dict, to: str, subject: str, html: str) -> str:
    _assert_safe_email(subject, html)
    if cfg["provider"] == "smtp":
        return await asyncio.to_thread(_send_smtp_sync, cfg, to, subject, html)
    return await _send_emergent(cfg, to, subject, html)
