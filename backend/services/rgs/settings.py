import json
import logging
from datetime import date

from backend import config
from backend.models import Market
from backend.services.rgs.analytics import Settings

log = logging.getLogger(__name__)


def rgs_options(market: Market) -> dict:
    if not market.settings_json:
        return {}
    try:
        data = json.loads(market.settings_json)
    except json.JSONDecodeError:
        log.warning("Настройки рынка %s повреждены", market.code)
        return {}
    options = data.get("rgs") if isinstance(data, dict) else None
    return options if isinstance(options, dict) else {}


def mapping(market: Market) -> dict[str, list[str]]:
    raw = rgs_options(market).get("mapping") or {}
    if not isinstance(raw, dict):
        return {}
    return {
        str(k): [str(v) for v in (vals if isinstance(vals, list) else [vals])]
        for k, vals in raw.items()
    }


def _date(value, default: date | None) -> date | None:
    if not value:
        return default
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return default


def settings(market: Market, today: date) -> Settings:
    options = rgs_options(market)
    margin = options.get("ru_margin_months", config.RGS_RU_MARGIN_MONTHS)
    return Settings(
        today=today,
        margin=margin if isinstance(margin, int) else 2,
        plan_date=_date(options.get("plan_date"), config.RGS_PLAN_DATE),
        split_blockers=bool(options.get("split_blockers", False)),
    )
