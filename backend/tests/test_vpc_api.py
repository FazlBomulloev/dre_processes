from collections import Counter, defaultdict
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import load_workbook

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / (
    "vpc_export_example.xlsx"
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CHAIN = ("Согл.Цена", "Наша цена 2", "Наша цена 1", "Цена в USD")


def _example_rows() -> list[dict]:
    wb = load_workbook(EXAMPLE, read_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[0]]
    out = []
    for values in rows[1:]:
        row = dict(zip(header, values))
        row["price"] = next(
            (row[c] for c in CHAIN if row.get(c) not in (None, 0)), None,
        )
        out.append(row)
    return out


def _product_with_offers() -> tuple[tuple, list[dict]]:
    groups = defaultdict(list)
    for row in _example_rows():
        groups[(row["Дженерик"], row["Форма"], row["Доза"])].append(row)
    key, rows = max(groups.items(), key=lambda i: len(i[1]))
    return key, rows


async def _loaded(env):
    owner = await env.owner()
    with open(EXAMPLE, "rb") as f:
        response = await owner.post(
            "/api/imports/vpc",
            files={"file": (EXAMPLE.name, f.read(), XLSX)},
        )
    assert response.status_code == 200
    return owner


async def test_empty_before_upload(env):
    owner = await env.owner()
    assert (await owner.get("/api/vpc/meta")).json() == {"loaded": False}
    assert (await owner.get("/api/vpc/offers")).status_code == 404


async def test_module_permission(env):
    await env.user("ann", "analyst", markets=["AZ"])
    analyst = await env.login("ann")
    assert (await analyst.get("/api/vpc/meta")).status_code == 403


async def test_offers_and_tabs(env):
    owner = await _loaded(env)
    data = (await owner.get(
        "/api/vpc/offers?limit=200&price=auto",
    )).json()
    assert data["total"] == 240
    assert len(data["items"]) == 200
    assert data["tabs"] == {
        "all": 240, "work": 92, "contract": 39, "result": 61, "stop": 48,
    }
    prices = [i["price"] for i in data["items"]]
    assert prices == sorted(prices)
    assert data["product"] is None
    assert len(data["top_mnn"]) > 0

    stop = (await owner.get("/api/vpc/offers?tab=stop")).json()
    assert stop["total"] == 48
    assert {i["state"] for i in stop["items"]} == {"stop"}

    our1 = (await owner.get(
        "/api/vpc/offers?price=our1&priced=true",
    )).json()
    assert our1["total"] == 240
    unpriced = (await owner.get(
        "/api/vpc/offers?price=usd&priced=true",
    )).json()
    assert unpriced["total"] == 0
    everything = (await owner.get(
        "/api/vpc/offers?price=usd&priced=false",
    )).json()
    assert everything["total"] == 240


async def test_offers_active_and_responsible(env):
    owner = await _loaded(env)

    async def get(**params):
        resp = await owner.get("/api/vpc/offers", params=params)
        assert resp.status_code == 200
        return resp.json()

    active = await get(active="true", limit="200")
    assert active["total"] == 240 - 48
    assert active["tabs"]["stop"] == 0
    assert (await get(responsible="БДМ"))["total"] == 240
    assert (await get(responsible="КПГ"))["total"] == 0
    item = (await get())["items"][0]
    assert item["responsible"] == "БДМ"
    by_role = await get(sort="responsible")
    assert by_role["total"] == 240
    facets = (await owner.get("/api/vpc/facets")).json()
    assert facets["responsible"] == [{"value": "БДМ", "count": 240}]


async def test_mnn_cards(env):
    owner = await _loaded(env)
    data = (await owner.get(
        "/api/vpc/offers", params={"price": "our1", "priced": "false"},
    )).json()
    cards = data["top_mnn"]
    assert 0 < len(cards) <= 8
    offers = [c["offers"] for c in cards]
    assert offers == sorted(offers, reverse=True)
    rows = _example_rows()
    top = cards[0]
    group = [
        r for r in rows
        if r["Дженерик"].casefold() == top["generic"].casefold()
    ]
    assert top["offers"] == len(group)
    main = [
        r["Наша цена 1"] for r in group
        if r["Форма"] == top["form"] and r["Доза"] == top["dose"]
    ]
    assert top["price"]["min"] == min(main)
    assert top["price"]["max"] == max(main)
    best = [b["price"] for b in top["best"]]
    assert best == sorted(best) and best[0] == min(main)
    assert len(top["best"]) <= 3


async def test_product_hero_and_to_min(env):
    owner = await _loaded(env)
    (mnn, form, dose), rows = _product_with_offers()
    prices = [r["price"] for r in rows if r["price"]]
    params = {
        "mnn": mnn.lower(), "form": form, "dose": dose,
        "price": "auto", "priced": "true",
    }
    data = (await owner.get("/api/vpc/offers", params=params)).json()
    product = data["product"]
    assert product["offers"] == len(rows)
    assert product["price"]["min"] == min(prices)
    assert product["price"]["max"] == max(prices)
    assert product["products"] == []
    assert product["states"] == dict(Counter(
        i["state"] for i in data["items"]
    ))
    ladder = [step["price"] for step in product["ladder"]]
    assert ladder == sorted(ladder)
    first = data["items"][0]
    assert first["to_min"] == 0
    last = data["items"][-1]
    assert last["to_min"] == round((last["price"] / min(prices) - 1) * 100)

    by_mnn = (await owner.get(
        "/api/vpc/offers", params={"mnn": mnn},
    )).json()["product"]
    forms = {(r["Форма"], r["Доза"]) for r in _example_rows()
             if r["Дженерик"] == mnn}
    if len(forms) > 1:
        assert len(by_mnn["products"]) == len(forms)


async def test_mnn_hero_uses_main_product(env):
    owner = await _loaded(env)
    rows = _example_rows()
    variants: dict[str, set] = {}
    for r in rows:
        variants.setdefault(r["Дженерик"], set()).add(
            (r["Форма"], r["Доза"]),
        )
    mnn = next(m for m, v in sorted(variants.items()) if len(v) > 1)
    hero = (await owner.get(
        "/api/vpc/offers", params={"mnn": mnn, "price": "auto"},
    )).json()["product"]
    assert len(hero["products"]) == len(variants[mnn])
    main = hero["price_product"]
    prices = [
        r["price"] for r in rows
        if r["Дженерик"] == mnn and r["price"]
        and (r["Форма"], r["Доза"]) == (main["form"], main["dose"])
    ]
    assert hero["price"]["min"] == min(prices)
    assert hero["price"]["max"] == max(prices)
    assert hero["ladder"][0]["price"] == min(prices)


async def test_usd_price_column(env):
    owner = await _loaded(env)
    data = (await owner.get(
        "/api/vpc/offers",
        params={"priced": "false", "sort": "usd", "limit": 200},
    )).json()
    assert all("price_usd" in i for i in data["items"])
    usd = [i["price_usd"] for i in data["items"]]
    filled = [p for p in usd if p is not None]
    assert filled == sorted(filled)
    assert usd[:len(filled)] == filled
    expected = sorted(
        r["Цена в USD"] for r in _example_rows() if r["Цена в USD"]
    )
    assert filled == expected[:len(filled)]


async def test_pack_filter(env):
    owner = await _loaded(env)
    rows = _example_rows()
    facets = (await owner.get("/api/vpc/facets")).json()
    packs = Counter(str(r["Упаковка"]) for r in rows)
    assert {o["value"]: o["count"] for o in facets["pack"]} == packs
    pack, count = packs.most_common(1)[0]
    data = (await owner.get(
        "/api/vpc/offers", params={"pack": pack, "priced": "false"},
    )).json()
    assert data["total"] == count


async def test_facets_depend_on_filters(env):
    owner = await _loaded(env)
    (mnn, _, _), _ = _product_with_offers()
    facets = (await owner.get(
        "/api/vpc/facets", params={"mnn": mnn},
    )).json()
    forms = {r["Форма"] for r in _example_rows() if r["Дженерик"] == mnn}
    assert {o["value"] for o in facets["form"]} == forms
    assert len(facets["mnn"]) > 1
    statuses = [o["value"] for o in facets["status"]]
    assert statuses


async def test_search_and_suggest(env):
    owner = await _loaded(env)
    hits = (await owner.get("/api/vpc/offers", params={"q": "CTD"})).json()
    expected = sum(
        1 for r in _example_rows()
        if "ctd" in (r["Комментарии"] or "").lower()
    )
    assert hits["total"] == expected > 0
    (mnn, _, _), _ = _product_with_offers()
    suggest = (await owner.get(
        "/api/vpc/suggest", params={"q": mnn[:3].lower()},
    )).json()
    count = sum(1 for r in _example_rows() if r["Дженерик"] == mnn)
    assert {"kind": "mnn", "value": mnn, "count": count} in suggest


async def test_market_scope(env):
    await _loaded(env)
    await env.user(
        "ann", "analyst", markets=["AZ"], grants=["module:vpc"],
    )
    analyst = await env.login("ann")
    data = (await analyst.get("/api/vpc/offers?limit=200")).json()
    assert data["total"] == 91
    assert {i["target_country"] for i in data["items"]} == {"AZ"}
    meta = (await analyst.get("/api/vpc/meta")).json()
    assert meta["rows"] == 91

    owner = await env.owner()
    foreign = (await owner.get(
        "/api/vpc/offers", params={"target": "KZ"},
    )).json()["items"][0]
    response = await analyst.get(f"/api/vpc/offers/{foreign['id']}")
    assert response.status_code == 404


async def test_offer_card(env):
    owner = await _loaded(env)
    (mnn, form, dose), rows = _product_with_offers()
    params = {
        "mnn": mnn, "form": form, "dose": dose,
        "price": "auto", "priced": "true",
    }
    items = (await owner.get("/api/vpc/offers", params=params)).json()[
        "items"
    ]
    second = items[1]
    card = (await owner.get(
        f"/api/vpc/offers/{second['id']}", params=params,
    )).json()
    assert card["rank"]["place"] == 2
    assert card["rank"]["of"] == len(items)
    assert card["rank"]["min"] == items[0]["price"]
    assert len(card["timeline"]) == 8
    assert any(step["current"] for step in card["timeline"]) or (
        card["state"] == "unknown"
    )
    source = next(r for r in rows if str(r["Номер"]) == card["offer_no"])
    if source["Комментарии"]:
        parts = source["Комментарии"].split(" / ")
        assert card["comments"][0] == parts[-1]
    labels = {c["label"] for c in card["conditions"]}
    assert "Прогноз 1 / 2 / 3 год, уп." in labels
    assert (await owner.get("/api/vpc/offers/999999")).status_code == 404


@pytest.mark.parametrize("role, grants, code", [
    ("viewer", ["module:vpc"], 403),
    ("analyst", ["module:vpc"], 200),
])
async def test_export(env, role, grants, code):
    owner = await _loaded(env)
    await env.user("ann", role, markets=["AZ"], grants=grants)
    client = await env.login("ann")
    response = await client.get("/api/vpc/offers.xlsx?tab=work")
    assert response.status_code == code
    if code != 200:
        return
    sheet = load_workbook(BytesIO(response.content)).active
    expected = (await client.get("/api/vpc/offers?tab=work")).json()
    assert sheet.max_row == expected["total"] + 1
    assert sheet.cell(1, 2).value == "МНН"
    audit = (await owner.get("/api/audit?action=vpc_export")).json()
    assert audit["items"][0]["details"]["rows"] == expected["total"]


async def test_own_rows_only(env):
    await _loaded(env)
    expected = sum(
        1 for r in _example_rows()
        if r["Страна поиска"] == "AZ"
        and "Anna Petrova" in (r["БДМ"], r["Аналитик"])
    )
    await env.user(
        "anna", "analyst", markets=["AZ"], grants=["module:vpc"],
        names="anna petrova; Someone Else",
    )
    anna = await env.login("anna")
    session = (await anna.get("/api/auth/session")).json()
    assert session["user"]["own_only"] is True
    data = (await anna.get("/api/vpc/offers?limit=1")).json()
    assert data["total"] == expected
    assert (await anna.get("/api/vpc/meta")).json()["rows"] == expected

    await env.user(
        "nobody", "analyst", markets=["AZ"], grants=["module:vpc"],
        names="",
    )
    nobody = await env.login("nobody")
    empty = (await nobody.get("/api/vpc/offers")).json()
    assert empty["total"] == 0
