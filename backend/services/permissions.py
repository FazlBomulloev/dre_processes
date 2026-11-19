from collections.abc import Iterable
from enum import Enum


class Role(str, Enum):
    owner = "owner"
    admin = "admin"
    manager = "manager"
    analyst = "analyst"
    viewer = "viewer"


MODULES = frozenset({"module:vpc", "module:vpc_market", "module:rgs"})
UPLOADS = frozenset({"upload:vpc", "upload:rgs"})

# Права только владельца выдаются через «*»: users:manage_admins,
# audit:read, imports:delete, markets:create.
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Role.owner.value: frozenset({"*"}),
    Role.admin.value: MODULES | UPLOADS | {
        "export:xlsx", "users:manage", "markets:write",
    },
    Role.manager.value: MODULES | {"export:xlsx"},
    Role.analyst.value: frozenset({"export:xlsx"}),
    Role.viewer.value: frozenset(),
}

GRANTABLE: dict[str, frozenset[str]] = {
    Role.analyst.value: MODULES | UPLOADS,
    Role.viewer.value: MODULES,
}

ALL_MARKETS_ROLES = frozenset({
    Role.owner.value, Role.admin.value, Role.manager.value,
})

ASSIGNABLE_ROLES = frozenset(r.value for r in Role) - {Role.owner.value}


def effective_permissions(
    role: str, granted: Iterable[str] = (),
) -> frozenset[str]:
    base = ROLE_PERMISSIONS.get(role, frozenset())
    extra = GRANTABLE.get(role, frozenset()) & set(granted)
    return base | extra


def has_permission(permissions: Iterable[str], permission: str) -> bool:
    granted = set(permissions)
    return "*" in granted or permission in granted


def role_has(role: str, permission: str) -> bool:
    return has_permission(ROLE_PERMISSIONS.get(role, ()), permission)
