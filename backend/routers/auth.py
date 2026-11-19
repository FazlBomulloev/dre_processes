import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import COOKIE_SECURE, SESSION_COOKIE, SESSION_DAYS
from backend.database import get_db
from backend.models import User
from backend.schemas import (
    LoginRequest,
    PasswordChange,
    SessionEnvelope,
    SessionOut,
)
from backend.services.access import load_access, market_codes
from backend.services.audit import record
from backend.services.auth import (
    authenticate,
    create_session,
    delete_session,
    drop_sessions,
    get_user_by_token,
    hash_password,
    hash_token,
    require_user,
    verify_password,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


async def session_out(db: AsyncSession, user: User) -> SessionOut:
    access = await load_access(db, user)
    return SessionOut(
        id=user.id,
        username=user.username,
        role=user.role,
        permissions=sorted(access.permissions),
        markets=await market_codes(db, access.market_ids),
        own_only=access.own_names is not None,
    )


@router.post("/login", response_model=SessionOut)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await authenticate(db, body.username, body.password)
    if user is None:
        log.warning("Неудачная попытка входа: «%s»", body.username[:100])
        # Введённый логин в журнал не пишем: туда по ошибке вводят пароль.
        target = (await db.execute(
            select(User).where(User.username == body.username)
        )).scalar_one_or_none()
        await record(db, target, "login_failed")
        raise HTTPException(401, "Неверный логин или пароль")
    token = await create_session(db, user)
    await record(db, user, "login")
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_DAYS * 86400,
        httponly=True, samesite="lax", secure=COOKIE_SECURE, path="/",
    )
    return await session_out(db, user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await delete_session(db, token)
    response.delete_cookie(
        SESSION_COOKIE, path="/", httponly=True,
        samesite="lax", secure=COOKIE_SECURE,
    )
    return {"ok": True}


@router.get("/session", response_model=SessionEnvelope)
async def session(request: Request, db: AsyncSession = Depends(get_db)):
    # Без сессии — не 401, а пустой ответ: страница входа без ошибок.
    user = await get_user_by_token(db, request.cookies.get(SESSION_COOKIE))
    return SessionEnvelope(
        user=await session_out(db, user) if user else None,
    )


@router.post("/password")
async def change_password(
    body: PasswordChange,
    request: Request,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(
        body.old_password, user.password_hash, user.password_salt,
    ):
        raise HTTPException(400, "Неверный текущий пароль")
    user.password_hash, user.password_salt = hash_password(
        body.new_password,
    )
    token = request.cookies.get(SESSION_COOKIE)
    await drop_sessions(
        db, user.id, keep_token_hash=hash_token(token) if token else None,
    )
    await db.commit()
    await record(db, user, "password_change")
    return {"ok": True}
