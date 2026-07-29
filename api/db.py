"""Mongo connection plus the idempotent schema setup.

MongoDB has no migration files. This module is the equivalent step: it applies
a JSON Schema validator per collection so a bad status value is rejected by the
database, not by application code, and it creates the indexes the read paths
need. Safe to run repeatedly.
"""

import os

from dotenv import load_dotenv
from pymongo import ASCENDING, AsyncMongoClient

from api.constants import (
    FEEDBACK_STATUSES,
    FEEDBACK_TYPES,
    INCIDENT_STATUSES,
    STATUSES,
)

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
    schema: dict = {"bsonType": "object"}
    # Mongo rejects an empty `required` array outright, so omit the keyword
    # rather than emitting one. Same for `properties`.
    if required:
        schema["required"] = required
    if properties:
        schema["properties"] = properties
    return {"$jsonSchema": schema}


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
    "admin_users": _obj(
        {
            "email": {"bsonType": "string"},
            "password_hash": {"bsonType": "string"},
            "created_at": {"bsonType": "date"},
        },
        ["email", "password_hash"],
    ),
    "incidents": _obj(
        {
            "title": {"bsonType": "string"},
            "body": {"bsonType": ["string", "null"]},
            "status": {"enum": INCIDENT_STATUSES},
            "impact": {"enum": STATUSES},
            "started_at": {"bsonType": "date"},
            "resolved_at": {"bsonType": ["date", "null"]},
            "created_by": {"bsonType": ["string", "null"]},
            "postmortem": {"bsonType": ["string", "null"]},
        },
        ["title", "status", "started_at"],
    ),
    "incident_updates": _obj(
        {
            "incident_id": {"bsonType": "objectId"},
            "status": {"enum": INCIDENT_STATUSES},
            "message": {"bsonType": "string"},
            "created_at": {"bsonType": "date"},
        },
        ["incident_id", "status", "message", "created_at"],
    ),
    "incident_services": _obj(
        {
            "incident_id": {"bsonType": "objectId"},
            "service_id": {"bsonType": "objectId"},
        },
        ["incident_id", "service_id"],
    ),
    "maintenances": _obj(
        {
            "title": {"bsonType": "string"},
            "body": {"bsonType": ["string", "null"]},
            "scheduled_start": {"bsonType": "date"},
            "scheduled_end": {"bsonType": "date"},
            "service_ids": {"bsonType": "array"},
            "status": {"enum": ["scheduled", "cancelled"]},
        },
        ["title", "scheduled_start", "scheduled_end", "status"],
    ),
    "feedback": _obj(
        {
            "ref_code": {"bsonType": "string"},
            "type": {"enum": FEEDBACK_TYPES},
            "service_id": {"bsonType": ["objectId", "null"]},
            "title": {"bsonType": "string"},
            "description": {"bsonType": "string"},
            "reporter_email": {"bsonType": ["string", "null"]},
            "screenshot_id": {"bsonType": ["objectId", "null"]},
            "browser_meta": {"bsonType": ["object", "null"]},
            "status": {"enum": FEEDBACK_STATUSES},
            "upvotes": {"bsonType": "int"},
            "admin_reply": {"bsonType": ["string", "null"]},
            "internal_note": {"bsonType": ["string", "null"]},
            "is_public": {"bsonType": "bool"},
            "duplicate_of": {"bsonType": ["objectId", "null"]},
            "incident_id": {"bsonType": ["objectId", "null"]},
            "created_at": {"bsonType": "date"},
            "resolved_at": {"bsonType": ["date", "null"]},
        },
        ["ref_code", "type", "title", "description", "status", "created_at"],
    ),
    "feedback_votes": _obj(
        {
            "feedback_id": {"bsonType": "objectId"},
            "voter_hash": {"bsonType": "string"},
        },
        ["feedback_id", "voter_hash"],
    ),
    "subscribers": _obj(
        {
            "email": {"bsonType": "string"},
            "verified": {"bsonType": "bool"},
            "unsubscribe_token": {"bsonType": "string"},
            "created_at": {"bsonType": "date"},
        },
        ["email", "verified", "unsubscribe_token"],
    ),
    # Single document, _id "site". No validator beyond the shape check, because
    # every field is optional until an operator saves one.
    "settings": _obj({}, []),
}

INDEXES = {
    "service_groups": [[("position", ASCENDING)]],
    "services": [[("position", ASCENDING)]],
    "status_history": [[("service_id", ASCENDING), ("created_at", ASCENDING)]],
    "incident_updates": [[("incident_id", ASCENDING), ("created_at", ASCENDING)]],
    "incident_services": [[("incident_id", ASCENDING)], [("service_id", ASCENDING)]],
    "incidents": [[("started_at", ASCENDING)]],
    "maintenances": [[("scheduled_start", ASCENDING)]],
    "feedback": [[("created_at", ASCENDING)], [("status", ASCENDING)]],
}

UNIQUE_INDEXES = {
    "admin_users": [[("email", ASCENDING)]],
    "feedback": [[("ref_code", ASCENDING)]],
    "feedback_votes": [[("feedback_id", ASCENDING), ("voter_hash", ASCENDING)]],
    "subscribers": [[("email", ASCENDING)], [("unsubscribe_token", ASCENDING)]],
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
    for name, keys in UNIQUE_INDEXES.items():
        for key in keys:
            await db[name].create_index(key, unique=True)


if __name__ == "__main__":
    import asyncio

    async def main():
        client = get_client()
        await setup(get_db(client))
        print("schema validators and indexes applied")
        await client.close()

    asyncio.run(main())
