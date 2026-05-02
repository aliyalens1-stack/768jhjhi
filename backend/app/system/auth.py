"""app.system.auth — /api/auth/* endpoints.

Sprint 21 C5: первый настоящий разрез. 5 endpoints вынесены 1-в-1:
  - POST /api/auth/login
  - POST /api/auth/register
  - GET  /api/auth/me
  - POST /api/auth/forgot-password
  - POST /api/auth/reset-password

Никаких изменений в логике, сигнатурах, return values. Единственная
техническая замена — глобал `db` → `get_db()` (всего ~7 точек внутри
функций). JWT encoding/decoding — PyJWT, как было в server.py.

Зависимости:
  - app.core.db.get_db() — MongoDB access через ctx
  - app.core.security — hash_pw, verify_pw
  - app.core.utils — now_utc, uid
  - app.core.config — JWT_SECRET, JWT_ALGO
  - bson.ObjectId — для lookup'а по _id из JWT payload

НЕТ импорта server.py → нет циклов.
"""
from __future__ import annotations
import logging
from datetime import timedelta, datetime
import jwt
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from app.core.db import get_db
from app.core.security import hash_pw, verify_pw
from app.core.utils import now_utc, uid
from app.core.config import JWT_SECRET, JWT_ALGO


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")


@router.post("/login")
async def auth_login(request: Request):
    """Login with email/password, return JWT token"""
    db = get_db()
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Email and password are required")

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(401, "Invalid credentials")

    pw_hash = user.get("passwordHash", "")
    if not pw_hash or not verify_pw(password, pw_hash):
        raise HTTPException(401, "Invalid credentials")

    if not user.get("isActive", True):
        raise HTTPException(403, "Account is disabled")

    # Generate JWT
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "customer"),
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=7)).timestamp()),
    }
    access_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

    user_data = {
        "id": str(user["_id"]),
        "email": user["email"],
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "role": user.get("role", "customer"),
    }

    return {"accessToken": access_token, "user": user_data}


@router.post("/register")
async def auth_register(request: Request):
    """Register a new user"""
    db = get_db()
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    first_name = body.get("firstName", "")
    last_name = body.get("lastName", "")
    role = body.get("role", "customer")

    if not email or not password:
        raise HTTPException(400, "Email and password are required")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "User with this email already exists")

    user_doc = {
        "email": email,
        "passwordHash": hash_pw(password),
        "firstName": first_name,
        "lastName": last_name,
        "role": role if role in ["customer", "provider_owner"] else "customer",
        "isActive": True,
        "createdAt": now_utc().isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Sprint 29: apply referral code if provided
    ref_code = (body.get("referralCode") or body.get("refCode") or "").strip().upper()
    ref_result = None
    if ref_code:
        try:
            from app.referrals import apply_referral_code, ensure_referral_code
            ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
            device = request.headers.get("x-device-id")
            owner_type = "provider" if user_doc["role"].startswith("provider") else "customer"
            ref_result = await apply_referral_code(
                code=ref_code,
                invited_user_id=user_id if owner_type == "customer" else None,
                invited_slug=None,  # provider slug not created yet at registration
                ip=ip,
                device_id=device,
            )
            # Generate code for new user too (so they can share immediately)
            await ensure_referral_code(user_id, {**user_doc, "role": user_doc["role"]})
        except Exception as _exc:
            ref_result = {"ok": False, "reason": f"error: {_exc}"}

    payload = {
        "sub": user_id,
        "email": email,
        "role": user_doc["role"],
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=7)).timestamp()),
    }
    access_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

    user_data = {
        "id": user_id,
        "email": email,
        "firstName": first_name,
        "lastName": last_name,
        "role": user_doc["role"],
    }

    return {"accessToken": access_token, "user": user_data, "referralApplied": ref_result}


@router.get("/me")
async def auth_me(request: Request):
    """Get current user info from JWT"""
    db = get_db()
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")

    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "role": user.get("role", "customer"),
    }


@router.post("/forgot-password")
async def compat_forgot_password(request: Request):
    db = get_db()
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")
    user = await db.users.find_one({"email": email})
    if user:
        reset_token = uid()
        await db.password_reset_tokens.insert_one({
            "userId": str(user["_id"]),
            "email": email,
            "token": reset_token,
            "expiresAt": (now_utc() + timedelta(hours=1)).isoformat(),
            "used": False,
            "createdAt": now_utc().isoformat(),
        })
        logger.info(f"Password reset token generated for {email} (mock; no email sent)")
    # Never reveal whether user exists
    return {"ok": True, "message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
async def compat_reset_password(request: Request):
    db = get_db()
    body = await request.json()
    token = body.get("token", "")
    new_password = body.get("password", "")
    if not token or len(new_password) < 6:
        raise HTTPException(400, "Token and password (>=6 chars) are required")
    record = await db.password_reset_tokens.find_one({"token": token, "used": False})
    if not record:
        raise HTTPException(400, "Invalid or expired token")
    try:
        exp_str = record.get("expiresAt", "")
        if exp_str:
            exp = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp < now_utc():
                raise HTTPException(400, "Token expired")
    except HTTPException:
        raise
    except Exception:
        pass
    await db.users.update_one(
        {"_id": ObjectId(record["userId"])},
        {"$set": {"passwordHash": hash_pw(new_password)}},
    )
    await db.password_reset_tokens.update_one(
        {"token": token},
        {"$set": {"used": True, "usedAt": now_utc().isoformat()}},
    )
    return {"ok": True, "message": "Password updated"}
