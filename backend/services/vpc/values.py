import re
from datetime import date, datetime, timedelta

_SPACES = re.compile(r"\s+")
_EXCEL_EPOCH = datetime(1899, 12, 30)
_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y",
)
_NUMBER = re.compile(r"^-?\d+(?:[.,]\d+)?$")


def clean(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = _SPACES.sub(" ", str(value)).strip()
    return text or None


def to_float(value) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).replace(" ", "").replace(" ", "").strip()
        if not _NUMBER.match(text):
            return None
        number = float(text.replace(",", "."))
    return number if number > 0 else None


def to_datetime(value) -> datetime | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, (int, float)):
        if 20000 < value < 80000:
            return _EXCEL_EPOCH + timedelta(days=float(value))
        return None
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def pack_number(value) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, float):
        return int(value) if value.is_integer() and value > 0 else None
    text = clean(value)
    if text and text.isdigit():
        return int(text) or None
    return None


def split_comments(value) -> list[str]:
    text = clean(value) if not isinstance(value, str) else value.strip()
    if not text:
        return []
    parts = re.split(r"\s+/\s+|\r?\n", text)
    return [p.strip() for p in parts if p and p.strip()]
