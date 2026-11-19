import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import (
    AuditLog,
    Market,
    User,
    UserMarket,
    UserPermission,
    UserSession,
    utcnow,
)
from backend.schemas import PasswordReset, UserCreate, UserOut, UserUpdate
from backend.services.access import FORBIDDEN, Access, require
from backend.services.audit import record
from backend.services.auth import drop_sessions, hash_password
from backend.services.permissions import (
    ALL_MARKETS_ROLES,
    ASSIGNABLE_ROLES,
    GRANTABLE,
    Role,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

_manage = require("users:manage")


async def _markets_of(
    db: AsyncSession, user_ids: list[int],
) -> dict[int, list[str]]:
    rows = await db.execute(
        select(UserMarket.user_id, Market.code)
        .join(Market, Market.id == UserMarket.market_id)
        .where(UserMarket.user_id.in_(user_ids))
        .order_by(Market.code)
    )
    out: dict[int, list[str]] = {uid: [] for uid in user_ids}
    for uid, code in rows.all():
        out[uid].append(code)
    return out


async def _grants_of(
    db: AsyncSession, user_ids: list[int],
) -> dict[int, list[str]]:
    rows = await db.execute(
        select(UserPermission.user_id, UserPermission.permission)
        .where(UserPermission.user_id.in_(user_ids))
        .order_by(UserPermission.permission)
    )
    out: dict[int, list[str]] = {uid: [] for uid in user_ids}
    for uid, permission in rows.all():
        out[uid].append(permission)
    return out


def _out(user: User, markets: list[str], grants: list[str]) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        markets=markets,
        grants=grants,
        own_only=bool(user.own_only),
        source_names=user.source_names,
        created_at=user.created_at.isoformat(),
        last_login_at=(
            user.last_login_at.isoformat() if user.last_login_at else None
        ),
    )


def _check_role(actor: Access, role: str) -> None:
    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(400, "Неизвестная роль")
    if role == Role.admin.value and not actor.can("users:manage_admins"):
        raise HTTPException(403, FORBIDDEN)


def _check_target(actor: Access, target: User) -> None:
    if target.role == Role.owner.value:
        raise HTTPException(403, FORBIDDEN)
    if target.role == Role.admin.value and not actor.can(
        "users:manage_admins",
    ):
        raise HTTPException(403, FORBIDDEN)


def _valid_grants(role: str, grants: list[str]) -> list[str]:
    allowed = GRANTABLE.get(role, frozenset())
    wrong = sorted(set(grants) - allowed)
    if wrong:
        raise HTTPException(
            400, f"Право «{wrong[0]}» нельзя выдать этой роли",
        )
    return sorted(set(grants))


async def _market_ids(
    db: AsyncSession, role: str, codes: list[str],
) -> dict[str, int]:
    if role in ALL_MARKETS_ROLES:
        return {}
    wanted = sorted({c.strip().upper() for c in codes if c.strip()})
    if not wanted:
        return {}
    rows = await db.execute(
        select(Market.code, Market.id).where(Market.code.in_(wanted))
    )
    found = dict(rows.all())
    missing = [c for c in wanted if c not in found]
    if missing:
        raise HTTPException(400, f"Рынок «{missing[0]}» не найден")
    return found


def _names(text: str | None) -> str | None:
    parts = [p.strip() for p in (text or "").split(";") if p.strip()]
    return "; ".join(dict.fromkeys(parts)) or None


async def _set_markets(
    db: AsyncSession, user_id: int, ids: list[int],
) -> None:
    await db.execute(
        delete(UserMarket).where(UserMarket.user_id == user_id)
    )
    for mid in ids:
        db.add(UserMarket(user_id=user_id, market_id=mid))


async def _set_grants(
    db: AsyncSession, user_id: int, grants: list[str],
) -> None:
    await db.execute(
        delete(UserPermission).where(UserPermission.user_id == user_id)
    )
    for permission in grants:
        db.add(UserPermission(user_id=user_id, permission=permission))


async def _target(db: AsyncSession, user_id: int) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Пользователь не найден")
    return user


@router.get("", response_model=list[UserOut])
async def list_users(
    _: Access = Depends(_manage),
    db: AsyncSession = Depends(get_db),
):
    users = (await db.execute(
        select(User).order_by(User.username)
    )).scalars().all()
    ids = [u.id for u in users]
    markets = await _markets_of(db, ids)
    grants = await _grants_of(db, ids)
    return [_out(u, markets[u.id], grants[u.id]) for u in users]


@router.post("", response_model=UserOut)
async def create_user(
    body: UserCreate,
    actor: Access = Depends(_manage),
    db: AsyncSession = Depends(get_db),
):
    _check_role(actor, body.role)
    exists = (await db.execute(
        select(User.id).where(User.username == body.username)
    )).first()
    if exists is not None:
        raise HTTPException(400, "Такой логин уже есть")
    grants = _valid_grants(body.role, body.grants)
    markets = await _market_ids(db, body.role, body.markets)
    pw_hash, salt = hash_password(body.password)
    user = User(
        username=body.username, password_hash=pw_hash, password_salt=salt,
        role=body.role, is_active=True, created_at=utcnow(),
        own_only=body.own_only,
        source_names=_names(body.source_names),
    )
    db.add(user)
    await db.flush()
    await _set_markets(db, user.id, list(markets.values()))
    await _set_grants(db, user.id, grants)
    await db.commit()
    codes = sorted(markets)
    log.info("Создан пользователь «%s» (%s)", user.username, user.role)
    await record(
        db, actor.user, "user_create", username=user.username,
        role=user.role, markets=codes, grants=grants,
        own_only=user.own_only, source_names=user.source_names,
    )
    return _out(user, codes, grants)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    actor: Access = Depends(_manage),
    db: AsyncSession = Depends(get_db),
):
    user = await _target(db, user_id)
    _check_target(actor, user)
    changes: dict = {}
    if body.role is not None and body.role != user.role:
        _check_role(actor, body.role)
        changes["role"] = body.role
        user.role = body.role

    current_markets = (await _markets_of(db, [user.id]))[user.id]
    current_grants = (await _grants_of(db, [user.id]))[user.id]

    if body.grants is not None:
        grants = _valid_grants(user.role, body.grants)
    else:
        allowed = GRANTABLE.get(user.role, frozenset())
        grants = [g for g in current_grants if g in allowed]
    if grants != current_grants:
        await _set_grants(db, user.id, grants)
        changes["grants"] = grants

    wanted = body.markets if body.markets is not None else current_markets
    markets = await _market_ids(db, user.role, wanted)
    codes = sorted(markets)
    if codes != current_markets:
        await _set_markets(db, user.id, list(markets.values()))
        changes["markets"] = codes

    if body.own_only is not None and body.own_only != user.own_only:
        changes["own_only"] = body.own_only
        user.own_only = body.own_only
    if "source_names" in body.model_fields_set:
        names = _names(body.source_names)
        if names != user.source_names:
            changes["source_names"] = names
            user.source_names = names

    if body.is_active is not None and body.is_active != user.is_active:
        changes["is_active"] = body.is_active
        user.is_active = body.is_active

    if changes:
        await drop_sessions(db, user.id)
    await db.commit()
    if changes:
        log.info("Изменён пользователь «%s»: %s", user.username, changes)
        await record(
            db, actor.user, "user_update",
            username=user.username, **changes,
        )
    return _out(user, codes, grants)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    actor: Access = Depends(_manage),
    db: AsyncSession = Depends(get_db),
):
    user = await _target(db, user_id)
    _check_target(actor, user)
    username = user.username
    # Внешние ключи SQLite не включены: связи чистятся вручную.
    for model in (UserSession, UserMarket, UserPermission):
        await db.execute(delete(model).where(model.user_id == user.id))
    await db.execute(
        update(AuditLog)
        .where(AuditLog.user_id == user.id)
        .values(user_id=None)
    )
    await db.delete(user)
    await db.commit()
    log.info("Удалён пользователь «%s»", username)
    await record(db, actor.user, "user_delete", username=username)
    return {"ok": True}


@router.post("/{user_id}/password")
async def reset_password(
    user_id: int,
    body: PasswordReset,
    actor: Access = Depends(_manage),
    db: AsyncSession = Depends(get_db),
):
    user = await _target(db, user_id)
    _check_target(actor, user)
    user.password_hash, user.password_salt = hash_password(body.password)
    await drop_sessions(db, user.id)
    await db.commit()
    log.info("Сброшен пароль пользователя «%s»", user.username)
    await record(
        db, actor.user, "user_password_reset", username=user.username,
    )
    return {"ok": True}
