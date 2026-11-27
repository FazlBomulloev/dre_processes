import asyncio
import json
import logging
import re
import shutil
import uuid
from datetime import date
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend import config
from backend.models import Import, Market, RgsItem, User, VpcOffer
from backend.services.rgs.reader import read_rgs
from backend.services.rgs.settings import mapping
from backend.services.rgs.store import drop_moves, record_moves
from backend.services.vpc.reader import read_vpc

log = logging.getLogger(__name__)

INSERT_BATCH = 1000
EXCEL_EXT = (".xlsx", ".xlsm")
_CODE = re.compile(r"^[A-Z]{2,3}$")

_locks: dict[str, asyncio.Lock] = {}


class UploadTooLarge(ValueError):
    pass


def lock(kind: str) -> asyncio.Lock:
    return _locks.setdefault(kind, asyncio.Lock())


def kind_dir(kind: str) -> Path:
    return config.UPLOAD_DIR / kind


async def save_upload(file: UploadFile) -> Path:
    tmp_dir = config.UPLOAD_DIR / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    dest = tmp_dir / f"{uuid.uuid4().hex}.xlsx"
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    written = 0
    with open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                out.close()
                dest.unlink(missing_ok=True)
                raise UploadTooLarge(
                    f"Файл больше {config.MAX_UPLOAD_MB} МБ"
                )
            out.write(chunk)
    return dest


async def _ensure_markets(
    db: AsyncSession, codes: list[str],
) -> list[str]:
    wanted = sorted({c for c in codes if c and _CODE.match(c)})
    if not wanted:
        return []
    existing = set((await db.execute(
        select(Market.code).where(Market.code.in_(wanted))
    )).scalars().all())
    created = [c for c in wanted if c not in existing]
    for code in created:
        name = config.COUNTRY_NAMES.get(code, code)
        db.add(Market(code=code, name=name))
    return created


async def _drop_import(
    db: AsyncSession, imp: Import, keep_moves: bool = False,
) -> None:
    if imp.kind == "vpc":
        await db.execute(
            delete(VpcOffer).where(VpcOffer.import_id == imp.id)
        )
    if imp.kind == "rgs":
        await db.execute(
            delete(RgsItem).where(RgsItem.import_id == imp.id)
        )
        if not keep_moves:
            await drop_moves(db, imp.id)
    await db.delete(imp)
    if imp.stored_name:
        (kind_dir(imp.kind) / imp.stored_name).unlink(missing_ok=True)


async def prune(
    db: AsyncSession, kind: str, keep: int, market_id: int | None = None,
) -> int:
    old = (await db.execute(
        select(Import)
        .where(*_scope(kind, market_id), Import.is_current.is_(False))
        .order_by(Import.uploaded_at.desc(), Import.id.desc())
        .offset(max(keep - 1, 0))
    )).scalars().all()
    for imp in old:
        await _drop_import(db, imp, keep_moves=True)
    return len(old)


async def import_vpc(
    db: AsyncSession, tmp: Path, file_name: str, user: User,
) -> Import:
    result = await asyncio.to_thread(read_vpc, tmp, file_name)
    report = result.report
    imp = Import(
        kind="vpc",
        file_name=file_name,
        data_date=result.data_date,
        rows=len(result.offers),
        uploaded_by=user.id,
        uploaded_by_name=user.username,
        is_current=False,
    )
    db.add(imp)
    await db.flush()
    offers = result.offers
    for start in range(0, len(offers), INSERT_BATCH):
        await db.execute(insert(VpcOffer), [
            {"import_id": imp.id, **o}
            for o in offers[start:start + INSERT_BATCH]
        ])
    report["new_markets"] = await _ensure_markets(
        db, list(report["targets"]),
    )
    imp.report_json = json.dumps(report, ensure_ascii=False)
    await db.execute(
        update(Import)
        .where(Import.kind == "vpc", Import.id != imp.id)
        .values(is_current=False)
    )
    imp.is_current = True
    await db.commit()

    target_dir = kind_dir("vpc")
    target_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{imp.id}.xlsx"
    try:
        shutil.move(tmp, target_dir / stored)
        imp.stored_name = stored
    except OSError:
        log.exception("Не удалось сохранить файл загрузки %d", imp.id)
    pruned = await prune(db, "vpc", config.VPC_KEEP_SNAPSHOTS)
    await db.commit()
    log.info(
        "ВПЦ: загружено %d предложений из «%s», снимок %d, удалено "
        "старых снимков %d", imp.rows, file_name, imp.id, pruned,
    )
    return imp


async def _store(db: AsyncSession, imp: Import, tmp: Path) -> None:
    target_dir = kind_dir(imp.kind)
    target_dir.mkdir(parents=True, exist_ok=True)
    stored = f"{imp.id}.xlsx"
    try:
        shutil.move(tmp, target_dir / stored)
        imp.stored_name = stored
    except OSError:
        log.exception("Не удалось сохранить файл загрузки %d", imp.id)


async def import_rgs(
    db: AsyncSession, tmp: Path, file_name: str, user: User,
    market: Market, data_date: date,
) -> Import:
    result = await asyncio.to_thread(read_rgs, tmp, mapping(market))
    prev = (await db.execute(
        select(Import).where(
            *_scope("rgs", market.id), Import.is_current.is_(True),
        )
    )).scalar_one_or_none()
    imp = Import(
        kind="rgs",
        market_id=market.id,
        file_name=file_name,
        data_date=data_date,
        rows=len(result.items),
        report_json=json.dumps(result.report, ensure_ascii=False),
        uploaded_by=user.id,
        uploaded_by_name=user.username,
        is_current=False,
    )
    db.add(imp)
    await db.flush()
    await db.execute(insert(RgsItem), [
        {"import_id": imp.id, **item} for item in result.items
    ])
    moves = await record_moves(db, prev, imp) if prev is not None else 0
    await db.execute(
        update(Import)
        .where(*_scope("rgs", market.id), Import.id != imp.id)
        .values(is_current=False)
    )
    imp.is_current = True
    if not market.enabled_rgs:
        market.enabled_rgs = True
    await db.commit()
    await _store(db, imp, tmp)
    pruned = await prune(db, "rgs", config.RGS_KEEP_SNAPSHOTS, market.id)
    await db.commit()
    log.info(
        "RGS %s: загружено %d позиций из «%s», снимок %d, переносов "
        "плана %d, удалено старых снимков %d", market.code, imp.rows,
        file_name, imp.id, moves, pruned,
    )
    return imp


def _scope(kind: str, market_id: int | None):
    same_market = (
        Import.market_id.is_(None) if market_id is None
        else Import.market_id == market_id
    )
    return (Import.kind == kind, same_market)


async def make_current(db: AsyncSession, imp: Import) -> None:
    await db.execute(
        update(Import)
        .where(*_scope(imp.kind, imp.market_id))
        .values(is_current=False)
    )
    imp.is_current = True
    await db.commit()


async def remove(db: AsyncSession, imp: Import) -> Import | None:
    was_current = imp.is_current
    kind, market_id = imp.kind, imp.market_id
    await _drop_import(db, imp)
    await db.flush()
    promoted = None
    if was_current:
        promoted = (await db.execute(
            select(Import)
            .where(*_scope(kind, market_id))
            .order_by(Import.uploaded_at.desc(), Import.id.desc())
            .limit(1)
        )).scalar_one_or_none()
        if promoted is not None:
            promoted.is_current = True
    await db.commit()
    return promoted
