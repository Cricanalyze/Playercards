import os

import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_PREFIX = "flexocards"
_key = None


def init_storage(force: bool = False):
    global _key
    if _key and not force:
        return _key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    r.raise_for_status()
    _key = r.json()["storage_key"]
    return _key


def _req(method: str, path: str, **kw):
    r = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), **kw.pop("headers", {})}, **kw)
    if r.status_code == 404 and method == "PUT":
        r = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True), **kw.get("headers", {})}, **kw)
    r.raise_for_status()
    return r


def put_object(path: str, data: bytes, content_type: str) -> dict:
    return _req("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120).json()


def get_object(path: str):
    r = _req("GET", path, timeout=60)
    return r.content, r.headers.get("Content-Type", "application/octet-stream")
