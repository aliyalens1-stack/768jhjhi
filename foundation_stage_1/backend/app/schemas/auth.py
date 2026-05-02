"""Auth request/response schemas. These are the public API contracts."""
from pydantic import BaseModel, EmailStr, Field

from app.models.role import Role
from app.schemas.user import UserOut


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    firstName: str = ""
    lastName: str = ""
    # Self-service registration may only choose `user` or `provider`.
    # Admin role is created server-side / via seed only.
    role: Role = Role.USER


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    accessToken: str
    user: UserOut
