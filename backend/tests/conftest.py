from collections.abc import Iterable

import httpx
import pytest_asyncio
from sqlalchemy import select

from backend import config, database
from backend.bootstrap import init_db
from backend.main import app
from backend.models import Market, User, UserMarket, UserPermission
from backend.services import prewarm
from backend.services.auth import hash_password

PASSWORD = "password1"
OWNER = "owner"
OWNER_PASSWORD = "owner-pass-1"


class Env:
    def __init__(self) -> None:
        self.transport = httpx.ASGITransport(app=app)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=self.transport, base_url="http://test",
        )

    async def market_id(self, code: str) -> int:
        async with database.state.session() as db:
            return (await db.execute(
                select(Market.id).where(Market.code == code)
            )).scalar_one()

    async def user(
        self,
        username: str,
        role: str,
        markets: Iterable[str] = (),
        grants: Iterable[str] = (),
        active: bool = True,
        names: str | None = None,
    ) -> int:
        pw_hash, salt = hash_password(PASSWORD)
        market_ids = [await self.market_id(c) for c in markets]
        async with database.state.session() as db:
            user = User(
                username=username, password_hash=pw_hash,
                password_salt=salt, role=role, is_active=active,
                own_only=names is not None, source_names=names,
            )
            db.add(user)
            await db.flush()
            for mid in market_ids:
                db.add(UserMarket(user_id=user.id, market_id=mid))
            for permission in grants:
                db.add(UserPermission(user_id=user.id, permission=permission))
            await db.commit()
            return user.id

    async def login(
        self, username: str, password: str = PASSWORD,
    ) -> httpx.AsyncClient:
        client = self.client()
        response = await client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        assert response.status_code == 200, response.text
        return client

    async def owner(self) -> httpx.AsyncClient:
        return await self.login(OWNER, OWNER_PASSWORD)


@pytest_asyncio.fixture
async def env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "ADMIN_USERNAME", OWNER)
    monkeypatch.setattr(config, "ADMIN_PASSWORD", OWNER_PASSWORD)
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(config, "PREWARM", False)
    prewarm.invalidate()
    database.configure(
        f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}",
    )
    await init_db()
    yield Env()
    await database.state.engine.dispose()
