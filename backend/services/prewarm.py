import asyncio
import logging
import time

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend import config, database
from backend.models import Market, User
from backend.routers import rgs, vpc
from backend.services.access import load_access
from backend.services.vpc.dataset import reset_cache

log = logging.getLogger(__name__)

_lock = asyncio.Lock()
_tasks: set[asyncio.Task] = set()


def invalidate() -> None:
    reset_cache()
    count = sum(
        cache.clear()
        for cache in (vpc.CACHE, vpc.ROWS, rgs.CACHE, rgs.ITEMS)
    )
    log.info("Кэш ответов сброшен, записей: %d", count)


def schedule() -> asyncio.Task | None:
    if not config.PREWARM:
        return None
    task = asyncio.create_task(prewarm_all())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return task


def refresh() -> None:
    invalidate()
    schedule()


async def _scopes(
    db: AsyncSession,
) -> tuple[dict[vpc.Scope, tuple[str, ...]], set]:
    targets = tuple((await db.execute(
        select(Market.code)
        .where(Market.enabled_vpc_market.is_(True))
        .order_by(Market.code)
    )).scalars().all())
    vpc_scopes: dict[vpc.Scope, tuple[str, ...]] = {vpc.FULL: targets}
    rgs_owns: set = {None}
    users = (await db.execute(
        select(User).where(User.is_active.is_(True))
    )).scalars().all()
    for user in users:
        access = await load_access(db, user)
        if access.can("module:vpc") or access.can("module:vpc_market"):
            scope = await vpc.scope_of(db, access)
            codes = scope[0]
            vpc_scopes.setdefault(scope, targets if codes is None else tuple(
                c for c in codes if c in targets
            ))
        if access.can("module:rgs"):
            rgs_owns.add(rgs.own_of(access))
    return vpc_scopes, rgs_owns


async def prewarm_all() -> None:
    async with _lock:
        started = time.perf_counter()
        try:
            async with database.state.session() as db:
                vpc_scopes, rgs_owns = await _scopes(db)
                done = await vpc.warm(db, vpc_scopes)
                done += await rgs.warm(db, rgs_owns)
        except SQLAlchemyError as exc:
            log.warning("Прогрев кэша прерван: %s", exc)
            return
        log.info(
            "Прогрев кэша: %d ответов за %.1f с",
            done, time.perf_counter() - started,
        )
