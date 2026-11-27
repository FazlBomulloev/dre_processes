import json
import logging
from datetime import date

from backend.models import Import, Market
from backend.services.rgs import norms as nm
from backend.services.rgs.analytics import Settings

log = logging.getLogger(__name__)

DEFAULT_MANAGERS = {"ЧС": "Чоми", "IZ": "Исфандиер"}
SPLIT_FIELDS = ("dossier_ready", "sent_registrar")


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


def managers(market: Market) -> dict[str, str]:
    raw = rgs_options(market).get("managers")
    if not isinstance(raw, dict):
        return dict(DEFAULT_MANAGERS)
    return {str(k): str(v) for k, v in raw.items() if v}


def import_report(imp: Import) -> dict:
    if not imp.report_json:
        return {}
    try:
        data = json.loads(imp.report_json)
    except json.JSONDecodeError:
        log.warning("Отчёт загрузки %d повреждён", imp.id)
        return {}
    return data if isinstance(data, dict) else {}


def _split(report: dict) -> bool:
    optional = report.get("optional")
    if not isinstance(optional, dict) or not optional:
        return False
    main = next(iter(optional.values()))
    return not any(f in main for f in SPLIT_FIELDS)


def settings(market: Market, imp: Import, today: date) -> Settings:
    report = import_report(imp)
    values = report.get("norms")
    return Settings(
        today=today,
        norms=nm.from_values(values if isinstance(values, dict) else None),
        managers=managers(market),
        split=_split(report),
    )
