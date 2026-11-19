from collections import Counter

from backend.services.vpc.insights import stop_reason
from backend.tests.test_vpc_api import _example_rows, _loaded


def _makers() -> Counter:
    return Counter(r["Проиводитель"].casefold() for r in _example_rows())


async def test_factories(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/vpc/factories?limit=2000")).json()
    makers = _makers()
    assert data["total"] == len(makers)
    assert data["kpi"]["makers"] == len(makers)
    assert sum(m["offers"] for m in data["rating"]) == 240
    top = data["rating"][0]
    assert top["offers"] == max(makers.values())
    assert sum(top["states"].values()) == top["offers"]
    by_price = (await owner.get(
        "/api/vpc/factories?sort=price&limit=2000",
    )).json()["rating"]
    indexes = [m["index"] for m in by_price if m["index"] is not None]
    assert indexes == sorted(indexes)
    recent = (await owner.get("/api/vpc/factories?period=3")).json()
    assert recent["kpi"]["makers"] <= data["kpi"]["makers"]


async def test_factory_profile(env):
    owner = await _loaded(env)
    name, count = _makers().most_common(1)[0]
    profile = (await owner.get(
        "/api/vpc/factory", params={"maker": name.upper()},
    )).json()
    assert profile["offers"] == count
    assert sum(s["count"] for s in profile["stages"]) == count
    assert len(profile["products"]) == count
    dates = [e["date"] for e in profile["events"]]
    assert dates == sorted(dates, reverse=True)
    for p in profile["products"]:
        if p["price"] is not None and p["low"] is not None:
            assert p["low"] <= p["price"] <= p["high"]
    missing = await owner.get("/api/vpc/factory", params={"maker": "нет"})
    assert missing.status_code == 404


async def test_countries(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/vpc/countries")).json()
    targets = Counter(r["Страна поиска"] for r in _example_rows())
    assert {t["code"]: t["offers"] for t in data["tiles"]} == dict(targets)
    assert [s["code"] for s in data["stages"]][0] == "Вб"
    makers = (await owner.get("/api/vpc/countries?mode=maker")).json()
    assert sum(t["offers"] for t in makers["tiles"]) == 240

    detail = (await owner.get(
        "/api/vpc/country", params={"code": "az"},
    )).json()
    assert detail["code"] == "AZ"
    assert detail["name"] == "Азербайджан"
    assert detail["offers"] == targets["AZ"]
    assert sum(s["count"] for s in detail["stages"]) == targets["AZ"]
    assert "stuck" not in detail


async def test_funnel(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/vpc/funnel?period=all")).json()
    assert data["entered"] == 240
    reached = [s["reached"] for s in data["steps"]]
    assert reached[0] == 240
    assert reached == sorted(reached, reverse=True)
    assert data["contracts"] == reached[4]
    stops = sum(
        1 for r in _example_rows() if str(r["Статус Пд"]).startswith("S")
    )
    assert data["reasons"]["total"] == stops
    assert len(data["months"]) == 12
    year = (await owner.get("/api/vpc/funnel?period=3")).json()
    assert year["entered"] < 240
    az = (await owner.get("/api/vpc/funnel?period=all&target=AZ")).json()
    assert az["entered"] == 91


async def test_stage_filter(env):
    owner = await _loaded(env)
    stage = (await owner.get(
        "/api/vpc/summary?priced=false&stage=АЦ",
    )).json()
    assert "norm" not in stage and "stuck" not in stage
    rows = (await owner.get(
        "/api/vpc/offers?priced=false&stage=АЦ&limit=200",
    )).json()
    assert {i["status_code"] for i in rows["items"]} == {"АЦ"}


async def test_insights_scope(env):
    await _loaded(env)
    await env.user(
        "ann", "analyst", markets=["AZ"], grants=["module:vpc"],
    )
    analyst = await env.login("ann")
    tiles = (await analyst.get("/api/vpc/countries")).json()["tiles"]
    assert [t["code"] for t in tiles] == ["AZ"]
    kz = await analyst.get("/api/vpc/country", params={"code": "KZ"})
    assert kz.status_code == 404


def test_stop_reason():
    assert stop_reason("стоп, цена выше референтной")[0] == "price"
    assert stop_reason("Завод не отвечает 3 месяца")[0] == "silent"
    assert stop_reason("нужен МОК 10 000 уп.")[0] == "moq"
    assert stop_reason("нет досье CTD")[0] == "dossier"
    assert stop_reason(None)[0] == "none"
    assert stop_reason("прочее")[0] == "other"


async def test_market_module_sees_own_market(env):
    await _loaded(env)
    await env.user(
        "mark", "viewer", markets=["AZ"], grants=["module:vpc_market"],
    )
    viewer = await env.login("mark")
    detail = await viewer.get("/api/vpc/country", params={"code": "AZ"})
    assert detail.status_code == 200
    assert detail.json()["offers"] == 91
    kz = await viewer.get("/api/vpc/country", params={"code": "KZ"})
    assert kz.status_code == 404


async def test_factories_for_market(env):
    owner = await _loaded(env)
    rows = [r for r in _example_rows() if r["Страна поиска"] == "AZ"]
    makers = Counter(r["Проиводитель"].casefold() for r in rows)
    data = (await owner.get(
        "/api/vpc/factories", params={"target": "az", "limit": 2000},
    )).json()
    assert data["total"] == len(makers)
    assert sum(m["offers"] for m in data["rating"]) == len(rows)
    name, count = makers.most_common(1)[0]
    profile = (await owner.get(
        "/api/vpc/factory", params={"maker": name, "target": "AZ"},
    )).json()
    assert profile["offers"] == count


async def test_countries_for_market(env):
    owner = await _loaded(env)
    rows = [r for r in _example_rows() if r["Страна поиска"] == "AZ"]
    data = (await owner.get(
        "/api/vpc/countries", params={"mode": "maker", "target": "AZ"},
    )).json()
    assert sum(t["offers"] for t in data["tiles"]) == len(rows)
    country = rows[0]["Страна Пр*"]
    detail = (await owner.get("/api/vpc/country", params={
        "code": country, "mode": "maker", "target": "AZ",
    })).json()
    assert detail["offers"] == sum(
        r["Страна Пр*"] == country for r in rows
    )


async def test_overview(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/vpc/overview")).json()
    rows = _example_rows()
    kpi = data["kpi"]
    assert kpi["offers"] == 240
    assert kpi["makers"] == len(_makers())
    assert kpi["mnn"] == len({r["Дженерик"].casefold() for r in rows})
    assert sum(data["states"].values()) == 240
    assert sum(s["count"] for s in data["stages"]) == 240
    mnn = Counter(r["Дженерик"].casefold() for r in rows)
    assert data["mnn"][0]["offers"] == max(mnn.values())
    assert data["makers"][0]["offers"] == max(_makers().values())
    targets = Counter(r["Страна поиска"] for r in rows)
    assert {t["code"]: t["offers"] for t in data["targets"]} == dict(
        targets.most_common(len(data["targets"])),
    )
    assert len(data["months"]) == 12

    az = (await owner.get("/api/vpc/overview?target=AZ")).json()
    assert az["kpi"]["offers"] == targets["AZ"]
    assert az["targets"] == []


async def test_overview_insights(env):
    owner = await _loaded(env)
    data = (await owner.get("/api/vpc/overview")).json()
    assert "previous" not in data
    kinds = {i["kind"] for i in data["insights"]}
    assert {"bottleneck", "market", "stop"} <= kinds
    stages = {s["code"]: s for s in data["stages"]}
    assert sum(s["count"] for s in stages.values()) == 240
    assert all("stuck" not in s for s in stages.values())
    steps = data["funnel"]["steps"]
    assert steps[0]["reached"] == 240 and steps[0]["lost"] is None
    worst = data["funnel"]["worst"]
    assert worst["lost"] == max(s["lost"] or 0 for s in steps)


async def test_overview_filters(env):
    owner = await _loaded(env)
    rows = _example_rows()
    data = (await owner.get("/api/vpc/overview")).json()
    filters = data["filters"]
    assert filters["responsible"] == [{"value": "БДМ", "count": 240}]
    assert filters["klass"] == [{"value": "ЛС", "count": 240}]
    years = Counter(r["Дата Создания"].year for r in rows)
    assert filters["years"] == sorted(years, reverse=True)

    async def offers(**params):
        resp = await owner.get("/api/vpc/overview", params=params)
        assert resp.status_code == 200
        return resp.json()["kpi"]["offers"]

    assert await offers(responsible="бдм") == 240
    assert await offers(responsible="КПГ") == 0
    assert await offers(klass="ЛС") == 240
    assert await offers(klass="БАД") == 0
    year = max(years)
    assert await offers(period=str(year)) == years[year]
    assert await offers(period="3") <= 240
    bad = await owner.get("/api/vpc/overview", params={"period": "5"})
    assert bad.status_code == 422


async def test_country_links(env):
    owner = await _loaded(env)
    rows = [r for r in _example_rows() if r["Страна поиска"] == "AZ"]
    detail = (await owner.get(
        "/api/vpc/country", params={"code": "AZ"},
    )).json()
    origin = Counter(r["Страна Пр*"] for r in rows)
    assert detail["links_total"] == len(origin)
    assert {x["code"]: x["offers"] for x in detail["links"]} == dict(origin)
    top = detail["links"][0]
    assert top["offers"] == max(origin.values())
    assert sum(top["states"].values()) == top["offers"]
    assert len(top["mnn"]) <= 5
    assert sum(m["offers"] for m in top["mnn"]) <= top["offers"]

    mnn = Counter(r["Дженерик"].casefold() for r in rows)
    assert detail["molecules_total"] == len(mnn)
    assert sum(m["offers"] for m in detail["molecules"]) == len(rows)
    first = detail["molecules"][0]
    assert first["offers"] == max(mnn.values())
    assert sum(c["offers"] for c in first["links"]) <= first["offers"]
    assert detail["average"] is not None

    stops = detail["stops"]
    assert sum(r["count"] for r in stops["reasons"]) == stops["total"]
    assert stops["total"] == detail["states"].get("stop", 0)


async def test_country_links_maker(env):
    owner = await _loaded(env)
    country = _example_rows()[0]["Страна Пр*"]
    rows = [r for r in _example_rows() if r["Страна Пр*"] == country]
    detail = (await owner.get("/api/vpc/country", params={
        "code": country, "mode": "maker",
    })).json()
    targets = Counter(r["Страна поиска"] for r in rows)
    assert {x["code"]: x["offers"] for x in detail["links"]} == dict(
        targets,
    )
    assert detail["links"][0]["name"] != ""
