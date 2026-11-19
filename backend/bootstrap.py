import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from backend import config
from backend.database import state
from backend.models import Base, Market
from backend.services.auth import ensure_first_user

log = logging.getLogger(__name__)

# (таблица, колонка, тип) — добавляются к уже существующей базе.
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("users", "own_only", "BOOLEAN NOT NULL DEFAULT 0"),
    ("users", "source_names", "TEXT"),
]


async def _apply_migrations(conn: AsyncConnection) -> None:
    for table, column, ddl_type in _MIGRATIONS:
        existing = await conn.execute(text(f"PRAGMA table_info({table})"))
        if column in {row[1] for row in existing.fetchall()}:
            continue
        await conn.execute(
            text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
        )
        log.info("Миграция: %s.%s добавлена", table, column)


async def _seed_markets(db: AsyncSession) -> None:
    if (await db.execute(select(Market.id).limit(1))).first() is not None:
        return
    for code, name, vpc_market, rgs in config.DEFAULT_MARKETS:
        db.add(Market(
            code=code, name=name,
            enabled_vpc_market=vpc_market, enabled_rgs=rgs,
        ))
    await db.commit()
    log.info("Созданы рынки по умолчанию: %d", len(config.DEFAULT_MARKETS))


async def init_db() -> None:
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    async with state.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_migrations(conn)
    async with state.session() as db:
        await ensure_first_user(db)
        await _seed_markets(db)
    log.info("База данных готова")
