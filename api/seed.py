"""Seed the database with an admin user.

Ensures database indexes are set up and creates or updates the admin user.
Does not add demo services, fake incidents, or mock feedback.
"""

import asyncio
import os
from datetime import datetime, timezone

from api.auth import hash_password
from api.db import get_client, get_db, setup


async def main():
    client = get_client()
    db = get_db(client)

    # Ensure indexes and schema validators are configured
    await setup(db)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    email = (os.getenv("SEED_ADMIN_EMAIL") or "admin@example.com").lower().strip()
    password = os.getenv("SEED_ADMIN_PASSWORD") or "NoPassword"

    # Upsert the admin user
    result = await db.admin_users.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "password_hash": hash_password(password),
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
    )

    if result.upserted_id:
        print(f"Admin user created: {email} / {password}")
    else:
        print(f"Admin user updated: {email} / {password}")

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())

