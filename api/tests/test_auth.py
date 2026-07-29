import pytest
from fastapi import HTTPException

from api.auth import (
    COOKIE_NAME,
    hash_password,
    role_at_least,
    require_role,
    verify_password,
)
from api.tests.conftest import login, needs_mongo

# No module-level asyncio mark: pytest.ini sets asyncio_mode = auto, and this
# file mixes sync helper tests with async endpoint tests.


# --- pure helpers, no database ---------------------------------------------


def test_hash_and_verify_round_trip():
    hashed = hash_password("correct horse")
    assert hashed != "correct horse"
    assert verify_password("correct horse", hashed)


def test_wrong_password_rejected():
    assert not verify_password("wrong", hash_password("right"))


def test_malformed_hash_is_rejected_not_raised():
    assert not verify_password("anything", "not-a-bcrypt-hash")


def test_role_ordering():
    assert role_at_least("owner", "responder")
    assert role_at_least("admin", "admin")
    assert not role_at_least("responder", "admin")
    assert not role_at_least("nonsense", "responder")


class _Req:
    def __init__(self, cookies):
        self.cookies = cookies


def test_require_role_rejects_anonymous():
    with pytest.raises(HTTPException) as exc:
        require_role("responder")(_Req({}))
    assert exc.value.status_code == 401


def test_require_role_rejects_tampered_cookie():
    with pytest.raises(HTTPException) as exc:
        require_role("responder")(_Req({COOKIE_NAME: "forged.token.value"}))
    assert exc.value.status_code == 401


# --- endpoints --------------------------------------------------------------


@needs_mongo
async def test_login_sets_cookie_and_me_reads_it(client, owner):
    await login(client, owner)
    assert COOKIE_NAME in client.cookies

    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json() == {"email": owner["email"], "role": "owner"}


@needs_mongo
async def test_me_requires_a_session(client, db):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


@needs_mongo
async def test_logout_clears_the_session(client, owner):
    await login(client, owner)
    await client.post("/api/v1/auth/logout")
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


@needs_mongo
async def test_unknown_email_and_wrong_password_are_indistinguishable(
    client, owner
):
    unknown = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )
    wrong = await client.post(
        "/api/v1/auth/login",
        json={"email": owner["email"], "password": "not-the-password"},
    )
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


@needs_mongo
async def test_password_hash_is_never_returned(client, owner):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": owner["email"], "password": owner["password"]},
    )
    assert "password" not in res.text
    assert "hash" not in res.text


@needs_mongo
async def test_lower_role_is_forbidden_not_unauthorized(client, responder):
    """A responder is authenticated but must not clear an admin-only bar."""
    await login(client, responder)
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 200

    from api.auth import read_session

    session = read_session(_Req(dict(client.cookies)))
    assert session["role"] == "responder"
    with pytest.raises(HTTPException) as exc:
        require_role("admin")(_Req(dict(client.cookies)))
    assert exc.value.status_code == 403
