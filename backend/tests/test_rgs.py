from collections import Counter
from datetime import date
from io import BytesIO
from pathlib import Path

from openpyxl import load_workbook

from backend.services.rgs.analytics import add_months
from backend.services.rgs.reader import known_status, read_rgs

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / (
    "rgs_tracker_example.xlsx"
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _loaded(env, market: str = "AZ"):
    owner = await env.owner()
    with open(EXAMPLE, "rb") as f:
        response = await owner.post(
            "/api/imports/rgs",
            params={"market": market, "data_date": "2026-11-13"},
            files={"file": (EXAMPLE.name, f.read(), XLSX)},
        )
    assert response.status_code == 200, response.text
    return owner


def test_reader():
    result = read_rgs(EXAMPLE)
    assert result.report["rows"] == 69
    assert result.report["new"] == 5
    assert result.report["missing"]["Е"] == []
    assert result.report["unknown_statuses"] == {}


def test_helpers():
    assert known_status("dhp2") and known_status("sdca")
    assert not known_status("zz")
    assert add_months(date(2026, 12, 31), 2) == date(2027, 2, 28)


async def test_overview_matches_design(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/rgs/AZ/overview")).json()
    assert data["now"] == {
        "in_work": 62, "submitted": 38, "ru_this_year": 9,
        "ru_next_year": 36, "year": 2026,
    }
    assert [(s["reached"], s["now"]) for s in data["steps"]] == [
        (62, 9), (53, 4), (49, 11), (38, 7), (31, 11), (20, 20), (0, 0),
    ]
    months = data["months"]
    assert [m["count"] for m in months["items"]] == [
        1, 8, 0, 2, 3, 0, 7, 1, 0, 0, 13, 7, 3,
    ]
    assert months["no_plan"] == 17
    assert [t["count"] for t in months["totals"]] == [9, 22, 45]
    assert data["plan"] == {
        "total": 29, "submitted": 20, "on_time": 3, "late": 17,
        "late_median": 20, "not_submitted": 9,
    }
    assert [(d["median"], d["mean"]) for d in data["durations"]] == [
        (3, 6), (48, 69), (193, 275), (14, 16),
    ]
    assert [b["days"] for b in data["blockers"]][:3] == [167, 126, 126]
    assert len(data["blockers"]) == 9
    assert data["stopped"] == 7
    drugs = (await owner.get(
        "/api/rgs/AZ/overview", params={"cat": "M"},
    )).json()
    assert drugs["now"]["in_work"] == data["categories"]["M"]


async def test_products_and_panels(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/rgs/AZ/products")).json()
    assert data["counts"] == {
        "": 62, "prep": 24, "wait": 7, "exp1": 11, "exp2": 20, "ru": 0,
        "stop": 7,
    }
    assert len(data["items"]) == 62
    dates = [i["submitted"] for i in data["items"] if i["submitted"]]
    assert dates == sorted(dates)
    stop = (await owner.get(
        "/api/rgs/AZ/products", params={"stage": "stop"},
    )).json()
    assert len(stop["items"]) == 7
    card = (await owner.get(
        f"/api/rgs/AZ/products/{data['items'][0]['id']}",
    )).json()
    assert len(card["docs"]) == 7 and len(card["timeline"]) == 8
    month = (await owner.get("/api/rgs/AZ/months/2027-09")).json()
    assert month["count"] == 13
    assert sum(g["count"] for g in month["groups"]) == 13
    stops = (await owner.get("/api/rgs/AZ/stops")).json()
    assert stops["count"] == 7
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


async def test_export_products(env):
    owner = await _loaded(env)
    response = await owner.get("/api/rgs/AZ/products.xlsx?stage=prep")
    assert response.status_code == 200
    rows = list(
        load_workbook(BytesIO(response.content), read_only=True)
        .worksheets[0].iter_rows(values_only=True)
    )
    assert rows[0][0] == "ТМ"
    assert len(rows) == 1 + 24
    assert {r[9] for r in rows[1:]} == {"Готовится"}
    audit = (await owner.get("/api/audit?action=rgs_export")).json()
    assert audit["items"][0]["details"]["rows"] == 24
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
