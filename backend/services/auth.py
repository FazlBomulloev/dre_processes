import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import config
from backend.database import get_db
from backend.models import User, UserSession, utcnow
from backend.services.permissions import Role

log = logging.getLogger(__name__)

_SCRYPT = dict(n=2 ** 14, r=8, p=1, dklen=32)
# Для несуществующего логина хеш считается так же долго: по времени
# ответа нельзя отличить «нет логина» от «неверный пароль».
_DUMMY_SALT = b"\x00" * 16


def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, **_SCRYPT)


def hash_password(
    password: str, salt: bytes | None = None,
) -> tuple[str, str]:
    salt = salt if salt is not None else secrets.token_bytes(16)
    return _scrypt(password, salt).hex(), salt.hex()


def verify_password(password: str, hash_hex: str, salt_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False
    return hmac.compare_digest(_scrypt(password, salt), expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def authenticate(
    db: AsyncSession, username: str, password: str,
) -> User | None:
    user = (await db.execute(
        select(User).where(User.username == username)
    )).scalar_one_or_none()
    if user is None:
        _scrypt(password, _DUMMY_SALT)
        return None
    ok = verify_password(password, user.password_hash, user.password_salt)
    if not ok or not user.is_active:
        return None
    return user


async def create_session(db: AsyncSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        created_at=now,
        expires_at=now + timedelta(days=config.SESSION_DAYS),
    ))
    user.last_login_at = now
    await db.commit()
    return token


async def delete_session(db: AsyncSession, token: str) -> None:
    await db.execute(
        delete(UserSession)
        .where(UserSession.token_hash == hash_token(token))
    )
    await db.commit()


async def drop_sessions(
    db: AsyncSession, user_id: int, keep_token_hash: str | None = None,
) -> None:
    stmt = delete(UserSession).where(UserSession.user_id == user_id)
    if keep_token_hash is not None:
        stmt = stmt.where(UserSession.token_hash != keep_token_hash)
    await db.execute(stmt)


async def get_user_by_token(
    db: AsyncSession, token: str | None,
) -> User | None:
    if not token:
        return None
    row = (await db.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(UserSession.token_hash == hash_token(token))
    )).first()
    if row is None:
        return None
    sess, user = row
    if sess.expires_at <= utcnow():
        await db.delete(sess)
        await db.commit()
        return None
    if not user.is_active:
        return None
    return user


async def require_user(
    request: Request, db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_user_by_token(
        db, request.cookies.get(config.SESSION_COOKIE),
    )
    if user is None:
        raise HTTPException(401, "Требуется вход")
    return user


async def ensure_first_user(db: AsyncSession) -> None:
    existing = (await db.execute(select(User.id).limit(1))).first()
    if existing is not None:
        return
    if not config.ADMIN_USERNAME or not config.ADMIN_PASSWORD:
        log.warning(
            "Пользователей нет, а ADMIN_USERNAME/ADMIN_PASSWORD "
            "не заданы: войти будет некем"
        )
        return
    pw_hash, salt = hash_password(config.ADMIN_PASSWORD)
    db.add(User(
        username=config.ADMIN_USERNAME, password_hash=pw_hash,
        password_salt=salt, role=Role.owner.value, is_active=True,
    ))
    await db.commit()
    log.info("Создан первый пользователь «%s»", config.ADMIN_USERNAME)
