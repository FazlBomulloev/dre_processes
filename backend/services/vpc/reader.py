import json
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from itertools import islice
from pathlib import Path

from openpyxl import load_workbook

from backend.services.vpc import headers as hd
from backend.services.vpc.statuses import parse_status
from backend.services.vpc.values import (
    clean,
    pack_number,
    split_comments,
    to_datetime,
    to_float,
)

HEADER_SCAN_ROWS = 30
SAMPLE_ROWS = 500
EXTRA_LIMIT = 500
DEFAULT_CURRENCY = "USD"

PRICE_CHAIN = (
    ("price_agreed", "agreed"),
    ("price_our2", "our2"),
    ("price_our1", "our1"),
    ("price_usd", "usd"),
)

_TEXT_FIELDS = (
    "offer_no", "generic", "form", "dose", "maker", "maker_country",
    "maker_category", "zone", "status_raw", "deadline", "bdm", "analyst",
)
_DATE_FIELDS = ("status_date", "created_at", "updated_at")
_NUMBER_FIELDS = (
    "price_usd", "price_agreed", "price_our1", "price_our2",
    "forecast_y1", "forecast_y2", "forecast_y3",
)
_FILE_DATE = re.compile(r"(20\d{2})(\d{2})(\d{2})")


class VpcFormatError(ValueError):
    pass


@dataclass
class ParseResult:
    offers: list[dict]
    report: dict
    data_date: date | None


def _cell(row: Sequence, index: int | None):
    if index is None or index >= len(row):
        return None
    return row[index]


def _locate(wb) -> tuple[str, int]:
    for ws in wb.worksheets:
        head = list(islice(
            ws.iter_rows(values_only=True), HEADER_SCAN_ROWS,
        ))
        index = hd.find_header(head)
        if index is not None:
            return ws.title, index
    raise VpcFormatError(
        "Не найдена строка шапки: ни на одном листе в первых "
        f"{HEADER_SCAN_ROWS} строках нет колонки «Дженерик»"
    )


def _read_rows(path: Path) -> tuple[str, int, list, list[tuple]]:
    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet, index = _locate(wb)
        rows = wb[sheet].iter_rows(values_only=True)
        header = next(islice(rows, index, None))
        data = [row for row in rows if any(v is not None for v in row)]
    finally:
        wb.close()
    return sheet, index + 1, list(header), data


def _file_date(file_name: str) -> date | None:
    match = _FILE_DATE.search(file_name)
    if match is None:
        return None
    try:
        return date(*(int(g) for g in match.groups()))
    except ValueError:
        return None


def _data_date(file_name: str, offers: list[dict]) -> date | None:
    from_name = _file_date(file_name)
    if from_name is not None:
        return from_name
    stamps = [
        o["updated_at"] for o in offers if o["updated_at"] is not None
    ]
    return max(stamps).date() if stamps else None


class _Builder:
    def __init__(self, headers: list, columns: dict[str, int]):
        self.headers = hd.column_names(headers)
        self.columns = columns
        self.stage_columns = hd.stage_date_columns(headers)
        used = set(columns.values()) | set(self.stage_columns.values())
        self.extra = [
            (i, name) for i, name in enumerate(self.headers)
            if i not in used
        ]
        self.counts: Counter = Counter()
        self.unknown: Counter = Counter()

    def value(self, row: Sequence, field: str):
        return _cell(row, self.columns.get(field))

    def date(self, row: Sequence, field: str):
        raw = self.value(row, field)
        parsed = to_datetime(raw)
        if parsed is None and clean(raw):
            self.counts["bad_dates"] += 1
        return parsed

    def build(self, row: Sequence) -> dict | None:
        record = {f: clean(self.value(row, f)) for f in _TEXT_FIELDS}
        if not record["generic"]:
            self.counts["skipped_no_generic"] += 1
            return None
        target = clean(self.value(row, "target_country"))
        record["target_country"] = target.upper() if target else None
        pack = self.value(row, "pack_raw")
        record["pack_raw"] = clean(pack)
        record["pack_n"] = pack_number(pack)

        status = parse_status(record["status_raw"])
        if status.code is None:
            self.unknown[record["status_raw"] or "<пусто>"] += 1
        record.update(
            status_code=status.code, stage=status.stage, state=status.state,
        )

        for field in _DATE_FIELDS:
            record[field] = self.date(row, field)
        record["last_comment_date"] = self.date(row, "last_comment_date")
        for field in _NUMBER_FIELDS:
            record[field] = to_float(self.value(row, field))
        record["price_final"], record["price_src"] = None, None
        for field, source in PRICE_CHAIN:
            if record[field] is not None:
                record["price_final"], record["price_src"] = (
                    record[field], source,
                )
                break
        currency = clean(self.value(row, "currency"))
        record["currency"] = (
            currency.upper() if currency else DEFAULT_CURRENCY
        )

        raw_comments = self.value(row, "comments")
        parts = split_comments(raw_comments)
        record["comments"] = (
            str(raw_comments).strip() if parts else None
        )
        record["last_comment"] = parts[-1] if parts else None

        stages = {}
        for stage, index in self.stage_columns.items():
            stamp = to_datetime(_cell(row, index))
            if stamp is not None:
                stages[stage] = stamp.isoformat(timespec="seconds")
        record["stage_dates_json"] = (
            json.dumps(stages, ensure_ascii=False) if stages else None
        )

        extra = {}
        for index, name in self.extra:
            text = clean(_cell(row, index))
            if text:
                extra[name] = text[:EXTRA_LIMIT]
        record["extra_json"] = (
            json.dumps(extra, ensure_ascii=False) if extra else None
        )
        return record


def _dedupe(offers: list[dict]) -> tuple[list[dict], int]:
    by_no: dict[str, int] = {}
    out: list[dict] = []
    duplicates = 0
    for offer in offers:
        number = offer["offer_no"]
        if number is None:
            out.append(offer)
            continue
        seen = by_no.get(number)
        if seen is None:
            by_no[number] = len(out)
            out.append(offer)
            continue
        duplicates += 1
        old = out[seen]
        new_stamp = offer["updated_at"]
        old_stamp = old["updated_at"]
        if new_stamp is not None and (
            old_stamp is None or new_stamp > old_stamp
        ):
            out[seen] = offer
    return out, duplicates


def read_vpc(path: Path, file_name: str) -> ParseResult:
    sheet, header_row, headers, rows = _read_rows(path)
    columns, duplicate_headers = hd.map_columns(headers)
    missing_required = [
        hd.FIELDS[f][0] for f in hd.REQUIRED if f not in columns
    ]
    if missing_required:
        raise VpcFormatError(
            "Не найдены обязательные колонки: "
            + ", ".join(missing_required)
        )
    stage_columns = hd.stage_date_columns(headers)
    taken = set(columns.values()) | set(stage_columns.values())
    detected = hd.detect_by_values(headers, rows[:SAMPLE_ROWS], taken)
    columns.update(detected)

    builder = _Builder(headers, columns)
    built = [builder.build(row) for row in rows]
    offers, duplicates = _dedupe([o for o in built if o is not None])
    if not offers:
        raise VpcFormatError("В файле нет ни одной строки с МНН")

    names = hd.column_names(headers)
    report = {
        "sheet": sheet,
        "header_row": header_row,
        "columns": len(headers),
        "rows_read": len(rows),
        "rows_loaded": len(offers),
        "skipped_no_generic": builder.counts["skipped_no_generic"],
        "duplicates": duplicates,
        "bad_dates": builder.counts["bad_dates"],
        "missing_fields": [
            label for field, (label, _) in hd.FIELDS.items()
            if field not in columns
        ],
        "missing_stage_dates": [
            stage for stage in hd.STAGE_DATE_COLUMNS.values()
            if stage not in stage_columns
        ],
        "detected": {
            field: names[index] for field, index in detected.items()
        },
        "duplicate_headers": duplicate_headers,
        "extra_columns": [name for _, name in builder.extra],
        "unknown_statuses": dict(builder.unknown.most_common(30)),
        "unknown_total": sum(builder.unknown.values()),
        "states": dict(Counter(o["state"] for o in offers)),
        "targets": dict(Counter(
            o["target_country"] or "—" for o in offers
        ).most_common()),
        "with_price": sum(1 for o in offers if o["price_final"]),
        "price_sources": dict(Counter(
            o["price_src"] for o in offers if o["price_src"]
        )),
        "currencies": dict(Counter(o["currency"] for o in offers)),
    }
    return ParseResult(offers, report, _data_date(file_name, offers))
