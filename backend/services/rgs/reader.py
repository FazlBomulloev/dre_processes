import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import islice
from pathlib import Path

from openpyxl import load_workbook

from backend.services.rgs import headers as hd
from backend.services.rgs import norms as nm
from backend.services.rgs.status import known_status
from backend.services.vpc.values import clean, to_datetime

HEADER_SCAN_ROWS = 10
MAIN_SHEETS = ("Е", "E")
NEW_SHEETS = ("IN",)
EXTRA_LIMIT = 300
MIN_YEAR = 2000
EXPECTED = (
    "generic", "form", "dose", "category", "owner", "manufacturer",
    "status_code", "task_date", "plan_submit", "submitted", "exp1_paid",
    "exp2_paid", "ru_date",
)
_TRUTHY_EMPTY = frozenset({"0", "-", "—", "нет", "no", "false", "❌"})
_TEXT = (
    "tm", "tm_ru", "generic", "form", "dose", "pack", "owner",
    "manufacturer", "applicant", "group_code", "comment", "comment_iz",
    "comment_bdm", "next_step", "reason_code", "erp_id",
)


class RgsFormatError(ValueError):
    pass


@dataclass
class RgsParse:
    items: list[dict]
    report: dict


def _filled(value) -> bool:
    text = clean(value)
    return text is not None and text.casefold() not in _TRUTHY_EMPTY


def _cell(row: Sequence, index: int | None):
    if index is None or index >= len(row):
        return None
    return row[index]


def _sheets(wb) -> list:
    names = {hd.norm(ws.title): ws for ws in wb.worksheets}
    main = next(
        (names[hd.norm(n)] for n in MAIN_SHEETS if hd.norm(n) in names),
        None,
    )
    if main is None:
        main = wb.worksheets[0]
    extra = [
        names[hd.norm(n)] for n in NEW_SHEETS
        if hd.norm(n) in names and names[hd.norm(n)] is not main
    ]
    return [main, *extra]


def _parse_sheet(
    ws, overrides: dict, report: dict, required: bool,
) -> list[dict]:
    tm_aliases = (*overrides.get("tm", ()), *hd.FIELDS["tm"])
    rows = list(ws.iter_rows(values_only=True))
    head = list(islice(rows, HEADER_SCAN_ROWS))
    h = hd.find_header(head, tm_aliases)
    if h is None:
        if not required:
            return []
        raise RgsFormatError(
            f"На листе «{ws.title}» в первых {HEADER_SCAN_ROWS} строках "
            "нет колонки «TM ENG»"
        )
    main = rows[h]
    keys = {hd.norm(a) for a in tm_aliases}
    tm_col = next(j for j, v in enumerate(main) if v and hd.norm(v) in keys)
    below = rows[h + 1] if h + 1 < len(rows) else None
    sub = below is not None and _cell(below, tm_col) is None
    names = hd.column_names(
        rows[h - 1] if h > 0 else None, main, below if sub else None,
    )
    cols = hd.resolve(names, overrides)
    new_sheet = hd.norm(ws.title) in {hd.norm(n) for n in NEW_SHEETS}
    report["columns"][ws.title] = {
        f: names[j] for f, j in cols.items()
    }
    report["missing"][ws.title] = [
        f for f in EXPECTED if f not in cols
    ]
    report["optional"][ws.title] = [
        f for f in hd.OPTIONAL if f not in cols
    ]
    used = set(cols.values())
    start = h + (2 if sub else 1)
    items = []
    for offset, row in enumerate(rows[start:], start=start + 1):
        tm = clean(_cell(row, cols["tm"]))
        if not tm:
            continue
        item = _item(row, cols, report)
        item["is_new"] = new_sheet or _filled(_cell(row, cols.get("is_new")))
        item["sheet"] = ws.title
        item["row_no"] = offset
        extra = {
            names[j]: str(v)[:EXTRA_LIMIT]
            for j, v in enumerate(row)
            if j not in used and v is not None and j < len(names)
            and names[j] and clean(v)
        }
        item["extra_json"] = (
            json.dumps(extra, ensure_ascii=False, default=str)
            if extra else None
        )
        items.append(item)
    report["sheets"][ws.title] = len(items)
    return items


def _item(row: Sequence, cols: dict[str, int], report: dict) -> dict:
    item: dict = {f: clean(_cell(row, cols.get(f))) for f in _TEXT}
    category = clean(_cell(row, cols.get("category")))
    item["category"] = category.upper() if category else None
    status = clean(_cell(row, cols.get("status_code")))
    item["status_code"] = status.casefold() if status else None
    if not known_status(item["status_code"]):
        report["unknown_statuses"][item["status_code"]] += 1
    dates = {}
    for field in hd.DATE_FIELDS:
        raw = _cell(row, cols.get(field))
        value = to_datetime(raw)
        if value is not None and value.year < MIN_YEAR:
            value = None
        if value is None and clean(raw):
            report["bad_dates"][field] += 1
        dates[field] = value.date() if value else None
    item.update(dates)
    mask = 0
    for i in range(len(hd.DOCS)):
        if _filled(_cell(row, cols.get(f"doc_{i}"))):
            mask |= 1 << i
    item["docs_mask"] = mask
    return item


def _key(item: dict) -> tuple:
    return tuple(
        hd.norm(item[f]) if item[f] else "" for f in ("tm", "form", "dose")
    )


def _merge_new(items: list[dict], new: list[dict]) -> list[dict]:
    known = {_key(i): i for i in items}
    added = []
    for item in new:
        same = known.get(_key(item))
        if same is None:
            added.append(item)
        else:
            same["is_new"] = True
    return added


def _norms(wb) -> dict[str, int] | None:
    for ws in wb.worksheets:
        if hd.norm(ws.title) == hd.norm(nm.SHEET):
            return nm.parse(ws.iter_rows(values_only=True))
    return None


def read_rgs(path: Path, overrides: dict | None = None) -> RgsParse:
    overrides = overrides or {}
    report: dict = {
        "sheets": {},
        "columns": {},
        "missing": {},
        "optional": {},
        "unknown_statuses": Counter(),
        "bad_dates": Counter(),
    }
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        items = []
        for i, ws in enumerate(_sheets(wb)):
            parsed = _parse_sheet(ws, overrides, report, i == 0)
            items.extend(parsed if i == 0 else _merge_new(items, parsed))
        norms = _norms(wb)
    finally:
        wb.close()
    report["norms_sheet"] = norms is not None
    report["norms"] = norms or {}
    if not items:
        raise RgsFormatError("В файле не найдено ни одной позиции")
    keys = Counter(
        (i["tm"], i["form"], i["dose"], i["pack"]) for i in items
    )
    report["rows"] = len(items)
    report["new"] = sum(i["is_new"] for i in items)
    report["duplicates"] = sum(n - 1 for n in keys.values() if n > 1)
    report["unknown_statuses"] = dict(report["unknown_statuses"])
    report["bad_dates"] = dict(report["bad_dates"])
    return RgsParse(items=items, report=report)
