import asyncio
import io
import json
import logging
from dataclasses import dataclass, fields
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Import, Market, RgsItem
from backend.services.access import (
    Access, market_access, require, split_names,
)
from backend.services.audit import record
from backend.services.cache import LruCache, cached
from backend.services.rgs import analytics as an
from backend.services.rgs.settings import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/rgs/{code}", tags=["rgs"])

_module = require("module:rgs")
_FIELDS = {f.name for f in fields(an.Item)} - {"extra"}
_MONTH = r"^\d{4}-(0[1-9]|1[0-2])$"
_STAGE = "^(" + "|".join(k for k, _ in an.STAGES) + ")$"
_CAT = "^(" + "|".join(an.CATEGORIES) + ")$"
_EXPORT_COLUMNS = (
    "ТМ", "ТМ (рус.)", "МНН", "Форма", "Дозировка", "Упаковка",
    "Категория", "Производитель", "Ответственный", "Этап",
    "Подано в Минздрав", "План подачи", "План РУ", "Комментарий",
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

CACHE = LruCache(max_items=300)
ITEMS = LruCache(max_items=16)


@dataclass
class Tracker:
    market: Market
    imp: Import
    items: list[an.Item]
    settings: an.Settings
    own: tuple[str, ...] | None
    access: Access | None = None

    def key(self, *parts) -> tuple:
        return (
            self.market.id, self.imp.id, self.imp.uploaded_at,
            self.market.settings_json, self.settings.today, self.own,
            *parts,
        )


def _item(row: RgsItem) -> an.Item:
    item = an.Item(**{f: getattr(row, f) for f in _FIELDS})
    if row.extra_json:
        item.extra = json.loads(row.extra_json)
    return item


async def _current(db: AsyncSession, market: Market) -> Import | None:
    return (await db.execute(
        select(Import).where(
            Import.kind == "rgs",
            Import.market_id == market.id,
            Import.is_current.is_(True),
        )
    )).scalar_one_or_none()


async def _items(db: AsyncSession, imp: Import) -> list[an.Item]:
    key = (imp.id, imp.uploaded_at)
    items = ITEMS.get(key)
    if items is None:
        rows = (await db.execute(
            select(RgsItem).where(RgsItem.import_id == imp.id)
            .order_by(RgsItem.id)
        )).scalars().all()
        items = [_item(r) for r in rows]
        ITEMS.set(key, items)
    return items


def own_of(access: Access) -> tuple[str, ...] | None:
    names = access.own_names
    return None if names is None else tuple(sorted(names))


async def load(
    db: AsyncSession, market: Market, own: tuple[str, ...] | None,
) -> Tracker | None:
    imp = await _current(db, market)
    if imp is None:
        return None
    items = await _items(db, imp)
    if own is not None:
        names = frozenset(own)
        items = [i for i in items if split_names(i.owner) & names]
    today = imp.data_date or date.today()
    return Tracker(market, imp, items, settings(market, today), own)


async def tracker(
    access: Access = Depends(_module),
    market: Market = Depends(market_access),
    db: AsyncSession = Depends(get_db),
) -> Tracker:
    t = await load(db, market, own_of(access))
    if t is None:
        raise HTTPException(
            404, f"Трекер RGS для рынка {market.code} ещё не загружен",
        )
    t.access = access
    return t


def _overview(t: Tracker, cat: str | None = None):
    return cached(
        CACHE, t.key("overview", cat),
        lambda: an.overview(t.items, t.settings, cat),
    )


def _stops(t: Tracker, cat: str | None = None):
    return cached(
        CACHE, t.key("stops", cat), lambda: an.stops(t.items, cat),
    )


def _products(
    t: Tracker, stage: str | None = None, q: str | None = None,
    cat: str | None = None,
):
    return cached(
        CACHE, t.key("products", stage, q, cat),
        lambda: an.products(t.items, t.settings, stage, q, cat),
    )


async def warm(
    db: AsyncSession, owns: set[tuple[str, ...] | None],
) -> int:
    markets = (await db.execute(
        select(Market).order_by(Market.code)
    )).scalars().all()
    done = 0
    for market in markets:
        for own in owns:
            t = await load(db, market, own)
            if t is None:
                break
            for job in (_overview(t), _products(t), _stops(t)):
                await job
                done += 1
    return done


@router.get("/meta")
async def meta(
    _: Access = Depends(_module),
    market: Market = Depends(market_access),
    db: AsyncSession = Depends(get_db),
):
    imp = await _current(db, market)
    if imp is None:
        return {"loaded": False, "market": market.code, "name": market.name}
    return {
        "loaded": True,
        "market": market.code,
        "name": market.name,
        "data_date": imp.data_date.isoformat() if imp.data_date else None,
        "rows": imp.rows,
        "file_name": imp.file_name,
        "uploaded_at": imp.uploaded_at.isoformat(),
    }


@router.get("/overview")
async def overview(
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
):
    return await _overview(t, cat)


@router.get("/months/{month}")
async def month(
    month: str = Path(..., pattern=_MONTH),
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
):
    return await cached(
        CACHE, t.key("month", month, cat),
        lambda: an.month(t.items, t.settings, month, cat),
    )


@router.get("/stops")
async def stops(
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
):
    return await _stops(t, cat)


@router.get("/products")
async def products(
    stage: str | None = Query(None, pattern=_STAGE),
    q: str | None = Query(None, max_length=100),
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
):
    return await _products(t, stage, q, cat)


def _export_book(items: list[an.Item], s: an.Settings) -> bytes:
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Препараты")
    ws.append(list(_EXPORT_COLUMNS))
    for i in items:
        dates = []
        for value in (i.submitted, i.plan_submit, an.plan_ru(i, s)):
            cell = WriteOnlyCell(ws, value)
            cell.number_format = "DD.MM.YYYY"
            dates.append(cell)
        ws.append([
            i.tm, i.tm_ru, i.generic, i.form, i.dose, i.pack, i.category,
            i.manufacturer, i.owner, an.STAGE_NAMES.get(an.stage(i)),
            *dates, i.comment,
        ])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@router.get("/products.xlsx")
async def export_products(
    stage: str | None = Query(None, pattern=_STAGE),
    q: str | None = Query(None, max_length=100),
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    if not t.access.can("export:xlsx"):
        raise HTTPException(403, "Нет права на выгрузку в Excel")
    rows = an.products(t.items, t.settings, stage, q, cat)["items"]
    by_id = {i.id: i for i in t.items}
    items = [by_id[r["id"]] for r in rows]
    content = await asyncio.to_thread(_export_book, items, t.settings)
    used = {
        k: v for k, v in {"stage": stage, "q": q, "cat": cat}.items() if v
    }
    await record(
        db, t.access.user, "rgs_export", t.market.id,
        rows=len(items), **used,
    )
    log.info("RGS %s: выгрузка в Excel, строк %d", t.market.code, len(items))
    name = f"rgs_{t.market.code}_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/products/{item_id}")
async def product(item_id: int, t: Tracker = Depends(tracker)):
    item = next((i for i in t.items if i.id == item_id), None)
    if item is None:
        raise HTTPException(404, "Препарат не найден")
    return an.product(item, t.settings)
