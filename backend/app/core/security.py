"""app.core.security — password hashing + JWT admin-token verification.

Sprint 21 C1: вынос из server.py без единого изменения поведения.

ВАЖНО: используется PyJWT (import jwt), НЕ python-jose.
ВАЖНО: verify_admin_token ожидает Request (не HTTPBearer) — это сохраняет
совместимость со всеми 57 admin endpoint'ами.
"""
from __future__ import annotations
import bcrypt
import jwt
from fastapi import HTTPException, Request

from app.core.config import JWT_SECRET, JWT_ALGO


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


async def verify_admin_token(request: Request):
    """Verify JWT token from Authorization header. Requires role=admin.

    Sprint 12: enforce role check — reject non-admin JWTs.
    """
    auth_header = request.headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(401, "Unauthorized")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    role = payload.get('role', '')
    if role != 'admin':
        raise HTTPException(403, f"Forbidden: admin role required (got {role or 'none'})")
    return payload


async def verify_user_token(request: Request):
    """Verify JWT token from Authorization header. Accepts any authenticated role.

    Sprint 34 D8: shared dep for chat / notifications / messages flows.
    Returns payload dict with sub/email/role/userId.
    """
    auth_header = request.headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(401, "Unauthorized")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    return payload
