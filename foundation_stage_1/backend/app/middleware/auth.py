"""Authentication middleware — extracts the current user from the JWT.

Exposed as a FastAPI dependency: `Depends(get_current_user)`.
Endpoint behind it sees a fully resolved user document.
"""
from __future__ import annotations
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import to_public

# OpenAPI sees the bearer scheme — Swagger UI gets a "Authorize" button.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Resolve and return the currently-logged-in user as a public dict.

    Raises 401 if the token is missing, invalid, expired, or the user no
    longer exists / is disabled.
    """
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authorization required")

    try:
        payload = decode_access_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    sub = payload.get("sub")
    try:
        oid = ObjectId(sub)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")

    db = get_db()
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if not user.get("isActive", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    public = to_public(user)
    # Stash the raw _id-bearing doc on request.state in case a downstream
    # handler needs it; the dependency itself returns the public shape.
    request.state.user_doc = user
    return public
