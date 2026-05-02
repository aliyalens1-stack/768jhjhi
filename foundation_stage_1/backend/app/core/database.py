"""MongoDB connection — async motor client, single instance."""
from __future__ import annotations
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def connect() -> AsyncIOMotorDatabase:
    """Open the connection. Idempotent — safe to call from app startup."""
    global _client, _db
    if _db is not None:
        return _db
    _client = AsyncIOMotorClient(settings.MONGO_URL)
    _db = _client[settings.DB_NAME]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency / service helper. Connects lazily."""
    if _db is None:
        return connect()
    return _db


async def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
