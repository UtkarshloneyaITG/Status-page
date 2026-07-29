"""Wipe and repopulate the database with realistic demo data.

Generates 90 days of status history including a handful of outages and one
maintenance window, so the uptime bars have something to show.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from api.constants import DEGRADED, MAINTENANCE, MAJOR, OPERATIONAL, PARTIAL
from api.db import get_client, get_db, setup

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

    for name in ("services", "service_groups", "status_history"):
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

    counts = {
        name: await db[name].count_documents({})
        for name in ("service_groups", "services", "status_history")
    }
    print("seeded:", counts)
    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
