import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Market
from backend.schemas import MarketCreate, MarketOut, MarketUpdate
from backend.services.access import (
    Access,
    get_access,
    market_access,
    require,
)
from backend.services import prewarm
from backend.services.audit import record

log = logging.getLogger(__name__)
router = APIRouter(prefix="/markets", tags=["markets"])


def _out(market: Market) -> MarketOut:
    return MarketOut(
        id=market.id,
        code=market.code,
        name=market.name,
        enabled_vpc_market=market.enabled_vpc_market,
        enabled_rgs=market.enabled_rgs,
    )


@router.get("", response_model=list[MarketOut])
async def list_markets(
    access: Access = Depends(get_access),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Market).order_by(Market.code)
    if access.market_ids is not None:
        stmt = stmt.where(Market.id.in_(access.market_ids))
    markets = (await db.execute(stmt)).scalars().all()
    return [_out(m) for m in markets]


@router.get("/{code}", response_model=MarketOut)
async def get_market(market: Market = Depends(market_access)):
    return _out(market)


@router.post("", response_model=MarketOut)
async def create_market(
    body: MarketCreate,
    actor: Access = Depends(require("markets:create")),
    db: AsyncSession = Depends(get_db),
):
    code = body.code.upper()
    exists = (await db.execute(
        select(Market.id).where(Market.code == code)
    )).first()
    if exists is not None:
        raise HTTPException(400, f"Рынок «{code}» уже есть")
    market = Market(
        code=code,
        name=body.name.strip(),
        enabled_vpc_market=body.enabled_vpc_market,
        enabled_rgs=body.enabled_rgs,
    )
    db.add(market)
    await db.commit()
    log.info("Создан рынок %s «%s»", market.code, market.name)
    await record(
        db, actor.user, "market_create", market.id,
        code=market.code, name=market.name,
    )
    return _out(market)


@router.patch("/{code}", response_model=MarketOut)
async def update_market(
    body: MarketUpdate,
    market: Market = Depends(market_access),
    actor: Access = Depends(require("markets:write")),
    db: AsyncSession = Depends(get_db),
):
    changes = {
        key: value
        for key, value in body.model_dump(exclude_none=True).items()
        if getattr(market, key) != value
    }
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    if not changes:
        return _out(market)
    for key, value in changes.items():
        setattr(market, key, value)
    await db.commit()
    prewarm.refresh()
    log.info("Изменён рынок %s: %s", market.code, changes)
    await record(
        db, actor.user, "market_update", market.id,
        code=market.code, **changes,
    )
    return _out(market)
