import asyncio
import io
import logging
from dataclasses import dataclass
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import config
from backend.database import get_db
from backend.models import Import, Market
from backend.services.access import (
    Access, market_access, require, split_names,
)
from backend.services.audit import record
from backend.services.cache import LruCache, cached
from backend.services.rgs import analytics as an
from backend.services.rgs import store
from backend.services.rgs.history import changes, item_key, snapshot_date
from backend.services.rgs.settings import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/rgs/{code}", tags=["rgs"])

_module = require("module:rgs")
_MONTH = r"^(\d{4}-(0[1-9]|1[0-2])|overdue)$"
_VIEW = "^(" + "|".join(an.VIEWS) + ")$"
_CAT = "^(" + "|".join(an.CATEGORIES) + ")$"
_TONES = {
    an.GRN: "зелёный", an.AMB: "жёлтый", an.RED: "красный",
    an.NA: "нет данных",
}
_EXPORT_COLUMNS = (
    "ТМ", "ТМ (рус.)", "МНН", "Форма", "Дозировка", "Упаковка",
    "Категория", "Производитель", "Менеджер", "Статус", "Статус по датам",
    "Пл ПД", "Подано", "Сдвиг, дн.", "Цикл до подачи, дн.",
    "Цикл до подачи", "План РУ", "До плана РУ, дн.", "План РУ: цвет",
    "Следующий шаг", "Срок шага", "Код причины", "JS / IZ (Comments)",
    "Комментарии ИЗ и ЧС", "Комментарии БДМ",
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_TMS = 200
DYNAMICS = 6
MEETING_DAYS = 14

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
        items = await store.load_items(db, imp.id)
        ITEMS.set(key, items)
    return items


def _own(
    items: list[an.Item], own: tuple[str, ...] | None,
) -> list[an.Item]:
    if own is None:
        return items
    names = frozenset(own)
    return [i for i in items if split_names(i.owner) & names]


def _when(imp: Import) -> date:
    return snapshot_date(imp.data_date, imp.uploaded_at.date())


async def _snapshot(
    db: AsyncSession, t: "Tracker", imp: Import,
) -> tuple[list[an.Item], an.Settings]:
    items = _own(await _items(db, imp), t.own)
    return items, settings(t.market, imp, _when(imp))


def own_of(access: Access) -> tuple[str, ...] | None:
    names = access.own_names
    return None if names is None else tuple(sorted(names))


def today() -> date:
    return config.RGS_TODAY or date.today()


async def load(
    db: AsyncSession, market: Market, own: tuple[str, ...] | None,
) -> Tracker | None:
    imp = await _current(db, market)
    if imp is None:
        return None
    items = _own(await _items(db, imp), own)
    return Tracker(
        market, imp, items, settings(market, imp, today()), own,
    )


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


def scope_of(
    cat: str | None = Query(None, pattern=_CAT),
    year: int | None = Query(None, ge=2000, le=2100),
    tm: list[str] = Query(default=[]),
) -> an.Scope:
    if len(tm) > MAX_TMS:
        raise HTTPException(
            422, f"Можно выбрать не больше {MAX_TMS} продуктов",
        )
    tms = tuple(sorted({t.strip()[:300] for t in tm if t.strip()}))
    return an.Scope(cat=cat, year=year, tms=tms)


def _overview(t: Tracker, sc: an.Scope = an.Scope()):
    return cached(
        CACHE, t.key("overview", sc),
        lambda: an.overview(t.items, t.settings, sc),
    )


def _stops(t: Tracker, sc: an.Scope = an.Scope()):
    return cached(
        CACHE, t.key("stops", sc),
        lambda: an.stops(t.items, t.settings, sc),
    )


def _products(
    t: Tracker, view: str | None = None, q: str | None = None,
    cat: str | None = None, mgr: str | None = None,
):
    return cached(
        CACHE, t.key("products", view, q, cat, mgr),
        lambda: an.products(t.items, t.settings, view, q, cat, mgr),
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
    access: Access = Depends(_module),
    market: Market = Depends(market_access),
    db: AsyncSession = Depends(get_db),
):
    t = await load(db, market, own_of(access))
    if t is None:
        return {"loaded": False, "market": market.code, "name": market.name}
    imp = t.imp
    return {
        "loaded": True,
        "market": market.code,
        "name": market.name,
        "data_date": imp.data_date.isoformat() if imp.data_date else None,
        "today": t.settings.today.isoformat(),
        "rows": imp.rows,
        "file_name": imp.file_name,
        "uploaded_at": imp.uploaded_at.isoformat(),
    }


@router.get("/overview")
async def overview(
    sc: an.Scope = Depends(scope_of),
    t: Tracker = Depends(tracker),
):
    return await _overview(t, sc)


@router.get("/months/{month}")
async def month(
    month: str = Path(..., pattern=_MONTH),
    sc: an.Scope = Depends(scope_of),
    t: Tracker = Depends(tracker),
):
    return await cached(
        CACHE, t.key("month", month, sc),
        lambda: an.month(t.items, t.settings, month, sc),
    )


@router.get("/stops")
async def stops(
    sc: an.Scope = Depends(scope_of),
    t: Tracker = Depends(tracker),
):
    return await _stops(t, sc)


@router.get("/products")
async def products(
    view: str | None = Query(None, pattern=_VIEW),
    q: str | None = Query(None, max_length=100),
    cat: str | None = Query(None, pattern=_CAT),
    mgr: str | None = Query(None, max_length=100),
    t: Tracker = Depends(tracker),
):
    return await _products(t, view, q, cat, mgr)


def _date_cell(ws, value: date | None) -> WriteOnlyCell:
    cell = WriteOnlyCell(ws, value)
    cell.number_format = "DD.MM.YYYY"
    return cell


def _export_book(evs: list[an.Ev], s: an.Settings) -> bytes:
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Препараты")
    ws.append(list(_EXPORT_COLUMNS))
    for e in evs:
        i = e.item
        shift = (
            (i.submitted - i.plan_submit).days
            if i.submitted and i.plan_submit else None
        )
        ws.append([
            i.tm, i.tm_ru, i.generic, i.form, i.dose, i.pack, i.category,
            i.manufacturer, e.manager, i.status_code, e.status.by_date,
            _date_cell(ws, i.plan_submit), _date_cell(ws, i.submitted),
            shift, e.cycle.fact, _TONES[e.cycle.tone],
            _date_cell(ws, e.ru.plan), e.ru.days, _TONES[e.ru.tone],
            i.next_step, _date_cell(ws, i.step_due), i.reason_code,
            i.comment, i.comment_iz, i.comment_bdm,
        ])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@router.get("/products.xlsx")
async def export_products(
    view: str | None = Query(None, pattern=_VIEW),
    q: str | None = Query(None, max_length=100),
    cat: str | None = Query(None, pattern=_CAT),
    mgr: str | None = Query(None, max_length=100),
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    if not t.access.can("export:xlsx"):
        raise HTTPException(403, "Нет права на выгрузку в Excel")
    _, _, evs = an.product_evs(t.items, t.settings, view, q, cat, mgr)
    content = await asyncio.to_thread(_export_book, evs, t.settings)
    used = {
        k: v for k, v in {
            "view": view, "q": q, "cat": cat, "mgr": mgr,
        }.items() if v
    }
    await record(
        db, t.access.user, "rgs_export", t.market.id,
        rows=len(evs), **used,
    )
    log.info("RGS %s: выгрузка в Excel, строк %d", t.market.code, len(evs))
    name = f"rgs_{t.market.code}_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/products/{item_id}")
async def product(
    item_id: int,
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    item = next((i for i in t.items if i.id == item_id), None)
    if item is None:
        raise HTTPException(404, "Препарат не найден")
    moves = await store.moves_for(db, t.market.id, item_key(item))
    return {
        **an.product(item, t.settings),
        "plan_moves": [
            {
                "at": m.at.isoformat(), "old": m.old.isoformat(),
                "new": m.new.isoformat(),
            }
            for m in moves
        ],
    }


def _snapshot_out(imp: Import) -> dict:
    return {
        "id": imp.id,
        "date": _when(imp).isoformat(),
        "file_name": imp.file_name,
        "current": bool(imp.is_current),
    }


@router.get("/snapshots")
async def snapshots(
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    return {
        "items": [
            _snapshot_out(imp)
            for imp in await store.snapshots(db, t.market.id)
        ],
    }


@router.get("/kpi")
async def kpi(
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    history = await store.snapshots(db, t.market.id, DYNAMICS)
    history.sort(key=lambda imp: (_when(imp), imp.id))
    loaded = [(imp, *await _snapshot(db, t, imp)) for imp in history]
    sc = an.Scope(cat=cat)
    ids = tuple(imp.id for imp in history)

    def build() -> dict:
        evs = an.active_evs(t.items, t.settings, sc)
        points = []
        for imp, items, s in loaded:
            values = an.kpis(an.active_evs(items, s, sc), s)
            points.append({
                **_snapshot_out(imp),
                "values": {k["key"]: k["value"] for k in values},
            })
        return {"kpis": an.kpis(evs, t.settings), "dynamics": points}

    return await cached(CACHE, t.key("kpi", cat, ids), build)


def _base_of(history: list[Import], current: Import) -> Import | None:
    others = sorted(
        (imp for imp in history if imp.id != current.id),
        key=lambda imp: (_when(imp), imp.id),
    )
    if not others:
        return None
    limit = _when(current) - timedelta(days=MEETING_DAYS)
    older = [imp for imp in others if _when(imp) <= limit]
    return older[-1] if older else others[0]


@router.get("/changes")
async def meeting_changes(
    base: int | None = Query(None, ge=1),
    cat: str | None = Query(None, pattern=_CAT),
    t: Tracker = Depends(tracker),
    db: AsyncSession = Depends(get_db),
):
    history = await store.snapshots(db, t.market.id)
    picked = (
        next((imp for imp in history if imp.id == base), None)
        if base else _base_of(history, t.imp)
    )
    if base and picked is None:
        raise HTTPException(404, "Снимок не найден")
    sc = an.Scope(cat=cat)
    out = {
        "current": _snapshot_out(t.imp),
        "base": _snapshot_out(picked) if picked else None,
        "snapshots": [
            _snapshot_out(imp) for imp in history if imp.id != t.imp.id
        ],
    }
    if picked is None:
        return out
    items, s = await _snapshot(db, t, picked)

    def build() -> dict:
        return {**out, **changes(
            an.active_evs(t.items, t.settings, sc),
            an.active_evs(items, s, sc),
            t.settings.norms.get("ru_warn"),
        )}

    return await cached(CACHE, t.key("changes", picked.id, cat), build)
