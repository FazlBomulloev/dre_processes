import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import AuditLog, Market, User
from backend.schemas import AuditOut, AuditPage
from backend.services.access import require

router = APIRouter(
    prefix="/audit", tags=["audit"],
    dependencies=[Depends(require("audit:read"))],
)


@router.get("", response_model=AuditPage)
async def list_audit(
    user_id: int | None = None,
    action: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    conds = []
    if user_id is not None:
        conds.append(AuditLog.user_id == user_id)
    if action:
        conds.append(AuditLog.action == action)
    total = (await db.execute(
        select(func.count()).select_from(AuditLog).where(*conds)
    )).scalar() or 0
    rows = (await db.execute(
        select(
            AuditLog,
            func.coalesce(User.username, AuditLog.username),
            Market.code,
        )
        .outerjoin(User, User.id == AuditLog.user_id)
        .outerjoin(Market, Market.id == AuditLog.market_id)
        .where(*conds)
        .order_by(AuditLog.at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
    )).all()
    return AuditPage(total=total, items=[
        AuditOut(
            id=entry.id,
            at=entry.at.isoformat(),
            username=username,
            action=entry.action,
            market_code=code,
            details=(
                json.loads(entry.details_json)
                if entry.details_json else None
            ),
        )
        for entry, username, code in rows
    ])
