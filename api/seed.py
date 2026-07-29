"""Wipe and repopulate the database with realistic demo data.

Generates 90 days of status history including a handful of outages and one
maintenance window, so the uptime bars have something to show, plus one live
incident, one upcoming maintenance window, and a few feedback items so the
admin surfaces have something to act on.
"""

import asyncio
import os
import random
import secrets
from datetime import datetime, timedelta, timezone

from api.auth import hash_password
from api.constants import (
    DEGRADED,
    FB_FIXED,
    FB_NEW,
    FB_UNDER_REVIEW,
    IDENTIFIED,
    MAINTENANCE,
    MAJOR,
    OPERATIONAL,
    PARTIAL,
)
from api.db import get_client, get_db, setup

COLLECTIONS = (
    "services",
    "service_groups",
    "status_history",
    "admin_users",
    "incidents",
    "incident_updates",
    "incident_services",
    "maintenances",
    "feedback",
    "feedback_votes",
    "subscribers",
)

GROUPS = [
    {"name": "API", "position": 0},
    {"name": "Applications", "position": 1},
]

SERVICES = [
    ("REST API", "Core HTTP API", 0, 0),
    ("Webhooks", "Outbound event delivery", 0, 1),
    ("GraphQL API", "GraphQL gateway", 0, 2),
    ("Web App", "Browser client", 1, 3),
    ("Mobile App", "iOS and Android clients", 1, 4),
    ("Status Page", "This page", None, 5),
]

# (day offset from 90 days ago, hour, duration hours, status)
OUTAGES = [
    (12, 3, 4, DEGRADED),
    (31, 14, 2, MAJOR),
    (44, 9, 6, PARTIAL),
    (58, 22, 1, DEGRADED),
    (73, 2, 3, MAINTENANCE),
    (81, 16, 5, PARTIAL),
]


async def main():
    client = get_client()
    db = get_db(client)

    for name in COLLECTIONS:
        await db[name].drop()
    await setup(db)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    birth = now - timedelta(days=90)

    group_ids = []
    for group in GROUPS:
        result = await db.service_groups.insert_one(dict(group))
        group_ids.append(result.inserted_id)

    rng = random.Random(20260729)  # fixed seed so reseeding is reproducible

    for name, description, group_index, position in SERVICES:
        service = {
            "name": name,
            "description": description,
            "group_id": group_ids[group_index] if group_index is not None
            else None,
            "current_status": OPERATIONAL,
            "position": position,
            "created_at": birth,
        }
        result = await db.services.insert_one(service)
        service_id = result.inserted_id

        history = [
            {
                "service_id": service_id,
                "status": OPERATIONAL,
                "note": None,
                "changed_by": "seed",
                "created_at": birth,
            }
        ]

        # Each service gets a random subset of the outages, so the bars differ.
        for offset, hour, duration, status in OUTAGES:
            if rng.random() > 0.55:
                continue
            start = birth + timedelta(days=offset, hours=hour)
            history.append(
                {
                    "service_id": service_id,
                    "status": status,
                    "note": "Scheduled maintenance window"
                    if status == MAINTENANCE
                    else "Elevated error rates",
                    "changed_by": "seed",
                    "created_at": start,
                }
            )
            history.append(
                {
                    "service_id": service_id,
                    "status": OPERATIONAL,
                    "note": None,
                    "changed_by": "seed",
                    "created_at": start + timedelta(hours=duration),
                }
            )

        history.sort(key=lambda e: e["created_at"])
        await db.status_history.insert_many(history)
        await db.services.update_one(
            {"_id": service_id},
            {"$set": {"current_status": history[-1]["status"]}},
        )

    service_ids = {
        doc["name"]: doc["_id"] async for doc in db.services.find({}, {"name": 1})
    }

    # --- an operator to log in as -----------------------------------------
    password = os.getenv("SEED_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
    await db.admin_users.insert_one(
        {
            "email": "admin@example.com",
            "password_hash": hash_password(password),
            "created_at": now,
        }
    )

    # --- one live incident, with its service left broken -------------------
    # Cycle 1's seed always recovered every outage, so the banner could only
    # ever read "All Systems Operational". This one stays open.
    broken = service_ids["Webhooks"]
    incident = await db.incidents.insert_one(
        {
            "title": "Elevated webhook delivery latency",
            "body": None,
            "status": IDENTIFIED,
            "impact": PARTIAL,
            "started_at": now - timedelta(hours=3),
            "resolved_at": None,
            "created_by": "admin@example.com",
            "postmortem": None,
        }
    )
    await db.incident_services.insert_one(
        {"incident_id": incident.inserted_id, "service_id": broken}
    )
    await db.incident_updates.insert_many(
        [
            {
                "incident_id": incident.inserted_id,
                "status": "investigating",
                "message": "We are investigating reports of delayed webhooks.",
                "created_at": now - timedelta(hours=3),
            },
            {
                "incident_id": incident.inserted_id,
                "status": IDENTIFIED,
                "message": "A backlog in the delivery queue is the cause. "
                "We are draining it now.",
                "created_at": now - timedelta(hours=1),
            },
        ]
    )
    await db.status_history.insert_one(
        {
            "service_id": broken,
            "status": PARTIAL,
            "note": "Delivery queue backlog",
            "changed_by": "admin@example.com",
            "created_at": now - timedelta(hours=3),
        }
    )
    await db.services.update_one(
        {"_id": broken}, {"$set": {"current_status": PARTIAL}}
    )

    # --- an upcoming maintenance window ------------------------------------
    await db.maintenances.insert_one(
        {
            "title": "Database failover drill",
            "body": "Brief read-only periods are expected.",
            "scheduled_start": now + timedelta(days=3),
            "scheduled_end": now + timedelta(days=3, hours=2),
            "service_ids": [service_ids["REST API"], service_ids["GraphQL API"]],
            "status": "scheduled",
        }
    )

    # --- feedback, across the triage states --------------------------------
    await db.feedback.insert_many(
        [
            {
                "ref_code": "RPT-1001",
                "type": "issue",
                "service_id": service_ids["Webhooks"],
                "title": "Webhooks arriving 10+ minutes late",
                "description": "Order events are consistently delayed today.",
                "reporter_email": "dev@example.com",
                "screenshot_id": None,
                "browser_meta": {"browser": "Chrome 141", "os": "Windows 11"},
                "status": FB_UNDER_REVIEW,
                "upvotes": 4,
                "admin_reply": "Confirmed — tracked in the open incident.",
                "internal_note": None,
                "is_public": True,
                "duplicate_of": None,
                "incident_id": incident.inserted_id,
                "created_at": now - timedelta(hours=2),
            },
            {
                "ref_code": "RPT-1002",
                "type": "suggestion",
                "service_id": None,
                "title": "Show a timezone toggle on the uptime bars",
                "description": "UTC is fine but local time would help.",
                "reporter_email": None,
                "screenshot_id": None,
                "browser_meta": None,
                "status": FB_NEW,
                "upvotes": 1,
                "admin_reply": None,
                "internal_note": None,
                "is_public": True,
                "duplicate_of": None,
                "incident_id": None,
                "created_at": now - timedelta(days=2),
            },
            {
                "ref_code": "RPT-1003",
                "type": "issue",
                "service_id": service_ids["Web App"],
                "title": "Login page flashes white in dark mode",
                "description": "Momentary white flash before the theme applies.",
                "reporter_email": "someone@example.com",
                "screenshot_id": None,
                "browser_meta": {"browser": "Firefox 140", "os": "macOS 15"},
                "status": FB_FIXED,
                "upvotes": 7,
                "admin_reply": "Fixed in this week's release. Thanks!",
                "internal_note": "Caused by the theme script loading late.",
                "is_public": True,
                "duplicate_of": None,
                "incident_id": None,
                "created_at": now - timedelta(days=9),
            },
            {
                "ref_code": "RPT-1004",
                "type": "issue",
                "service_id": service_ids["Mobile App"],
                "title": "Crash on opening notifications",
                "description": "Reproducible on Android 15.",
                "reporter_email": None,
                "screenshot_id": None,
                "browser_meta": None,
                "status": FB_NEW,
                "upvotes": 0,
                "admin_reply": None,
                "internal_note": None,
                # Not yet approved, so it must not appear publicly.
                "is_public": False,
                "duplicate_of": None,
                "incident_id": None,
                "created_at": now - timedelta(hours=6),
            },
        ]
    )

    counts = {
        name: await db[name].count_documents({})
        for name in COLLECTIONS
        if await db[name].count_documents({})
    }
    print("seeded:", counts)
    print(f"admin login: admin@example.com / {password}")
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
