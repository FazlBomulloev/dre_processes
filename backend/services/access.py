import re
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Market, User, UserMarket, UserPermission
from backend.services.auth import require_user
from backend.services.permissions import (
    ALL_MARKETS_ROLES,
    effective_permissions,
    has_permission,
)

FORBIDDEN = "Недостаточно прав для этого действия"
_NAME_SPLIT = re.compile(r"[;/\n]+")


def split_names(text: str | None) -> frozenset[str]:
    if not text:
        return frozenset()
    return frozenset(
        n.strip().casefold() for n in _NAME_SPLIT.split(text) if n.strip()
    )


@dataclass(frozen=True)
class Access:
    user: User
    permissions: frozenset[str]
    market_ids: frozenset[int] | None
    own_names: frozenset[str] | None = None

    def owns(self, *values: str | None) -> bool:
        if self.own_names is None:
            return True
        return any(split_names(v) & self.own_names for v in values)

    def can(self, permission: str) -> bool:
        return has_permission(self.permissions, permission)

    def sees_market(self, market_id: int) -> bool:
        return self.market_ids is None or market_id in self.market_ids


async def user_grants(db: AsyncSession, user_id: int) -> list[str]:
    rows = await db.execute(
        select(UserPermission.permission)
        .where(UserPermission.user_id == user_id)
        .order_by(UserPermission.permission)
    )
    return list(rows.scalars().all())


async def allowed_market_ids(
    db: AsyncSession, user: User,
) -> frozenset[int] | None:
    if user.role in ALL_MARKETS_ROLES:
        return None
    rows = await db.execute(
        select(UserMarket.market_id).where(UserMarket.user_id == user.id)
    )
    return frozenset(rows.scalars().all())


async def market_codes(
    db: AsyncSession, market_ids: frozenset[int] | None,
) -> list[str] | None:
    if market_ids is None:
        return None
    if not market_ids:
        return []
    rows = await db.execute(
        select(Market.code)
        .where(Market.id.in_(market_ids))
        .order_by(Market.code)
    )
    return list(rows.scalars().all())


def own_names(user: User) -> frozenset[str] | None:
    if user.role in ALL_MARKETS_ROLES or not user.own_only:
        return None
    return split_names(user.source_names)


async def load_access(db: AsyncSession, user: User) -> Access:
    grants = await user_grants(db, user.id)
    return Access(
        user=user,
        permissions=effective_permissions(user.role, grants),
        market_ids=await allowed_market_ids(db, user),
        own_names=own_names(user),
    )


async def get_access(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> Access:
    return await load_access(db, user)


def require(permission: str):
    async def checker(access: Access = Depends(get_access)) -> Access:
        if not access.can(permission):
            raise HTTPException(403, FORBIDDEN)
        return access

    return checker


def require_any(*permissions: str):
    async def checker(access: Access = Depends(get_access)) -> Access:
        if not any(access.can(p) for p in permissions):
            raise HTTPException(403, FORBIDDEN)
        return access

    return checker


async def market_access(
    code: str,
    access: Access = Depends(get_access),
    db: AsyncSession = Depends(get_db),
) -> Market:
    # Чужой рынок отвечает как несуществующий.
    market = (await db.execute(
        select(Market).where(Market.code == code.upper())
    )).scalar_one_or_none()
    if market is None or not access.sees_market(market.id):
        raise HTTPException(404, "Рынок не найден")
    return market
