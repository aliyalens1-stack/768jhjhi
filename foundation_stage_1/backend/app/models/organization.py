"""Organization domain model — owned by a `provider` user.

Stage 1 keeps this minimal: the marketplace, services, and bookings are
out of scope here. We only model the ownership relation so role-based
endpoints (e.g. "list my organization") can be wired in stage 2.
"""
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


class OrganizationDB(BaseModel):
    name: str
    ownerId: str           # → users._id
    address: str = ""
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class OrganizationPublic(BaseModel):
    id: str
    name: str
    ownerId: str
    address: str = ""
    isActive: bool = True
