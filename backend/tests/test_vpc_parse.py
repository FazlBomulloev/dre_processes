from datetime import date, datetime
from pathlib import Path

import pytest
from openpyxl import Workbook

from backend import config
from backend.services.vpc.reader import VpcFormatError, read_vpc
from backend.services.vpc.statuses import parse_status
from backend.services.vpc.values import (
    pack_number,
    split_comments,
    to_datetime,
    to_float,
)

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / (
    "vpc_export_example.xlsx"
)


@pytest.mark.parametrize("raw, code, state", [
    ("АЦ", "АЦ", "work"),
    ("AЦ", "АЦ", "work"),
    (" пц кк ", "ПцКк", "work"),
    ("ВП", "Вб", "work"),
    ("Кк", "Кк", "contract"),
    ("Р-", "Р-", "result"),
    ("P", "Р", "result"),
    ("За", "За", "result"),
    ("SАЦ", "SАЦ", "stop"),
    ("sПцР", "SПцР", "stop"),
    ("САЦ", "SАЦ", "stop"),
    ("NКк", "NКк", "contract"),
    ("nKк", "NКк", "contract"),
    ("ПцР", "ПцР", "result"),
    ("СЦ", None, "unknown"),
    ("", None, "unknown"),
    (None, None, "unknown"),
])
def test_parse_status(raw, code, state):
    status = parse_status(raw)
    assert status.code == code
    assert status.state == state


def test_kk_group_is_setting(monkeypatch):
    monkeypatch.setattr(config, "VPC_KK_GROUP", "work")
    assert parse_status("Кк").state == "work"
    monkeypatch.setattr(config, "VPC_KK_GROUP", "nonsense")
    assert parse_status("Кк").state == "contract"


def test_values():
    assert to_float("1,25") == 1.25
    assert to_float(" 3 ") == 3.0
    assert to_float("TBC") is None
    assert to_float(0) is None
    assert to_datetime("2026-10-21 00:00:00") == datetime(2026, 10, 21)
    assert to_datetime("21.10.2026") == datetime(2026, 10, 21)
    assert to_datetime(46000).year == 2025
    assert to_datetime("Not expired") is None
    assert pack_number(30) == 30
    assert pack_number(30.0) == 30
    assert pack_number("28") == 28
    assert pack_number("1 FILM / POUCH IN ALU-FOIL") is None
    assert split_comments("a / b\nc") == ["a", "b", "c"]


def test_example_loads_clean():
    result = read_vpc(EXAMPLE, EXAMPLE.name)
    report = result.report
    assert report["rows_loaded"] == 240
    assert report["missing_fields"] == []
    assert report["missing_stage_dates"] == []
    assert report["unknown_total"] == 0
    assert report["bad_dates"] == 0
    assert report["detected"] == {
        "last_comment_date": "Д", "currency": "комм.",
    }
    assert report["states"] == {
        "work": 92, "stop": 48, "result": 61, "contract": 39,
    }
    assert sum(report["targets"].values()) == 240
    assert report["with_price"] == 240

    first = result.offers[0]
    assert first["price_final"] == first["price_our2"] == 3.61
    assert first["price_src"] == "our2"
    assert first["last_comment"] == "ждём ответ завода"
    assert first["pack_n"] == 60
    assert first["currency"] == "USD"


def _book(path: Path, header: list, rows: list, offset: int = 0) -> Path:
    wb = Workbook()
    wb.active.title = "Сводка"
    wb.active.append(["не та таблица"])
    ws = wb.create_sheet("Данные")
    for _ in range(offset):
        ws.append([None])
    ws.append(header)
    for row in rows:
        ws.append(row)
    wb.save(path)
    return path


def test_messy_headers(tmp_path):
    header = [
        " Номер", "Дженерик", "Форма  ", "доза", "Упаковка",
        "ПРОИЗВОДИТЕЛЬ", "Страна поиска", "Статус  Пд", "Дата Статуса",
        "Наша цена 1", "Согл. Цена", "Комментарии", "Д", "ата", "комм.",
        "Дата Обновления",
    ]
    rows = [
        ["1", "IBUPROFEN", "TAB", "200 MG", "1 FILM / POUCH",
         "ACME", "am", "SАЦ", "2026-10-21 00:00:00",
         "2,5", None, "первый / второй",
         datetime(2026, 10, 1), 2, "EUR", datetime(2026, 10, 2)],
        ["1", "IBUPROFEN", "TAB", "200 MG", 30,
         "ACME", "AM", "ПО", "мусор", 2.0, 1.9, None, None, 0, "EUR",
         datetime(2026, 10, 5)],
        [None, None, None, None, None, None, None, None, None, None,
         None, None, None, None, None, None],
        ["2", None, "TAB", None, None, "ACME", "AM", "АЦ", None, None,
         None, None, None, None, "EUR", None],
    ]
    path = _book(tmp_path / "ВПЦ_20261101.xlsx", header, rows, offset=2)
    result = read_vpc(path, path.name)
    report = result.report
    assert result.data_date == date(2026, 11, 1)
    assert report["sheet"] == "Данные"
    assert report["header_row"] == 3
    assert report["duplicates"] == 1
    assert report["skipped_no_generic"] == 1
    assert report["rows_loaded"] == 1
    assert report["bad_dates"] == 1
    assert report["currencies"] == {"EUR": 1}
    offer = result.offers[0]
    assert offer["status_code"] == "ПО"
    assert offer["price_final"] == 1.9
    assert offer["price_src"] == "agreed"
    assert offer["target_country"] == "AM"
    assert offer["pack_n"] == 30


def test_missing_required(tmp_path):
    path = _book(
        tmp_path / "bad.xlsx", ["Дженерик", "Форма"], [["X", "TAB"]],
    )
    with pytest.raises(VpcFormatError, match="Статус Пд"):
        read_vpc(path, path.name)


def test_no_header(tmp_path):
    path = _book(tmp_path / "bad.xlsx", ["A", "B"], [[1, 2]])
    with pytest.raises(VpcFormatError, match="Дженерик"):
        read_vpc(path, path.name)
