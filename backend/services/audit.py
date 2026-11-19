import json
import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import AuditLog, User

log = logging.getLogger(__name__)


async def record(
    db: AsyncSession,
    user: User | None,
    action: str,
    market_id: int | None = None,
    **details,
) -> None:
    # Пишется после самого действия: сбой журнала его не отменяет.
    try:
        db.add(AuditLog(
            user_id=user.id if user is not None else None,
            username=user.username if user is not None else None,
            action=action,
            market_id=market_id,
            details_json=(
                json.dumps(details, ensure_ascii=False, default=str)
                if details else None
            ),
        ))
        await db.commit()
    except SQLAlchemyError:
        log.exception("Не удалось записать в журнал действие %s", action)
        await db.rollback()
