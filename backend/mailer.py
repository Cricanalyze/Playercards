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
def render(cfg: dict, heading: str, paragraphs: list, cta: tuple = None) -> str:
    brand = escape(cfg["from_name"] or "FlexoCards")
    body = "".join(f'<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937">{escape(p)}</p>' for p in paragraphs)
    button = ""
    site = (cfg.get("site_url") or "").rstrip("/")
    if cta and site.startswith("https://"):
        button = (f'<p style="margin:22px 0"><a href="{escape(site + cta[1])}" style="background:#f5b400;color:#0b1a3a;'
                  f'padding:12px 22px;border-radius:999px;font-weight:bold;text-decoration:none;display:inline-block">{escape(cta[0])}</a></p>')
    return (f'<table role="presentation" width="100%" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">'
            f'<table role="presentation" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;font-family:Arial,sans-serif">'
            f'<tr><td style="background:#0b1a3a;padding:18px 24px;border-radius:14px 14px 0 0;color:#f5b400;font-size:22px;font-weight:bold;'
            f'font-style:italic;letter-spacing:.5px">{brand}</td></tr>'
            f'<tr><td style="padding:26px 24px"><h1 style="margin:0 0 16px;font-size:22px;color:#0b1a3a">{escape(heading)}</h1>{body}{button}'
            f'<p style="margin:24px 0 0;font-size:12px;color:#6b7280">Sent by {brand}, a product of Buddy Innovations and Technologies Private Limited. '
            f'We never ask for your password or card details by email.</p></td></tr></table></td></tr></table>')


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
