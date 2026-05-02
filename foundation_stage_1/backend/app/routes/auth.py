"""Auth endpoints — POST /api/auth/register, POST /api/auth/login."""
from fastapi import APIRouter

from app.core.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest) -> dict:
    """Create a new user account and return a fresh JWT.

    Self-service can only register `user` or `provider` — admin must be
    created server-side (seed) so the endpoint cannot be used to grant
    admin privileges.
    """
    return await auth_service.register(get_db(), body)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> dict:
    """Exchange email + password for an access token."""
    return await auth_service.login(get_db(), body)
