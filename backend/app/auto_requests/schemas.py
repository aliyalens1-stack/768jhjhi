"""Request / response schemas for Auto Requests API."""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class CreateCarRequest(BaseModel):
    brand: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=60)
    budget: int = Field(ge=500, le=500_000)
    links: List[str] = Field(default_factory=list)
    cities: List[str] = Field(default_factory=list)
    comment: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("cities")
    @classmethod
    def _clean_cities(cls, v: List[str]) -> List[str]:
        out: List[str] = []
        seen: set[str] = set()
        for c in v:
            s = (c or "").strip()
            if not s:
                continue
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(s)
        if not out:
            raise ValueError("at least one city required")
        if len(out) > 10:
            raise ValueError("too many cities (max 10)")
        return out

    @field_validator("links")
    @classmethod
    def _clean_links(cls, v: List[str]) -> List[str]:
        out = [l.strip() for l in v if l and l.strip()]
        if len(out) > 10:
            raise ValueError("too many links (max 10)")
        return out


class CarRequestOut(BaseModel):
    id: str
    userId: Optional[str] = None
    brand: str
    model: str
    budget: int
    links: List[str]
    cities: List[str]
    status: str
    jobsTotal: int
    jobsClaimed: int
    jobsDone: int
    createdAt: str
    updatedAt: str


class InspectionJobOut(BaseModel):
    id: str
    requestId: str
    city: str
    inspectorId: Optional[str] = None
    status: str
    brand: str
    model: str
    budget: int
    createdAt: str


class AssignJob(BaseModel):
    jobId: str
    inspectorId: str
