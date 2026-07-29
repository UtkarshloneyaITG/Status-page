"""Script to add or update an admin user in MongoDB."""

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from api.auth import hash_password
from api.db import get_client, get_db


async def create_or_update_admin(email: str, password: str):
    email = email.lower().strip()
    client = get_client()
    db = get_db(client)

    hashed = hash_password(password)
    result = await db.admin_users.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "password_hash": hashed,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    if result.upserted_id:
        print(f"Admin user created successfully: {email}")
    else:
        print(f"Password updated successfully for admin: {email}")

    await client.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@example.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "NoPassword"
    asyncio.run(create_or_update_admin(email, password))
