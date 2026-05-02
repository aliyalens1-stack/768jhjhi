"""Role-based access control — declarative `require_role(...)` factory."""
from __future__ import annotations
from fastapi import Depends, HTTPException, status

from app.middleware.auth import get_current_user
from app.models.role import Role


def require_role(*allowed: Role | str):
    """Returns a dependency that 403s if the current user's role is not in `allowed`.

    Usage:
        @router.get("/admin/stats", dependencies=[Depends(require_role(Role.ADMIN))])
        async def stats(): ...
    """
    allowed_set = {a.value if isinstance(a, Role) else str(a) for a in allowed}

    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_set:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Forbidden — requires role: {', '.join(sorted(allowed_set))}",
            )
        return user

    return _check
