"""Auth service — business logic separated from HTTP transport.

Routes (`app.routes.auth`) are thin: parse → call service → format response.
This keeps the auth invariants (uniqueness, password policy, role filter)
in one place and makes the logic unit-testable.
"""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.role import Role
from app.models.user import to_public
from app.schemas.auth import LoginRequest, RegisterRequest


# Self-service registration cannot create an admin.
SELF_SERVICE_ROLES: frozenset[str] = frozenset({Role.USER.value, Role.PROVIDER.value})


async def register(db: AsyncIOMotorDatabase, body: RegisterRequest) -> dict:
    email = body.email.lower().strip()

    if body.role.value not in SELF_SERVICE_ROLES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid role for self-service registration",
        )

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "User with this email already exists",
        )

    doc = {
        "email": email,
        "passwordHash": hash_password(body.password),
        "firstName": body.firstName,
        "lastName": body.lastName,
        "role": body.role.value,
        "isActive": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    user_public = to_public(doc)
    token = create_access_token(
        sub=user_public["id"],
        email=user_public["email"],
        role=user_public["role"],
    )
    return {"accessToken": token, "user": user_public}


async def login(db: AsyncIOMotorDatabase, body: LoginRequest) -> dict:
    email = body.email.lower().strip()

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("passwordHash", "")):
        # Same response on missing user / wrong password — avoid email enumeration.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    if not user.get("isActive", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    user_public = to_public(user)
    token = create_access_token(
        sub=user_public["id"],
        email=user_public["email"],
        role=user_public["role"],
    )
    return {"accessToken": token, "user": user_public}
