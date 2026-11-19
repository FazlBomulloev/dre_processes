import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Import, VpcOffer
from backend.services.vpc.headers import norm
from backend.services.vpc.statuses import parse_status

log = logging.getLogger(__name__)

_COLUMNS = (
    "id", "offer_no", "generic", "form", "dose", "pack_raw", "pack_n",
    "maker", "maker_country", "maker_category", "target_country",
    "status_raw", "status_code", "stage", "state", "status_date",
    "bdm", "analyst", "price_usd", "price_agreed", "price_our1",
    "price_our2", "price_final", "price_src", "currency",
    "last_comment", "last_comment_date", "comments", "created_at",
    "updated_at", "stage_dates_json", "extra_json",
)
RESPONSIBLE = frozenset({"ответственный"})
KLASS = frozenset({"класс пд", "класс"})


@dataclass(slots=True)
class Row:
    id: int
    offer_no: str | None
    generic: str
    form: str | None
    dose: str | None
    pack_raw: str | None
    pack_n: int | None
    maker: str | None
    maker_country: str | None
    maker_category: str | None
    target_country: str | None
    status_raw: str | None
    status_code: str | None
    stage: str | None
    state: str
    status_date: datetime | None
    bdm: str | None
    analyst: str | None
    price_usd: float | None
    price_agreed: float | None
    price_our1: float | None
    price_our2: float | None
    price_final: float | None
    price_src: str | None
    currency: str | None
    last_comment: str | None
    last_comment_date: datetime | None
    comments: str | None
    created_at: datetime | None
    updated_at: datetime | None
    stage_dates_json: str | None
    extra_json: str | None
    responsible: str | None = None
    klass: str | None = None
    search: str = ""
    product: tuple = ()
    days: int | None = None
    stages: dict[str, date] = field(default_factory=dict)


@dataclass
class Dataset:
    import_id: int
    uploaded_at: datetime
    data_date: date
    file_name: str
    rows: list[Row]


class _Cache:
    def __init__(self) -> None:
        self.dataset: Dataset | None = None
        self.lock = asyncio.Lock()


_cache = _Cache()


def _key(value: str | None) -> str:
    return (value or "").casefold()


def _prepare(row: Row, data_date: date) -> Row:
    status = parse_status(row.status_raw)
    row.status_code, row.stage, row.state = (
        status.code, status.stage, status.state,
    )
    row.search = " ".join(
        _key(v) for v in (row.generic, row.maker, row.comments) if v
    )
    row.product = (_key(row.generic), _key(row.form), _key(row.dose))
    if row.status_date is not None:
        row.days = max((data_date - row.status_date.date()).days, 0)
    if row.stage_dates_json:
        row.stages = {
            stage: datetime.fromisoformat(stamp).date()
            for stage, stamp in json.loads(row.stage_dates_json).items()
        }
        row.stage_dates_json = None
    if row.extra_json:
        for name, value in json.loads(row.extra_json).items():
            key = norm(name)
            if key in RESPONSIBLE:
                row.responsible = role(value)
            elif key in KLASS:
                row.klass = str(value).strip() or None
        row.extra_json = None
    return row


def role(value) -> str | None:
    text = str(value).split("·")[0].strip()
    return text or None


async def _current_import(db: AsyncSession) -> Import | None:
    return (await db.execute(
        select(Import)
        .where(Import.kind == "vpc", Import.is_current.is_(True))
        .order_by(Import.id.desc())
        .limit(1)
    )).scalar_one_or_none()


def _fresh(cached: Dataset | None, imp: Import) -> bool:
    return (
        cached is not None and cached.import_id == imp.id
        and cached.uploaded_at == imp.uploaded_at
    )


async def _load(db: AsyncSession, imp: Import) -> Dataset:
    columns = [getattr(VpcOffer, c) for c in _COLUMNS]
    result = await db.execute(
        select(*columns).where(VpcOffer.import_id == imp.id)
    )
    data_date = imp.data_date or imp.uploaded_at.date()
    rows = [_prepare(Row(*values), data_date) for values in result.all()]
    log.info("ВПЦ: в память загружен снимок %d, строк %d",
             imp.id, len(rows))
    return Dataset(imp.id, imp.uploaded_at, data_date, imp.file_name, rows)


async def current_dataset(db: AsyncSession) -> Dataset | None:
    imp = await _current_import(db)
    if imp is None:
        return None
    if _fresh(_cache.dataset, imp):
        return _cache.dataset
    async with _cache.lock:
        if not _fresh(_cache.dataset, imp):
            _cache.dataset = await _load(db, imp)
        return _cache.dataset


def reset_cache() -> None:
    _cache.dataset = None
