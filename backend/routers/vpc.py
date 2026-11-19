import asyncio
import io
import json
import logging
from dataclasses import asdict
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import VpcOffer
from backend.services.access import Access, market_codes, require_any
from backend.services.audit import record
from backend.services.vpc import analytics as an
from backend.services.vpc import insights as ins
from backend.services.vpc.dataset import Dataset, Row, current_dataset
from backend.services.vpc.statuses import STAGE_NAMES
from backend.services.vpc.values import split_comments

log = logging.getLogger(__name__)
router = APIRouter(prefix="/vpc", tags=["vpc"])

_module = require_any("module:vpc", "module:vpc_market")

PriceColumn = Literal["auto", "agreed", "our2", "our1", "usd"]
Tab = Literal["all", "work", "contract", "result", "stop"]
Sort = Literal[
    "price", "agreed", "usd", "to_min", "maker", "generic", "target", "status",
    "status_date", "days", "updated", "responsible",
]

EXPORT_LIMIT = 50_000
SUGGEST_LIMIT = 8
TOP_MNN = 8

TIMELINE = (
    ("Вб", ("Вб",)),
    ("ПО", ("ПО",)),
    ("АЦ", ("АЦ",)),
    ("ПцКк", ("ПцКк",)),
    ("Кк", ("Кк",)),
    ("ПцР", ("НПР", "КД")),
    ("Р", ("Р",)),
    ("За", ("За",)),
)
_TIMELINE_INDEX = {code: i for i, (code, _) in enumerate(TIMELINE)}

CONDITIONS = ("Срок", "ДРУ", "МОЗ", "Досье", "КИ/БЭ", "ICH", "Доп. платежи")
HIDDEN_EXTRA = frozenset({
    "Статус Пд Ан*", "Общий Статус", "ата", "посл.", "Ответственный",
    "Зоны", "Дней прошло",
})
DEADLINES = {"not expired": "не истёк", "expired": "истёк"}


def filters_dep(
    mnn: str | None = None,
    form: str | None = None,
    dose: str | None = None,
    pack: str | None = Query(None, max_length=100),
    status: str | None = None,
    target: str | None = None,
    maker: str | None = None,
    state: str | None = None,
    maker_country: str | None = None,
    bdm: str | None = None,
    analyst: str | None = None,
    category: str | None = None,
    responsible: str | None = Query(None, max_length=100),
    q: str | None = Query(None, max_length=200),
    stage: str | None = Query(None, max_length=10),
    priced: bool = False,
    price: PriceColumn = an.AGGREGATE_PRICE,
    active: bool = False,
) -> an.Filters:
    return an.Filters(
        mnn=mnn, form=form, dose=dose, pack=pack, status=status,
        target=target, maker=maker, state=state,
        maker_country=maker_country, bdm=bdm,
        analyst=analyst, category=category, responsible=responsible,
        q=q, stage=stage, priced=priced, price=price, active=active,
    )


async def _scoped(
    db: AsyncSession, access: Access,
) -> tuple[Dataset, list[Row]]:
    ds = await current_dataset(db)
    if ds is None:
        raise HTTPException(404, "Выгрузка ВПЦ ещё не загружена")
    return ds, await _visible(db, access, ds)


async def _visible(
    db: AsyncSession, access: Access, ds: Dataset,
) -> list[Row]:
    codes = await market_codes(db, access.market_ids)
    rows = an.scope(ds.rows, codes)
    if access.own_names is None:
        return rows
    return [r for r in rows if access.owns(r.bdm, r.analyst)]


def _for_target(rows: list[Row], target: str | None) -> list[Row]:
    if not target:
        return rows
    key = target.casefold()
    return [r for r in rows if (r.target_country or "").casefold() == key]


@router.get("/meta")
async def meta(
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds = await current_dataset(db)
    if ds is None:
        return {"loaded": False}
    rows = await _visible(db, access, ds)
    return {
        "loaded": True,
        "import_id": ds.import_id,
        "data_date": ds.data_date.isoformat(),
        "file_name": ds.file_name,
        "rows": len(rows),
    }


@router.get("/offers")
async def offers(
    f: an.Filters = Depends(filters_dep),
    tab: Tab = "all",
    sort: Sort = "price",
    desc: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds, rows = await _scoped(db, access)

    def build() -> dict:
        base = an.apply(rows, f)
        pct = an.to_min(base, f.price)
        table = an.sort_rows(an.in_tab(base, tab), sort, desc, f.price, pct)
        page = table[offset:offset + limit]
        return {
            "total": len(table),
            "tabs": an.tab_counts(base),
            "items": [an.item(r, f.price, pct) for r in page],
            "product": an.hero(base, f.price) if f.mnn else None,
            "top_mnn": [] if f.mnn else an.mnn_cards(
                base, f.price, TOP_MNN,
            ),
            "data_date": ds.data_date.isoformat(),
        }

    return await asyncio.to_thread(build)


@router.get("/facets")
async def get_facets(
    f: an.Filters = Depends(filters_dep),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)
    return await asyncio.to_thread(an.facets, rows, f)


@router.get("/suggest")
async def suggest(
    q: str = Query(..., min_length=1, max_length=100),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)
    needle = q.strip().casefold()

    def build() -> list[dict]:
        out = []
        for kind in ("mnn", "maker"):
            counts: dict[str, int] = {}
            for row in rows:
                value = an.facet_value(row, kind)
                if value and needle in value.casefold():
                    counts[value] = counts.get(value, 0) + 1
            ranked = sorted(
                counts.items(),
                key=lambda i: (
                    not i[0].casefold().startswith(needle), -i[1], i[0],
                ),
            )
            out += [
                {"kind": kind, "value": v, "count": n}
                for v, n in ranked[:SUGGEST_LIMIT]
            ]
        return out

    return await asyncio.to_thread(build)


def _extra(offer: VpcOffer) -> dict[str, str]:
    if not offer.extra_json:
        return {}
    return json.loads(offer.extra_json)


def _timeline(offer: VpcOffer) -> list[dict]:
    dates = json.loads(offer.stage_dates_json or "{}")
    stage = "Р" if offer.stage == "Р-" else offer.stage
    current = _TIMELINE_INDEX.get(stage or "", -1)
    out = []
    for i, (code, keys) in enumerate(TIMELINE):
        stamp = next((dates[k] for k in keys if dates.get(k)), None)
        name = STAGE_NAMES[code]
        if code == "Р" and offer.stage == "Р-":
            name = STAGE_NAMES["Р-"]
        out.append({
            "code": code,
            "name": name,
            "date": stamp,
            "reached": stamp is not None or i <= current,
            "current": i == current,
        })
    return out


def _rank(
    target: Row, rows: list[Row], column: str,
) -> dict | None:
    price = an.price_of(target, column)
    if price is None:
        return None
    group = sorted(
        (
            (p, r) for r in rows
            if r.product == target.product
            and an.currency_of(r, column)
            == an.currency_of(target, column)
            and (p := an.price_of(r, column)) is not None
        ),
        key=lambda i: (i[0], i[1].id),
    )
    ids = [r.id for _, r in group]
    if target.id not in ids:
        return None
    low_price, low = group[0]
    return {
        "place": ids.index(target.id) + 1,
        "of": len(ids),
        "min": low_price,
        "min_maker": low.maker,
        "to_min": (
            round((price / low_price - 1) * 100) if len(ids) > 1 else None
        ),
    }


@router.get("/offers/{offer_id}")
async def offer_card(
    offer_id: int,
    f: an.Filters = Depends(filters_dep),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds, rows = await _scoped(db, access)
    target = next((r for r in rows if r.id == offer_id), None)
    offer = await db.get(VpcOffer, offer_id)
    if target is None or offer is None:
        raise HTTPException(404, "Предложение не найдено")

    rank = _rank(target, an.apply(rows, f), f.price)
    if rank is None:
        rank = _rank(target, rows, f.price)

    extra = _extra(offer)
    conditions = [
        {"label": label, "value": extra[label]}
        for label in CONDITIONS if extra.get(label)
    ]
    if offer.zone:
        conditions.append({"label": "Зона", "value": offer.zone})
    forecasts = [offer.forecast_y1, offer.forecast_y2, offer.forecast_y3]
    if any(v is not None for v in forecasts):
        conditions.append({
            "label": "Прогноз 1 / 2 / 3 год, уп.",
            "value": " / ".join(
                f"{v:,.0f}".replace(",", " ") if v is not None else "—"
                for v in forecasts
            ),
        })
    if offer.deadline:
        conditions.append({
            "label": "Дедлайн",
            "value": DEADLINES.get(offer.deadline.casefold(),
                                   offer.deadline),
        })
    shown = set(CONDITIONS) | HIDDEN_EXTRA
    other = [
        {"label": k, "value": v} for k, v in extra.items() if k not in shown
    ]

    comments = split_comments(offer.comments)
    prices = {
        "agreed": offer.price_agreed, "our2": offer.price_our2,
        "our1": offer.price_our1, "usd": offer.price_usd,
    }
    return {
        **an.item(target, f.price, {}),
        "to_min": rank["to_min"] if rank else None,
        "rank": rank,
        "prices": prices,
        "zone": offer.zone,
        "responsible": extra.get("Ответственный"),
        "created_at": an.iso(offer.created_at),
        "conditions": conditions,
        "other": other,
        "comments": list(reversed(comments)),
        "timeline": _timeline(offer),
        "data_date": ds.data_date.isoformat(),
    }


_EXPORT_COLUMNS = (
    ("offer_no", "Номер"), ("generic", "МНН"), ("form", "Форма"),
    ("dose", "Доза"), ("pack_raw", "Упаковка"), ("maker", "Завод"),
    ("maker_country", "Страна завода"),
    ("maker_category", "Категория завода"),
    ("target_country", "Для страны"), ("price", "Цена за уп."),
    ("currency", "Валюта"), ("price_src", "Источник цены"),
    ("to_min", "К мин., %"), ("status_code", "Статус"),
    ("status_name", "Этап"), ("days", "Дней в статусе"),
    ("status_date", "Дата статуса"), ("bdm", "БДМ"),
    ("analyst", "Аналитик"), ("responsible", "Ответственный"),
    ("last_comment", "Последний комментарий"),
    ("last_comment_date", "Дата комментария"),
    ("updated_at", "Обновлено"),
)
_SOURCES = {
    "agreed": "Согл.Цена", "our2": "Наша цена 2", "our1": "Наша цена 1",
    "usd": "Цена в USD",
}


def _export_book(rows: list[Row], column: str, pct: dict) -> bytes:
    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Предложения")
    ws.append([label for _, label in _EXPORT_COLUMNS])
    for row in rows:
        data = an.item(row, column, pct)
        data["status_date"] = row.status_date
        data["last_comment_date"] = row.last_comment_date
        data["updated_at"] = row.updated_at
        data["price_src"] = _SOURCES.get(data["price_src"] or "", "")
        ws.append([data[key] for key, _ in _EXPORT_COLUMNS])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@router.get("/offers.xlsx")
async def export_offers(
    f: an.Filters = Depends(filters_dep),
    tab: Tab = "all",
    sort: Sort = "price",
    desc: bool = False,
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    if not access.can("export:xlsx"):
        raise HTTPException(403, "Нет права на выгрузку в Excel")
    _, rows = await _scoped(db, access)

    def build() -> tuple[bytes, int]:
        base = an.apply(rows, f)
        pct = an.to_min(base, f.price)
        table = an.sort_rows(an.in_tab(base, tab), sort, desc, f.price, pct)
        table = table[:EXPORT_LIMIT]
        return _export_book(table, f.price, pct), len(table)

    content, count = await asyncio.to_thread(build)
    used = {k: v for k, v in asdict(f).items() if v not in (None, "")}
    await record(
        db, access.user, "vpc_export", rows=count, tab=tab, **used,
    )
    log.info("ВПЦ: выгрузка в Excel, строк %d", count)
    name = f"vpc_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


Period = Literal["3", "6", "12", "all"]
Mode = Literal["target", "maker"]
FactorySort = Literal["offers", "price", "contracts"]


@router.get("/factories")
async def get_factories(
    period: Period = "all",
    sort: FactorySort = "offers",
    limit: int = Query(10, ge=1, le=2000),
    target: str | None = Query(None, max_length=20),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds, rows = await _scoped(db, access)
    rows = _for_target(rows, target)

    def build() -> dict:
        scoped = ins.in_period(rows, period, ds.data_date)
        return {
            **ins.factories(scoped, ds.data_date, sort, limit),
            "period": period,
        }

    return await asyncio.to_thread(build)


@router.get("/factory")
async def get_factory(
    maker: str = Query(..., min_length=1, max_length=300),
    target: str | None = Query(None, max_length=20),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)
    rows = _for_target(rows, target)
    profile = await asyncio.to_thread(ins.factory_profile, rows, maker)
    if profile is None:
        raise HTTPException(404, "Завод не найден")
    return profile


@router.get("/countries")
async def get_countries(
    mode: Mode = "target",
    target: str | None = Query(None, max_length=20),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)
    rows = _for_target(rows, target)
    return await asyncio.to_thread(ins.countries, rows, mode)


@router.get("/country")
async def get_country(
    code: str = Query(..., min_length=1, max_length=100),
    mode: Mode = "target",
    target: str | None = Query(None, max_length=20),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)
    rows = _for_target(rows, target)
    detail = await asyncio.to_thread(ins.country_detail, rows, code, mode)
    if detail is None:
        raise HTTPException(404, "Страна не найдена")
    return detail


@router.get("/funnel")
async def get_funnel(
    period: Period = "12",
    target: str | None = Query(None, max_length=20),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds, rows = await _scoped(db, access)
    rows = _for_target(rows, target)
    data = await asyncio.to_thread(ins.funnel, rows, period, ds.data_date)
    return {**data, "target": target}


@router.get("/summary")
async def get_summary(
    tab: Tab = "all",
    f: an.Filters = Depends(filters_dep),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    _, rows = await _scoped(db, access)

    def build() -> dict:
        data = ins.summary(an.in_tab(an.apply(rows, f), tab))
        if f.target:
            data["target_name"] = ins.country_name(f.target, "target")
        return data

    return await asyncio.to_thread(build)


def _matches(value: str | None, wanted: str | None) -> bool:
    return not wanted or (value or "").casefold() == wanted.casefold()


@router.get("/overview")
async def get_overview(
    target: str | None = Query(None, max_length=20),
    responsible: str | None = Query(None, max_length=100),
    klass: str | None = Query(None, max_length=100),
    period: str = Query("all", pattern=r"^(3|6|12|all|\d{4})$"),
    access: Access = Depends(_module),
    db: AsyncSession = Depends(get_db),
):
    ds, rows = await _scoped(db, access)
    rows = _for_target(rows, target)
    filters = ins.overview_filters(rows)
    rows = [
        r for r in ins.by_period(rows, period, ds.data_date)
        if _matches(r.responsible, responsible)
        and _matches(r.klass, klass)
    ]
    data = await asyncio.to_thread(
        ins.overview, rows, ds.data_date, bool(target),
        ins.period_end(period, ds.data_date),
    )
    return {
        **data,
        "filters": filters,
        "target": target,
        "data_date": ds.data_date.isoformat(),
    }
