"""Shared fixtures.

Every database-backed test runs against a throwaway database named per-run, so
a test can never touch the real `statuspage` data on the configured cluster.
"""

import os

import pytest
from httpx import ASGITransport, AsyncClient

from api.auth import hash_password
from api.db import get_client, setup

TEST_DB = "statuspage_test"

needs_mongo = pytest.mark.skipif(
    not os.getenv("MONGO_URL"), reason="MONGO_URL not set"
)


@pytest.fixture
async def db():
    client = get_client()
    await client.drop_database(TEST_DB)
    database = client[TEST_DB]
    await setup(database)
    yield database
    await client.drop_database(TEST_DB)
    await client.close()


@pytest.fixture
async def client(db):
    """An HTTP client wired to the throwaway database.

    ASGITransport does not run lifespan events, so app.state is set here the
    same way the lifespan handler would set it.
    """
    from api.main import _cache, app

    app.state.db = db
    _cache.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def owner(db):
    user = {
        "email": "owner@example.com",
        "password_hash": hash_password("owner-pw"),
        "role": "owner",
    }
    await db.admin_users.insert_one(dict(user))
    return {"email": user["email"], "password": "owner-pw", "role": "owner"}


@pytest.fixture
async def responder(db):
    user = {
        "email": "responder@example.com",
        "password_hash": hash_password("responder-pw"),
        "role": "responder",
    }
    await db.admin_users.insert_one(dict(user))
    return {
        "email": user["email"],
        "password": "responder-pw",
        "role": "responder",
    }


async def login(client, account) -> None:
    """Log the client in; the cookie persists on the AsyncClient."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": account["email"], "password": account["password"]},
    )
    assert res.status_code == 200, res.text
