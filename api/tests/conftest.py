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
    """The one kind of account there is: an admin."""
    await db.admin_users.insert_one(
        {
            "email": "admin@example.com",
            "password_hash": hash_password("admin-pw"),
        }
    )
    return {"email": "admin@example.com", "password": "admin-pw"}


async def login(client, account) -> None:
    """Log the client in; the cookie persists on the AsyncClient."""
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": account["email"], "password": account["password"]},
    )
    assert res.status_code == 200, res.text
