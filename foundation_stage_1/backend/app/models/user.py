"""User domain model. Mongo-backed (collection: users).

We keep this as a Pydantic model rather than ORM so the data layer stays
flexible. `passwordHash` is internal — never returned by the API.
"""
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.models.role import Role


class UserDB(BaseModel):
    """Internal representation. Maps to a Mongo document in collection `users`."""
    email: EmailStr
    passwordHash: str
    firstName: str = ""
    lastName: str = ""
    role: Role = Role.USER
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class UserPublic(BaseModel):
    """Outgoing shape — what the API returns to clients."""
    id: str
    email: EmailStr
    firstName: str = ""
    lastName: str = ""
    role: Role
    isActive: bool = True


def to_public(doc: dict) -> dict:
    """Convert a Mongo user document to API-safe dict (no _id, no passwordHash)."""
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "firstName": doc.get("firstName", ""),
        "lastName": doc.get("lastName", ""),
        "role": doc.get("role", Role.USER.value),
        "isActive": doc.get("isActive", True),
    }
