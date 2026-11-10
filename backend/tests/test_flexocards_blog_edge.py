# FlexoCards blog edge cases: author isolation, published-edit by author, non-admin status patch, card edit_state fields
import json
import os
import subprocess

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
FREE = "qa.free+clerk_test@example.com"
BASIC = "qa.basic+clerk_test@example.com"


@pytest.fixture(scope="module")
def tok():
    out = subprocess.run(["python", "/app/backend/qa_users.py", "tokens"], capture_output=True, text=True, timeout=120).stdout
    return json.loads(out.strip().splitlines()[-1])


def H(t, r):
    return {"Authorization": f"Bearer {t[r]}"}


@pytest.fixture(scope="module")
def authors(tok):
    A = H(tok, "admin")
    for e in (FREE, BASIC):
        assert requests.post(f"{API}/admin/blog/authors", json={"email": e}, headers=A, timeout=20).status_code == 200
    yield
    for e in (FREE, BASIC):
        u = db.users.find_one({"email": e})
        requests.delete(f"{API}/admin/blog/authors/{u['user_id']}", headers=A, timeout=20)
    for e in (FREE, BASIC):
        assert not db.users.find_one({"email": e}).get("can_blog")


def test_author_isolation_and_status(tok, authors):
    A, F, B = H(tok, "admin"), H(tok, "free"), H(tok, "basic")
    p = requests.post(f"{API}/me/posts", json={"title": "TEST_ Edge Free Post", "content": "x " * 500, "status": "draft"}, headers=F, timeout=20).json()
    try:
        assert p["status"] == "draft" and p["reading_minutes"] >= 2
        # another author can't read/edit/delete it
        assert requests.get(f"{API}/me/posts/{p['id']}", headers=B, timeout=20).status_code == 404
        assert requests.put(f"{API}/me/posts/{p['id']}", json={"title": "TEST_ hijack"}, headers=B, timeout=20).status_code == 404
        assert requests.delete(f"{API}/me/posts/{p['id']}", headers=B, timeout=20).status_code == 404
        # author can't use admin status endpoint
        assert requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "published"}, headers=F, timeout=20).status_code == 403
        # draft slug not public
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 404
        # submit for review
        r = requests.put(f"{API}/me/posts/{p['id']}", json={"title": "TEST_ Edge Free Post", "content": "hi", "status": "published"}, headers=F, timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "pending"
        assert requests.patch(f"{API}/admin/blog/posts/{p['id']}/status", json={"status": "published"}, headers=A, timeout=20).status_code == 200
        assert requests.get(f"{API}/blog/{p['slug']}", timeout=20).status_code == 200
        # author edits published post -> goes back to pending (report behaviour)
        r = requests.put(f"{API}/me/posts/{p['id']}", json={"title": "TEST_ Edge Free Post", "content": "edited", "status": "published"}, headers=F, timeout=20)
        print("author edit of published post ->", r.json()["status"])
        # invalid status / short title
        assert requests.post(f"{API}/me/posts", json={"title": "ab"}, headers=F, timeout=20).status_code == 422
        assert requests.post(f"{API}/me/posts", json={"title": "TEST_ bad", "status": "rejected"}, headers=F, timeout=20).status_code == 422
    finally:
        requests.delete(f"{API}/me/posts/{p['id']}", headers=A, timeout=20)


def test_slug_uniqueness(tok, authors):
    A = H(tok, "admin")
    ids = []
    try:
        for _ in range(2):
            ids.append(requests.post(f"{API}/me/posts", json={"title": "TEST_ Same Slug", "status": "published"}, headers=A, timeout=20).json())
        assert ids[0]["slug"] != ids[1]["slug"]
    finally:
        for p in ids:
            requests.delete(f"{API}/me/posts/{p['id']}", headers=A, timeout=20)


def test_public_blog_excludes_unpublished():
    r = requests.get(f"{API}/blog", timeout=20).json()
    assert all(p["status"] == "published" for p in r["posts"])
    assert all("content" not in p for p in r["posts"])


def test_files_404():
    assert requests.get(f"{API}/files/nope/x.png", timeout=20).status_code == 404


def test_unauth():
    assert requests.get(f"{API}/me/posts", timeout=20).status_code in (401, 403)
    assert requests.post(f"{API}/me/cards", json={}, timeout=20).status_code in (401, 403, 422)
