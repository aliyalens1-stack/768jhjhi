"""
Stage 2 — Geo + Search.
Cities catalogue + city filter for organizations.

- Catalogue static (Berlin, Munich, Hamburg, Kyiv, Lviv, Odesa).
- Each city has center coordinates → frontend uses them for `/marketplace/providers?lat=&lng=`.
- Extends existing `/api/marketplace/providers` via `?city=` filter (handled here as override).
- Migrates existing orgs by inferring city from address/coords on first call.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from server import db  # shared Motor handle
from app.core.redis_state import rate_limit_public  # public RL dep

router = APIRouter(tags=["geo"])


class City(BaseModel):
    code: str          # short id used in URLs and AsyncStorage
    name: str          # display name (i18n done client-side)
    country: str       # ISO-2 country code
    lat: float
    lng: float
    timezone: str
    currency: str      # display currency hint
    providersCount: int = 0


# Static catalogue. Adding more = just append + re-deploy.
CITY_CATALOGUE: List[dict] = [
    {"code": "berlin",  "name": "Berlin",  "country": "DE", "lat": 52.5200, "lng": 13.4050, "timezone": "Europe/Berlin",  "currency": "EUR", "addressMarkers": ["Berlin"]},
    {"code": "munich",  "name": "München", "country": "DE", "lat": 48.1351, "lng": 11.5820, "timezone": "Europe/Berlin",  "currency": "EUR", "addressMarkers": ["München", "Munich"]},
    {"code": "hamburg", "name": "Hamburg", "country": "DE", "lat": 53.5511, "lng":  9.9937, "timezone": "Europe/Berlin",  "currency": "EUR", "addressMarkers": ["Hamburg"]},
    {"code": "kyiv",    "name": "Київ",    "country": "UA", "lat": 50.4501, "lng": 30.5234, "timezone": "Europe/Kyiv",    "currency": "UAH", "addressMarkers": ["Київ", "Киев", "Kyiv"]},
    {"code": "lviv",    "name": "Львів",   "country": "UA", "lat": 49.8397, "lng": 24.0297, "timezone": "Europe/Kyiv",    "currency": "UAH", "addressMarkers": ["Львів", "Львов", "Lviv"]},
    {"code": "odesa",   "name": "Одеса",   "country": "UA", "lat": 46.4825, "lng": 30.7233, "timezone": "Europe/Kyiv",    "currency": "UAH", "addressMarkers": ["Одеса", "Одесса", "Odesa"]},
]


def _infer_city(org: dict) -> Optional[str]:
    """Derive city code for an org based on address substring or proximity to a known centre."""
    address = (org.get("address") or "").lower()
    for c in CITY_CATALOGUE:
        for marker in c["addressMarkers"]:
            if marker.lower() in address:
                return c["code"]
    # fallback: nearest center by lat/lng
    loc = org.get("location") or {}
    coords = loc.get("coordinates") or []
    if len(coords) == 2:
        lng, lat = coords
        nearest = None
        nearest_d = 1e9
        for c in CITY_CATALOGUE:
            d = (c["lat"] - lat) ** 2 + (c["lng"] - lng) ** 2
            if d < nearest_d:
                nearest_d = d
                nearest = c["code"]
        return nearest
    return None


async def _ensure_city_field() -> None:
    """One-shot migration: tag every org with a `city` if missing."""
    cursor = db.organizations.find({"$or": [{"city": None}, {"city": {"$exists": False}}]}, {"_id": 1, "address": 1, "location": 1})
    async for doc in cursor:
        code = _infer_city(doc)
        if code:
            await db.organizations.update_one({"_id": doc["_id"]}, {"$set": {"city": code}})


@router.get("/api/cities", response_model=List[City])
async def list_cities(_=Depends(rate_limit_public)):
    """List supported cities with provider counts."""
    await _ensure_city_field()

    # Aggregate counts per city in one round-trip
    counts = {}
    pipeline = [{"$match": {"status": "active"}}, {"$group": {"_id": "$city", "n": {"$sum": 1}}}]
    async for r in db.organizations.aggregate(pipeline):
        if r["_id"]:
            counts[r["_id"]] = r["n"]

    return [
        City(
            code=c["code"], name=c["name"], country=c["country"],
            lat=c["lat"], lng=c["lng"], timezone=c["timezone"],
            currency=c["currency"], providersCount=counts.get(c["code"], 0),
        )
        for c in CITY_CATALOGUE
    ]


@router.get("/api/cities/{code}", response_model=City)
async def get_city(code: str, _=Depends(rate_limit_public)):
    await _ensure_city_field()
    c = next((x for x in CITY_CATALOGUE if x["code"] == code), None)
    if not c:
        from fastapi import HTTPException
        raise HTTPException(404, f"city '{code}' not found")
    n = await db.organizations.count_documents({"status": "active", "city": code})
    return City(
        code=c["code"], name=c["name"], country=c["country"],
        lat=c["lat"], lng=c["lng"], timezone=c["timezone"],
        currency=c["currency"], providersCount=n,
    )
