"""Public user schemas (API IO)."""
from pydantic import BaseModel, EmailStr

from app.models.role import Role


class UserOut(BaseModel):
    id: str
    email: EmailStr
    firstName: str = ""
    lastName: str = ""
    role: Role
    isActive: bool = True


class UserUpdate(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
