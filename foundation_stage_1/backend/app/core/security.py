"""Password hashing (bcrypt) + JWT encoding / decoding."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


# ── Password hashing ────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ── JWT ────────────────────────────────────────────────────────────────────
def create_access_token(*, sub: str, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.JWT_TTL_DAYS)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGO)


def decode_access_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError | jwt.InvalidTokenError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGO])
