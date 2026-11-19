import json
import logging
from datetime import date
from pathlib import Path
from zipfile import BadZipFile

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from openpyxl.utils.exceptions import InvalidFileException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Import, Market
from backend.schemas import ImportOut
from backend.services import imports as svc
from backend.services import prewarm
from backend.services.access import FORBIDDEN, Access, require, require_any
from backend.services.audit import record
from backend.services.rgs.reader import RgsFormatError
from backend.services.vpc.reader import VpcFormatError

log = logging.getLogger(__name__)
router = APIRouter(prefix="/imports", tags=["imports"])

_viewer = require_any("upload:vpc", "upload:rgs", "imports:delete")


def _out(imp: Import, code: str | None, report: bool = False) -> ImportOut:
    return ImportOut(
        id=imp.id,
        kind=imp.kind,
        market_code=code,
        file_name=imp.file_name,
        data_date=imp.data_date.isoformat() if imp.data_date else None,
        rows=imp.rows,
        uploaded_by=imp.uploaded_by_name,
        uploaded_at=imp.uploaded_at.isoformat(),
        is_current=imp.is_current,
        report=(
            json.loads(imp.report_json)
            if report and imp.report_json else None
        ),
    )


async def _get(db: AsyncSession, import_id: int) -> tuple[Import, str]:
    row = (await db.execute(
        select(Import, Market.code)
        .outerjoin(Market, Market.id == Import.market_id)
        .where(Import.id == import_id)
    )).first()
    if row is None:
        raise HTTPException(404, "Загрузка не найдена")
    return row[0], row[1]


@router.get("", response_model=list[ImportOut])
async def list_imports(
    kind: str | None = None,
    _: Access = Depends(_viewer),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Import, Market.code)
        .outerjoin(Market, Market.id == Import.market_id)
        .order_by(Import.uploaded_at.desc(), Import.id.desc())
    )
    if kind:
        stmt = stmt.where(Import.kind == kind)
    rows = (await db.execute(stmt)).all()
    return [_out(imp, code) for imp, code in rows]


@router.get("/{import_id}", response_model=ImportOut)
async def get_import(
    import_id: int,
    _: Access = Depends(_viewer),
    db: AsyncSession = Depends(get_db),
):
    imp, code = await _get(db, import_id)
    return _out(imp, code, report=True)


@router.post("/vpc", response_model=ImportOut)
async def upload_vpc(
    file: UploadFile = File(...),
    access: Access = Depends(require("upload:vpc")),
    db: AsyncSession = Depends(get_db),
):
    name = Path(file.filename or "").name
    if not name.lower().endswith(svc.EXCEL_EXT):
        raise HTTPException(400, "Нужен файл Excel (.xlsx)")
    lock = svc.lock("vpc")
    if lock.locked():
        raise HTTPException(409, "Уже идёт загрузка ВПЦ, подождите")
    async with lock:
        try:
            tmp = await svc.save_upload(file)
        except svc.UploadTooLarge as exc:
            raise HTTPException(413, str(exc)) from exc
        try:
            imp = await svc.import_vpc(db, tmp, name, access.user)
        except VpcFormatError as exc:
            log.warning("ВПЦ «%s» не загружен: %s", name, exc)
            raise HTTPException(400, str(exc)) from exc
        except (BadZipFile, InvalidFileException, KeyError) as exc:
            log.warning("ВПЦ «%s» не прочитан: %s", name, exc)
            raise HTTPException(
                400, "Не удалось прочитать файл: это не книга Excel "
                "или она повреждена",
            ) from exc
        finally:
            tmp.unlink(missing_ok=True)
    prewarm.refresh()
    await record(
        db, access.user, "vpc_import",
        file=name, rows=imp.rows, import_id=imp.id,
    )
    return _out(imp, None, report=True)


@router.post("/rgs", response_model=ImportOut)
async def upload_rgs(
    market: str = Query(..., min_length=2, max_length=8),
    data_date: date | None = Query(None),
    file: UploadFile = File(...),
    access: Access = Depends(require("upload:rgs")),
    db: AsyncSession = Depends(get_db),
):
    target = (await db.execute(
        select(Market).where(Market.code == market.upper())
    )).scalar_one_or_none()
    if target is None or not access.sees_market(target.id):
        raise HTTPException(404, "Рынок не найден")
    name = Path(file.filename or "").name
    if not name.lower().endswith(svc.EXCEL_EXT):
        raise HTTPException(400, "Нужен файл Excel (.xlsx)")
    lock = svc.lock(f"rgs:{target.code}")
    if lock.locked():
        raise HTTPException(409, "Уже идёт загрузка RGS, подождите")
    async with lock:
        try:
            tmp = await svc.save_upload(file)
        except svc.UploadTooLarge as exc:
            raise HTTPException(413, str(exc)) from exc
        try:
            imp = await svc.import_rgs(
                db, tmp, name, access.user, target,
                data_date or date.today(),
            )
        except RgsFormatError as exc:
            log.warning("RGS «%s» не загружен: %s", name, exc)
            raise HTTPException(400, str(exc)) from exc
        except (BadZipFile, InvalidFileException, KeyError) as exc:
            log.warning("RGS «%s» не прочитан: %s", name, exc)
            raise HTTPException(
                400, "Не удалось прочитать файл: это не книга Excel "
                "или она повреждена",
            ) from exc
        finally:
            tmp.unlink(missing_ok=True)
    prewarm.refresh()
    await record(
        db, access.user, "rgs_import", target.id,
        file=name, rows=imp.rows, import_id=imp.id,
    )
    return _out(imp, target.code, report=True)


@router.post("/{import_id}/current", response_model=ImportOut)
async def set_current(
    import_id: int,
    access: Access = Depends(_viewer),
    db: AsyncSession = Depends(get_db),
):
    imp, code = await _get(db, import_id)
    if not access.can(f"upload:{imp.kind}"):
        raise HTTPException(403, FORBIDDEN)
    if not imp.is_current:
        await svc.make_current(db, imp)
        prewarm.refresh()
        log.info("Снимок %d (%s) сделан текущим", imp.id, imp.kind)
        await record(
            db, access.user, "import_current", imp.market_id,
            kind=imp.kind, import_id=imp.id, file=imp.file_name,
        )
    return _out(imp, code)


@router.delete("/{import_id}")
async def delete_import(
    import_id: int,
    access: Access = Depends(require("imports:delete")),
    db: AsyncSession = Depends(get_db),
):
    imp, _ = await _get(db, import_id)
    details = dict(
        kind=imp.kind, import_id=imp.id, file=imp.file_name,
    )
    market_id = imp.market_id
    promoted = await svc.remove(db, imp)
    prewarm.refresh()
    log.info("Удалён снимок %d (%s)", details["import_id"], details["kind"])
    await record(
        db, access.user, "import_delete", market_id,
        promoted=promoted.id if promoted else None, **details,
    )
    return {"ok": True, "current": promoted.id if promoted else None}
