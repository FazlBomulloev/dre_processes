from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend import config


def _ulower(value):
    return value.lower() if isinstance(value, str) else value


def _sqlite_pragmas(dbapi_connection, _record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
    # lower() в SQLite не меняет регистр кириллицы.
    dbapi_connection.create_function(
        "ulower", 1, _ulower, deterministic=True,
    )


class _State:
    engine: AsyncEngine
    session: async_sessionmaker[AsyncSession]


state = _State()


def configure(url: str) -> None:
    engine = create_async_engine(
        url, connect_args={"check_same_thread": False},
    )
    event.listen(engine.sync_engine, "connect", _sqlite_pragmas)
    state.engine = engine
    state.session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with state.session() as session:
        yield session


configure(config.DATABASE_URL)
