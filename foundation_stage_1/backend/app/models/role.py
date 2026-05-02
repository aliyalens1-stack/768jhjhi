"""Role enum — single place to add/remove roles."""
from enum import Enum


class Role(str, Enum):
    USER = "user"
    PROVIDER = "provider"
    ADMIN = "admin"


ALL_ROLES: tuple[str, ...] = tuple(r.value for r in Role)
