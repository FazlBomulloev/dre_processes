import json
import logging
from dataclasses import fields

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Import, RgsItem, RgsPlanMove
from backend.services.rgs import analytics as an
from backend.services.rgs.history import plan_moves, snapshot_date

log = logging.getLogger(__name__)

FIELDS = {f.name for f in fields(an.Item)} - {"extra"}


def to_item(row: RgsItem) -> an.Item:
    item = an.Item(**{f: getattr(row, f) for f in FIELDS})
    if row.extra_json:
        item.extra = json.loads(row.extra_json)
    return item


async def load_items(db: AsyncSession, import_id: int) -> list[an.Item]:
    rows = (await db.execute(
        select(RgsItem).where(RgsItem.import_id == import_id)
        .order_by(RgsItem.id)
    )).scalars().all()
    return [to_item(r) for r in rows]


async def snapshots(
    db: AsyncSession, market_id: int, limit: int | None = None,
) -> list[Import]:
    query = (
        select(Import)
        .where(Import.kind == "rgs", Import.market_id == market_id)
        .order_by(Import.uploaded_at.desc(), Import.id.desc())
    )
    if limit:
        query = query.limit(limit)
    return list((await db.execute(query)).scalars().all())


def _date(imp: Import):
    return snapshot_date(imp.data_date, imp.uploaded_at.date())


async def record_moves(
    db: AsyncSession, prev: Import, imp: Import,
) -> int:
    moves = plan_moves(
        await load_items(db, prev.id), await load_items(db, imp.id),
    )
    if moves:
        await db.execute(insert(RgsPlanMove), [
            {
                "market_id": imp.market_id, "import_id": imp.id,
                "at": _date(imp), **m,
            }
            for m in moves
        ])
    return len(moves)


async def drop_moves(db: AsyncSession, import_id: int) -> None:
    await db.execute(
        delete(RgsPlanMove).where(RgsPlanMove.import_id == import_id)
    )


async def moves_for(
    db: AsyncSession, market_id: int, key: str,
) -> list[RgsPlanMove]:
    return list((await db.execute(
        select(RgsPlanMove)
        .where(RgsPlanMove.market_id == market_id, RgsPlanMove.key == key)
        .order_by(RgsPlanMove.at, RgsPlanMove.id)
    )).scalars().all())


async def backfill_moves(db: AsyncSession) -> int:
    markets = (await db.execute(
        select(Import.market_id)
        .where(Import.kind == "rgs", Import.market_id.is_not(None))
        .group_by(Import.market_id)
        .having(func.count(Import.id) > 1)
    )).scalars().all()
    total = 0
    for market_id in markets:
        known = (await db.execute(
            select(func.count(RgsPlanMove.id))
            .where(RgsPlanMove.market_id == market_id)
        )).scalar_one()
        if known:
            continue
        ordered = list(reversed(await snapshots(db, market_id)))
        for prev, imp in zip(ordered, ordered[1:]):
            total += await record_moves(db, prev, imp)
    if total:
        await db.commit()
        log.info("RGS: восстановлено переносов плана подачи: %d", total)
    return total
