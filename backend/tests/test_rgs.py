from collections import Counter
from datetime import date
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

from backend import config
from backend.services.rgs import analytics as an
from backend.services.rgs.reader import read_rgs
from backend.services.rgs.status import known_status

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / (
    "rgs_tracker_example.xlsx"
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
TODAY = date(2026, 11, 26)

ABOVE = (
    None, None, None, None, None, None, None, "JS / IZ (Comments)",
    "Комментарии ИЗ и ЧС", "Комментарии БДМ",
    "1. Дата Получ Зч по почте", "ЗД", "АД", "Пл ПД", "ПД", "Пл-РУ",
    "РУ", "Premilinary Expertise", None, "Specilized Expertise", None,
)
MAIN = (
    "TM ENG", "DOSAGE", "FORM", "CATEGORY", "MFG", "ОЛ (ФИО)", "статус",
)
BELOW = (
    *([None] * 17), "Invoice receipt date", "Payment",
    "Invoice Receipt Date", "Payment",
)
SPLIT = (
    "dcz: досье готово", "dh: отправлено регистратору", "Следующий шаг",
    "Срок шага", "Код причины",
)


def d(text: str | None) -> date | None:
    return date.fromisoformat(text) if text else None


DESIGN = (
    ("NEUROCRIN", "5 MG / ML", "M", "BALKAN", "IZ", "dhp1",
     "2025-11-21", "2026-05-30", "2026-07-13", "2026-08-14", "2026-10-08"),
    ("NEUROCRIN", "15 MG / ML", "M", "BALKAN", "IZ", "dhp1",
     "2025-11-21", "2026-05-30", "2026-07-13", "2026-08-14", "2026-10-08"),
    ("LOXICAM", "8 MG / 2 ML", "M", "BALKAN", "IZ", "dhp1",
     "2026-01-07", "2026-06-20", "2026-06-30", "2026-08-04", "2026-10-08"),
    ("PANOLECT", "40 MG", "M", "BALKAN", "IZ", "dhp1",
     "2025-11-21", "2026-05-30", "2026-06-29", "2026-08-14", None),
    ("DEXAPAIN", "25 MG / ML", "M", "BALKAN", "ЧС", "dhp2",
     "2025-02-24", None, "2025-08-25", "2025-10-16", "2026-01-05"),
    ("REGIMED", "2 ML", "M", "BALKAN", "ЧС", "dhp2",
     "2025-02-24", None, "2026-06-09", "2026-07-20", "2026-09-28"),
    ("KORTIPAN", "1 ML", "M", "BALKAN", "ЧС", "dhp2",
     "2025-02-24", None, "2026-06-09", "2026-07-20", "2026-09-28"),
    ("GESTERIOL", "10 MG", "M", "RENATA", "ЧС", "dhp2",
     "2025-03-14", None, "2025-12-17", "2026-01-22", "2026-03-27"),
    ("FINOTERB", "250 MG", "M", "RENATA", "ЧС", "dhp2",
     "2025-03-14", None, "2025-12-17", "2026-01-22", "2026-06-09"),
    ("ROXIVEN", "20 MG", "M", "RENATA", "ЧС", "dhp2",
     "2025-03-14", None, "2026-01-29", "2026-03-27", "2026-07-20"),
)


def tracker(
    path: Path, rows=DESIGN, split: bool = False,
    norms: dict | None = None, extra: dict | None = None,
) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "Е"
    above, main, below = list(ABOVE), list(MAIN), list(BELOW)
    if split:
        above += SPLIT
        below += [None] * len(SPLIT)
    ws.append(above)
    ws.append(main)
    ws.append(below)
    for tm, dose, cat, mfg, owner, code, af, ai, aj, at, av in rows:
        values = [
            tm, dose, "INJ", cat, mfg, owner, code, "Комментарий JS",
            "Комментарий ИЗ", None, d(af), None, None, d(ai), d(aj),
            None, None, None, d(at), None, d(av),
        ]
        if split:
            values += [None] * len(SPLIT)
        for column, value in (extra or {}).get(tm, {}).items():
            values[column] = value
        ws.append(values)
    if norms is not None:
        sheet = wb.create_sheet("Нормативы")
        sheet.append(["Код", "Значение", "Описание"])
        for name, value in norms.items():
            sheet.append([name, value, "норма"])
    wb.save(path)
    return path


def settings(**kw) -> an.Settings:
    return an.Settings(
        today=TODAY, managers={"ЧС": "Чоми", "IZ": "Исфандиер"}, **kw,
    )


def items_of(path: Path) -> list[an.Item]:
    return [
        an.Item(id=i, **{k: v for k, v in row.items() if k != "extra_json"})
        for i, row in enumerate(read_rgs(path).items, start=1)
    ]


async def _upload(env, path: Path, market: str = "AZ"):
    owner = await env.owner()
    with open(path, "rb") as f:
        response = await owner.post(
            "/api/imports/rgs",
            params={"market": market, "data_date": "2026-11-23"},
            files={"file": (path.name, f.read(), XLSX)},
        )
    assert response.status_code == 200, response.text
    return owner


async def _loaded(env, market: str = "AZ"):
    return await _upload(env, EXAMPLE, market)


@pytest.fixture
def today(monkeypatch):
    monkeypatch.setattr(config, "RGS_TODAY", TODAY)


def test_reader():
    result = read_rgs(EXAMPLE)
    assert result.report["rows"] == 69
    assert result.report["new"] == 5
    assert result.report["missing"]["Е"] == ["ru_date"]
    assert result.report["unknown_statuses"] == {}
    assert result.report["norms_sheet"] is False


def test_statuses():
    assert known_status("dhp2") and known_status("sdca")
    assert known_status("dboc") and known_status("dbd")
    assert not known_status("zz")


def test_old_dates_are_empty(tmp_path):
    path = tracker(tmp_path / "t.xlsx", extra={
        "DEXAPAIN": {13: date(1900, 1, 5)},
    })
    result = read_rgs(path)
    row = next(i for i in result.items if i["tm"] == "DEXAPAIN")
    assert row["plan_submit"] is None
    assert result.report["bad_dates"] == {"plan_submit": 1}


def test_design_cases(tmp_path):
    items = items_of(tracker(tmp_path / "t.xlsx"))
    s = settings(split=False)
    by = {(i.tm, i.dose): an.evaluate(i, s) for i in items}
    neuro = by[("NEUROCRIN", "5 MG / ML")]
    assert neuro.status.by_date == "dhp2" and neuro.status.issue
    assert (neuro.cycle.fact, neuro.cycle.tone) == (234, "red")
    assert (neuro.delay.fact, neuro.delay.tone) == (44, "red")
    assert by[("LOXICAM", "8 MG / 2 ML")].delay.out()["tone"] == "amb"
    assert by[("LOXICAM", "8 MG / 2 ML")].delay.fact == 10
    assert neuro.spans["e4"].fact == 32 and neuro.spans["e4"].tone == "grn"
    assert neuro.spans["e5"].fact == 55 and neuro.spans["e5"].tone == "grn"
    finoterb = by[("FINOTERB", "250 MG")]
    assert (finoterb.spans["e5"].fact, finoterb.spans["e5"].tone) == (
        138, "red",
    )
    dexa = by[("DEXAPAIN", "25 MG / ML")]
    assert dexa.ru.plan == date(2026, 9, 7)
    assert (dexa.ru.days, dexa.ru.tone) == (-80, "red")
    assert neuro.ru.plan == date(2027, 6, 4)
    assert (neuro.ru.days, neuro.ru.tone) == (190, "grn")
    assert neuro.spans["e1"].tone == "na"
    assert neuro.spans["e6"].running and neuro.spans["e6"].fact == 49


def test_supplement_plan():
    item = an.Item(id=1, tm="X", category="FS", task_date=date(2026, 1, 1))
    ru = an.ru_plan(item, settings())
    assert (ru.plan, ru.days, ru.tone) == (date(2026, 11, 27), 1, "amb")


def test_design_kpis(tmp_path):
    items = items_of(tracker(tmp_path / "t.xlsx"))
    data = an.overview(items, settings(split=False), an.Scope())
    kpis = {k["key"]: (k["value"], k["tone"]) for k in data["kpis"]}
    assert kpis == {
        "k1": (0, "red"), "k2": (286, "red"), "k3": (32, "red"),
        "k4": (6, "red"), "k5": (None, "na"), "k6": (70, "red"),
    }
    assert data["kpis"][0]["base"] == "0 из 4 с планом"
    assert [f["count"] for f in data["funnel"]] == [0, 0, 1, 9, 0]
    assert [(m["name"], m["count"], m["cycle"], m["red_ru"])
            for m in data["managers"]] == [
        ("Чоми", 6, 333, 6), ("Исфандиер", 4, 216, 0),
    ]
    assert data["checks"]["count"] == 3
    assert {c["kind"] for c in data["checks"]["items"]} == {"status"}
    assert [r["days"] for r in data["ru_due"]] == [-80, -80, -80, -62,
                                                   -62, -62]
    assert data["months"]["overdue"] == 6
    t1 = next(s for s in data["stages"] if s["key"] == "t1")
    assert (t1["fact"], t1["norm"], t1["tone"]) == (286, 90, "red")


def test_status_rules():
    s = settings()
    base = {"id": 1, "tm": "X", "task_date": date(2026, 1, 1)}
    ahead = an.evaluate(an.Item(**base, status_code="dct"), s)
    assert ahead.status.issue is None
    missing = an.evaluate(an.Item(**base, status_code="dha"), s)
    assert "даты для него" in missing.status.issue
    floating = an.evaluate(an.Item(
        **base, status_code="dhp", submitted=date(2026, 3, 1),
        exp1_paid=date(2026, 4, 1),
    ), s)
    assert floating.status.issue is None and floating.group == "exp1"
    no_split = an.evaluate(
        an.Item(**base, status_code="dh"), settings(split=False),
    )
    assert no_split.status.issue is None


def test_data_checks():
    s = settings()
    item = an.Item(
        id=1, tm="X", status_code="zz", task_date=date(2026, 5, 1),
        submitted=date(2026, 4, 1), exp1_paid=date(2026, 12, 20),
        step_due=date(2026, 11, 1), next_step="Ответ на запрос",
    )
    kinds = Counter(c["kind"] for c in an.evaluate(item, s).checks)
    assert kinds == {
        "unknown": 1, "order": 1, "future": 1, "no_category": 1,
        "step": 1,
    }
    planless = an.Item(id=2, tm="Y", category="M", status_code="dc")
    assert [c["kind"] for c in an.evaluate(planless, s).checks] == [
        "no_plan",
    ]


def test_running_stage_and_delay():
    s = settings()
    item = an.Item(
        id=1, tm="X", category="M", task_date=date(2026, 1, 1),
        plan_submit=date(2026, 10, 27), submitted=date(2026, 3, 1),
        exp1_paid=None,
    )
    ev = an.evaluate(item, s)
    assert ev.spans["e4"].running and ev.spans["e4"].fact == 270
    assert ev.spans["e4"].tone == "red"
    ahead = an.evaluate(an.Item(
        id=2, tm="Y", category="M", task_date=date(2026, 1, 1),
        plan_submit=date(2027, 1, 1),
    ), s)
    assert ahead.delay.fact == 0 and ahead.delay.tone == "grn"
    late = an.evaluate(an.Item(
        id=3, tm="Z", category="M", task_date=date(2026, 1, 1),
        plan_submit=date(2026, 10, 27),
    ), s)
    assert (late.delay.fact, late.delay.tone) == (30, "amb")


def test_scope_filters(tmp_path):
    items = items_of(tracker(tmp_path / "t.xlsx"))
    s = settings(split=False)
    only = an.overview(items, s, an.Scope(tms=("NEUROCRIN",)))
    assert only["in_work"] == 2
    assert only["kpis"][1]["value"] == 234
    year = an.overview(items, s, an.Scope(year=2026))
    assert year["in_work"] == 1
    assert only["filters"]["years"] == [
        {"value": "2026", "count": 1}, {"value": "2025", "count": 9},
    ]
    assert len(only["filters"]["products"]) == 9


async def test_norms_sheet(env, tmp_path, today):
    path = tracker(tmp_path / "t.xlsx", norms={"E1": 90, "К1_цель": 80})
    owner = await _upload(env, path)
    data = (await owner.get("/api/rgs/AZ/overview")).json()
    t1 = next(s for s in data["stages"] if s["key"] == "t1")
    assert (t1["norm"], t1["red"]) == (97, 146)
    kpis = {k["key"]: k for k in data["kpis"]}
    assert kpis["k1"]["goal"] == 80
    assert (kpis["k2"]["goal"], kpis["k2"]["red"]) == (97, 146)


async def test_split_columns(env, tmp_path, today):
    path = tracker(tmp_path / "t.xlsx", split=True, extra={
        "PANOLECT": {21: date(2026, 2, 1), 22: date(2026, 2, 3)},
    })
    owner = await _upload(env, path)
    products = (await owner.get("/api/rgs/AZ/products")).json()
    pan = next(i for i in products["items"] if i["tm"] == "PANOLECT")
    card = (await owner.get(f"/api/rgs/AZ/products/{pan['id']}")).json()
    steps = {s["key"]: s for s in card["steps"]}
    assert (steps["e1"]["fact"], steps["e1"]["tone"]) == (72, "grn")
    assert steps["e23"]["fact"] == 148 and not steps["e23"]["total"]


async def test_no_split_columns(env, tmp_path, today):
    path = tracker(tmp_path / "t.xlsx")
    assert read_rgs(path).report["missing"]["Е"] == ["generic"]
    owner = await _upload(env, path)
    data = (await owner.get("/api/rgs/AZ/overview")).json()
    stages = {s["key"]: s for s in data["stages"]}
    assert stages["e1"]["tone"] == "na" and stages["e23"]["tone"] == "na"
    assert stages["t1"]["fact"] == 286
    assert data["split"] is False
    products = (await owner.get("/api/rgs/AZ/products")).json()
    neuro = products["items"][0]
    card = (await owner.get(f"/api/rgs/AZ/products/{neuro['id']}")).json()
    steps = {s["key"]: s for s in card["steps"]}
    assert steps["e23"]["total"] is True
    assert [c["label"] for c in card["comments"]] == [
        "JS / IZ (Comments)", "Комментарии ИЗ и ЧС",
    ]


async def test_api_views(env, tmp_path, today):
    owner = await _upload(env, tracker(tmp_path / "t.xlsx"))
    data = (await owner.get("/api/rgs/AZ/products")).json()
    assert data["counts"]["exp1"] == 1 and data["counts"]["exp2"] == 9
    assert data["counts"]["red_cycle"] == 10
    assert data["counts"]["check"] == 3
    assert data["counts"]["red_ru"] == 6
    assert [m["name"] for m in data["managers"]] == ["Чоми", "Исфандиер"]
    checks = (await owner.get(
        "/api/rgs/AZ/products", params={"view": "check"},
    )).json()
    assert {i["tm"] for i in checks["items"]} == {"NEUROCRIN", "LOXICAM"}
    mine = (await owner.get(
        "/api/rgs/AZ/products", params={"mgr": "Исфандиер"},
    )).json()
    assert len(mine["items"]) == 4
    meta = (await owner.get("/api/rgs/AZ/meta")).json()
    assert meta["checks"] == 3 and meta["today"] == "2026-11-26"
    rows = (await owner.get("/api/rgs/AZ/checks")).json()
    assert rows["count"] == 3 and rows["items"][0]["row"] >= 4
    picked = (await owner.get(
        "/api/rgs/AZ/overview",
        params=[("tm", "NEUROCRIN"), ("tm", "LOXICAM")],
    )).json()
    assert picked["in_work"] == 3
    overdue = (await owner.get(
        "/api/rgs/AZ/months/overdue", params={"tm": "DEXAPAIN"},
    )).json()
    assert overdue["count"] == 1
    bad = await owner.get("/api/rgs/AZ/months/2027-13")
    assert bad.status_code == 422


async def test_access(env):
    await _loaded(env)
    await env.user("az", "viewer", markets=["AZ"], grants=["module:rgs"])
    await env.user("kz", "viewer", markets=["KZ"], grants=["module:rgs"])
    az = await env.login("az")
    kz = await env.login("kz")
    assert (await az.get("/api/rgs/AZ/overview")).status_code == 200
    assert (await kz.get("/api/rgs/AZ/overview")).status_code == 404
    meta = (await kz.get("/api/rgs/KZ/meta")).json()
    assert meta["loaded"] is False
    upload = await az.post(
        "/api/imports/rgs", params={"market": "AZ"},
        files={"file": ("x.xlsx", b"x", XLSX)},
    )
    assert upload.status_code == 403


async def test_export_products(env, tmp_path, today):
    owner = await _upload(env, tracker(tmp_path / "t.xlsx"))
    response = await owner.get(
        "/api/rgs/AZ/products.xlsx", params={"view": "red_ru"},
    )
    assert response.status_code == 200
    rows = list(
        load_workbook(BytesIO(response.content), read_only=True)
        .worksheets[0].iter_rows(values_only=True)
    )
    assert rows[0][0] == "ТМ"
    assert len(rows) == 1 + 6
    assert {r[8] for r in rows[1:]} == {"Чоми"}
    audit = (await owner.get("/api/audit?action=rgs_export")).json()
    assert audit["items"][0]["details"]["rows"] == 6
    assert audit["items"][0]["market_code"] == "AZ"


async def test_own_rows_only(env):
    await _loaded(env)
    owners = Counter(i["owner"] for i in read_rgs(EXAMPLE).items)
    name, count = owners.most_common(1)[0]
    await env.user(
        "vi", "viewer", markets=["AZ"], grants=["module:rgs"], names=name,
    )
    viewer = await env.login("vi")
    data = (await viewer.get("/api/rgs/AZ/products")).json()
    assert data["counts"][""] + data["counts"]["stop"] == count
    export = await viewer.get("/api/rgs/AZ/products.xlsx")
    assert export.status_code == 403
