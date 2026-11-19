import re
from collections.abc import Sequence

from backend.services.vpc.values import to_datetime

FIELDS: dict[str, tuple[str, tuple[str, ...]]] = {
    "offer_no": ("Номер", ("номер",)),
    "status_date": ("Дата Статуса", ("дата статуса",)),
    "deadline": ("Дедлайн", ("дедлайн",)),
    "target_country": ("Страна поиска", ("страна поиска",)),
    "zone": ("Зона", ("зона", "зоны")),
    "status_raw": ("Статус Пд", ("статус пд",)),
    "maker_category": (
        "Категория Пр*",
        ("категория пр*", "категория пр", "категория производителя"),
    ),
    "maker": ("Проиводитель", ("проиводитель", "производитель")),
    "maker_country": (
        "Страна Пр*",
        ("страна пр*", "страна пр", "страна производителя"),
    ),
    "bdm": ("БДМ", ("бдм",)),
    "analyst": ("Аналитик", ("аналитик",)),
    "generic": ("Дженерик", ("дженерик",)),
    "form": ("Форма", ("форма",)),
    "dose": ("Доза", ("доза", "дозировка")),
    "pack_raw": ("Упаковка", ("упаковка",)),
    "comments": ("Комментарии", ("комментарии", "комментарий")),
    "price_usd": ("Цена в USD", ("цена в usd",)),
    "price_agreed": ("Согл.Цена", ("согл.цена", "согл. цена")),
    "price_our1": ("Наша цена 1", ("наша цена 1",)),
    "price_our2": ("Наша цена 2", ("наша цена 2",)),
    "forecast_y1": ("Прогноз 1 год", ("прогноз 1 год",)),
    "forecast_y2": ("Прогноз 2 год", ("прогноз 2 год",)),
    "forecast_y3": ("Прогноз 3 год", ("прогноз 3 год",)),
    "created_at": ("Дата Создания", ("дата создания",)),
    "updated_at": ("Дата Обновления", ("дата обновления",)),
}

REQUIRED = ("generic", "status_raw", "target_country", "maker")

STAGE_DATE_COLUMNS = {
    "1вп": "Вб", "2по": "ПО", "3ац": "АЦ", "4пцкк": "ПцКк", "5кк": "Кк",
    "6нпр": "НПР", "7кд": "КД", "8р": "Р", "9зя": "За",
}

CURRENCIES = frozenset({"USD", "EUR", "RUB", "KZT", "UZS", "AZN", "CNY"})

HEADER_MARK = "дженерик"

_SPACES = re.compile(r"\s+")


def norm(header) -> str:
    if header is None:
        return ""
    text = _SPACES.sub(" ", str(header)).strip().lower()
    return text.replace("ё", "е")


_SYNONYMS = {
    synonym: field
    for field, (_, synonyms) in FIELDS.items()
    for synonym in synonyms
}


def column_names(row: Sequence) -> list[str]:
    names = []
    for i, value in enumerate(row):
        text = _SPACES.sub(" ", str(value)).strip() if value else ""
        names.append(text or f"Колонка {i + 1}")
    return names


def map_columns(headers: Sequence) -> tuple[dict[str, int], list[str]]:
    mapping: dict[str, int] = {}
    duplicates: list[str] = []
    for i, header in enumerate(headers):
        field = _SYNONYMS.get(norm(header))
        if field is None:
            continue
        if field in mapping:
            duplicates.append(str(header).strip())
            continue
        mapping[field] = i
    return mapping, duplicates


def stage_date_columns(headers: Sequence) -> dict[str, int]:
    out: dict[str, int] = {}
    for i, header in enumerate(headers):
        key = norm(header).replace(" ", "")
        stage = STAGE_DATE_COLUMNS.get(key)
        if stage is not None and stage not in out:
            out[stage] = i
    return out


def _share(values: list, test) -> float:
    filled = [v for v in values if v is not None and str(v).strip()]
    if not filled:
        return 0.0
    return sum(1 for v in filled if test(v)) / len(filled)


def _is_currency(value) -> bool:
    return str(value).strip().upper() in CURRENCIES


def detect_by_values(
    headers: Sequence,
    sample: list[Sequence],
    taken: set[int],
) -> dict[str, int]:
    # Шапка у даты последнего комментария и валюты разорвана
    # («Д», «ата», «посл.», «комм.»): колонки ищутся по содержимому
    # сразу после «Комментариев».
    found: dict[str, int] = {}
    comments = next(
        (i for i, h in enumerate(headers) if norm(h) == "комментарии"),
        None,
    )
    order = list(range(len(headers)))
    if comments is not None:
        order = order[comments + 1:] + order[:comments + 1]
    for i in order:
        if i in taken:
            continue
        values = [row[i] if i < len(row) else None for row in sample]
        if "currency" not in found and _share(values, _is_currency) > 0.8:
            found["currency"] = i
            continue
        near = comments is not None and comments < i <= comments + 4
        if (
            "last_comment_date" not in found and near
            and _share(values, lambda v: to_datetime(v) is not None) > 0.8
        ):
            found["last_comment_date"] = i
    return found


def find_header(rows: list[Sequence]) -> int | None:
    for i, row in enumerate(rows):
        if any(norm(v) == HEADER_MARK for v in row):
            return i
    return None
