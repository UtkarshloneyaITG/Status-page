import os

import pytest
from pymongo.errors import WriteError

from api.constants import MAJOR
from api.db import get_client, setup

pytestmark = pytest.mark.asyncio

# ponytail: these hit a real MongoDB. Skipping when MONGO_URL is unset keeps
# `pytest` green on a machine without a database; CI sets the variable.
needs_mongo = pytest.mark.skipif(
    not os.getenv("MONGO_URL"), reason="MONGO_URL not set"
)


@pytest.fixture
async def db():
    client = get_client()
    name = "statuspage_test"
    await client.drop_database(name)
    database = client[name]
    await setup(database)
    yield database
    await client.drop_database(name)
    await client.close()


@needs_mongo
async def test_setup_is_idempotent(db):
    await setup(db)
    await setup(db)
    names = await db.list_collection_names()
    assert {"services", "service_groups", "status_history"} <= set(names)


@needs_mongo
async def test_rejects_unknown_status(db):
    with pytest.raises(WriteError):
        await db.services.insert_one(
            {"name": "API", "current_status": "on_fire", "position": 0}
        )


@needs_mongo
async def test_accepts_known_status(db):
    result = await db.services.insert_one(
        {"name": "API", "current_status": MAJOR, "position": 0}
    )
    assert result.inserted_id is not None
