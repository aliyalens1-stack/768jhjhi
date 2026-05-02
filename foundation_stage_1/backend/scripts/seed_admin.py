"""Seed an initial admin user.

Admin users cannot be created via the self-service /api/auth/register endpoint.
Run this script once after setting up MongoDB to obtain first-admin credentials.

Usage:
    cd backend
    python -m scripts.seed_admin                           # uses defaults
    ADMIN_EMAIL=me@corp.com ADMIN_PASSWORD=... python -m scripts.seed_admin
"""
from __future__ import annotations
import asyncio
import os
import sys
from datetime import datetime, timezone

# Allow running as a script from the backend/ directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core import database  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.role import Role  # noqa: E402


async def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@example.com").lower().strip()
    password = os.getenv("ADMIN_PASSWORD", "Admin!2345")
    first_name = os.getenv("ADMIN_FIRST_NAME", "Platform")
    last_name = os.getenv("ADMIN_LAST_NAME", "Admin")

    db = database.connect()
    await db.users.create_index("email", unique=True)

    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"[seed_admin] Admin already exists: {email}")
        if existing.get("role") != Role.ADMIN.value:
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"role": Role.ADMIN.value, "isActive": True}},
            )
            print(f"[seed_admin] Upgraded existing user to admin: {email}")
        await database.close()
        return

    await db.users.insert_one(
        {
            "email": email,
            "passwordHash": hash_password(password),
            "firstName": first_name,
            "lastName": last_name,
            "role": Role.ADMIN.value,
            "isActive": True,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    print(f"[seed_admin] Created admin user:")
    print(f"  email:    {email}")
    print(f"  password: {password}")
    print("Change the password immediately after first login.")
    await database.close()


if __name__ == "__main__":
    asyncio.run(main())
