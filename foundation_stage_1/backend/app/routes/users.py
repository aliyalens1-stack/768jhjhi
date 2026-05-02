"""User endpoints — GET /api/users/me, GET /api/users (admin only)."""
from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.middleware.role_check import require_role
from app.models.role import Role
from app.models.user import to_public
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)) -> dict:
    """Return the currently authenticated user's profile."""
    return user


@router.get(
    "",
    response_model=list[UserOut],
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def list_users(limit: int = 50) -> list[dict]:
    """Admin-only — list all users in the system."""
    db = get_db()
    docs = await db.users.find({}).limit(min(limit, 200)).to_list(None)
    return [to_public(d) for d in docs]
