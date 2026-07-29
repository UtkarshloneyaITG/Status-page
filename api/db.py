"""Mongo connection plus the idempotent schema setup.

MongoDB has no migration files. This module is the equivalent step: it applies
a JSON Schema validator per collection so a bad status value is rejected by the
database, not by application code, and it creates the indexes the read paths
need. Safe to run repeatedly.
"""

import os

from dotenv import load_dotenv
from pymongo import ASCENDING, AsyncMongoClient

from api.constants import STATUSES

load_dotenv()


def get_client() -> AsyncMongoClient:
    # tz_aware=True so datetimes come back as aware UTC rather than naive.
    return AsyncMongoClient(
        os.getenv("MONGO_URL", "mongodb://localhost:27017"), tz_aware=True
    )


def get_db(client: AsyncMongoClient | None = None):
    client = client or get_client()
    return client[os.getenv("MONGO_DB", "statuspage")]


def _obj(properties: dict, required: list[str]) -> dict:
    return {
        "$jsonSchema": {
            "bsonType": "object",
            "required": required,
            "properties": properties,
        }
    }


VALIDATORS = {
    "service_groups": _obj(
        {
            "name": {"bsonType": "string"},
            "position": {"bsonType": "int"},
        },
        ["name", "position"],
    ),
    "services": _obj(
        {
            "name": {"bsonType": "string"},
            "description": {"bsonType": ["string", "null"]},
            "group_id": {"bsonType": ["objectId", "null"]},
            "current_status": {"enum": STATUSES},
            "position": {"bsonType": "int"},
            "created_at": {"bsonType": "date"},
        },
        ["name", "current_status", "position"],
    ),
    "status_history": _obj(
        {
            "service_id": {"bsonType": "objectId"},
            "status": {"enum": STATUSES},
            "note": {"bsonType": ["string", "null"]},
            "changed_by": {"bsonType": ["string", "null"]},
            "created_at": {"bsonType": "date"},
        },
        ["service_id", "status", "created_at"],
    ),
}

INDEXES = {
    "service_groups": [[("position", ASCENDING)]],
    "services": [[("position", ASCENDING)]],
    "status_history": [[("service_id", ASCENDING), ("created_at", ASCENDING)]],
}


async def setup(db) -> None:
    existing = set(await db.list_collection_names())
    for name, validator in VALIDATORS.items():
        if name in existing:
            await db.command("collMod", name, validator=validator)
        else:
            await db.create_collection(name, validator=validator)
    for name, keys in INDEXES.items():
        for key in keys:
            await db[name].create_index(key)


if __name__ == "__main__":
    import asyncio

    async def main():
        client = get_client()
        await setup(get_db(client))
        print("schema validators and indexes applied")
        await client.close()

    asyncio.run(main())
