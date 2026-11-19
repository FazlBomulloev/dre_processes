from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from backend.services.vpc.dataset import Row
from backend.services.vpc.statuses import (
    CONTRACT,
    RESULT,
    STOP,
    WORK,
    status_name,
    status_rank,
)

PRICE_COLUMNS = {
    "auto": "price_final",
    "agreed": "price_agreed",
    "our2": "price_our2",
    "our1": "price_our1",
    "usd": "price_usd",
}

TABS: dict[str, frozenset[str] | None] = {
    "all": None,
    "work": frozenset({WORK}),
    "contract": frozenset({CONTRACT}),
    "result": frozenset({RESULT}),
    "stop": frozenset({STOP}),
}

FACETS = {
    "mnn": "generic",
    "form": "form",
    "dose": "dose",
    "pack": "pack_raw",
    "status": "status",
    "target": "target_country",
    "maker": "maker",
    "state": "state",
    "maker_country": "maker_country",
    "bdm": "bdm",
    "analyst": "analyst",
    "category": "maker_category",
    "responsible": "responsible",
}

FACET_LIMIT = 1000
LADDER_LIMIT = 40
USD = "USD"
AGGREGATE_PRICE = "usd"
CARD_BEST = 3
INACTIVE = frozenset({STOP})
MOVING = frozenset({WORK, CONTRACT})

FUNNEL = ("Вб", "ПО", "АЦ", "ПцКк", "Кк", "ПцР", "Р", "За")
FUNNEL_INDEX = {code: i for i, code in enumerate(FUNNEL)}
_DATE_STEPS = {"НПР": "ПцР", "КД": "ПцР", "Р-": "Р"}


def funnel_code(row: Row) -> str | None:
    if row.stage is None:
        return None
    return _DATE_STEPS.get(row.stage, row.stage)


def reach(row: Row) -> int:
    index = FUNNEL_INDEX.get(funnel_code(row) or "", 0)
    for stage in row.stages:
        index = max(index, FUNNEL_INDEX.get(
            _DATE_STEPS.get(stage, stage), 0,
        ))
    return index


def step_date(row: Row, code: str):
    if code == "ПцР":
        return row.stages.get("НПР") or row.stages.get("КД")
    return row.stages.get(code)


@dataclass(frozen=True)
class Filters:
    mnn: str | None = None
    form: str | None = None
    dose: str | None = None
    pack: str | None = None
    status: str | None = None
    target: str | None = None
    maker: str | None = None
    state: str | None = None
    maker_country: str | None = None
    bdm: str | None = None
    analyst: str | None = None
    category: str | None = None
    responsible: str | None = None
    q: str | None = None
    stage: str | None = None
    priced: bool = True
    price: str = "auto"
    active: bool = False

    def wanted(self) -> dict[str, str]:
        out = {}
        for name in FACETS:
            value = getattr(self, name)
            if value is not None and value.strip():
                out[name] = value.strip().casefold()
        return out


def _key(value) -> str:
    return (value or "").casefold()


def facet_value(row: Row, name: str) -> str | None:
    attr = FACETS[name]
    if attr == "status":
        return row.status_code or row.status_raw
    return getattr(row, attr)


def price_of(row: Row, column: str) -> float | None:
    return getattr(row, PRICE_COLUMNS.get(column, "price_final"))


def currency_of(row: Row, column: str) -> str | None:
    return USD if column == "usd" else row.currency


def scope(rows: list[Row], markets: Iterable[str] | None) -> list[Row]:
    if markets is None:
        return rows
    allowed = {m.upper() for m in markets}
    return [r for r in rows if (r.target_country or "") in allowed]


def apply(rows: list[Row], f: Filters, skip: str | None = None) -> list:
    wanted = {k: v for k, v in f.wanted().items() if k != skip}
    needle = (f.q or "").strip().casefold()
    out = []
    for row in rows:
        if any(_key(facet_value(row, k)) != v for k, v in wanted.items()):
            continue
        if f.priced and price_of(row, f.price) is None:
            continue
        if f.active and row.state in INACTIVE:
            continue
        if needle and needle not in row.search:
            continue
        if f.stage and (
            row.state in INACTIVE or funnel_code(row) != f.stage
        ):
            continue
        out.append(row)
    return out


def in_tab(rows: list[Row], tab: str) -> list[Row]:
    states = TABS.get(tab)
    if states is None:
        return rows
    return [r for r in rows if r.state in states]


def tab_counts(rows: list[Row]) -> dict[str, int]:
    states = Counter(r.state for r in rows)
    return {
        tab: len(rows) if allowed is None
        else sum(states[s] for s in allowed)
        for tab, allowed in TABS.items()
    }


def to_min(rows: list[Row], column: str) -> dict[int, int]:
    groups: dict[tuple, list[tuple[float, int]]] = defaultdict(list)
    for row in rows:
        price = price_of(row, column)
        if price is not None:
            key = (row.product, currency_of(row, column))
            groups[key].append((price, row.id))
    out: dict[int, int] = {}
    for offers in groups.values():
        if len(offers) < 2:
            continue
        low = min(p for p, _ in offers)
        for price, offer_id in offers:
            out[offer_id] = round((price / low - 1) * 100)
    return out


def _sort_value(row: Row, sort: str, column: str, pct: dict[int, int]):
    match sort:
        case "to_min":
            return pct.get(row.id)
        case "usd":
            return row.price_usd
        case "agreed":
            return row.price_agreed
        case "maker":
            return _key(row.maker) or None
        case "generic":
            return (_key(row.generic), _key(row.form), _key(row.dose))
        case "target":
            return row.target_country
        case "status":
            return status_rank(row.status_code)
        case "status_date":
            return row.status_date
        case "days":
            return row.days
        case "updated":
            return row.updated_at
        case "responsible":
            return _key(row.responsible) or None
        case _:
            return price_of(row, column)


def sort_rows(
    rows: list[Row], sort: str, desc: bool, column: str,
    pct: dict[int, int],
) -> list[Row]:
    keyed = [(_sort_value(r, sort, column, pct), r) for r in rows]
    filled = [k for k in keyed if k[0] is not None]
    empty = [r for v, r in keyed if v is None]
    filled.sort(key=lambda k: (k[0], k[1].id), reverse=desc)
    return [r for _, r in filled] + empty


def facets(rows: list[Row], f: Filters) -> dict[str, list[dict]]:
    out = {}
    for name in FACETS:
        counts = Counter(
            v for v in (facet_value(r, name) for r in apply(rows, f, name))
            if v
        )
        if name == "status":
            ordered = sorted(counts.items(), key=lambda i: status_rank(i[0]))
        else:
            ordered = sorted(counts.items(), key=lambda i: (-i[1], i[0]))
        out[name] = [
            {"value": v, "count": n} for v, n in ordered[:FACET_LIMIT]
        ]
    return out


def iso(value) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


def item(row: Row, column: str, pct: dict[int, int]) -> dict:
    return {
        "id": row.id,
        "offer_no": row.offer_no,
        "generic": row.generic,
        "form": row.form,
        "dose": row.dose,
        "pack_raw": row.pack_raw,
        "pack_n": row.pack_n,
        "maker": row.maker,
        "maker_country": row.maker_country,
        "maker_category": row.maker_category,
        "target_country": row.target_country,
        "price": price_of(row, column),
        "currency": currency_of(row, column),
        "price_agreed": row.price_agreed,
        "agreed_currency": row.currency,
        "price_usd": row.price_usd,
        "price_src": row.price_src if column == "auto" else column,
        "to_min": pct.get(row.id),
        "status_code": row.status_code,
        "status_raw": row.status_raw,
        "status_name": status_name(row.status_code, row.stage, row.state),
        "stage": row.stage,
        "state": row.state,
        "days": row.days,
        "bdm": row.bdm,
        "analyst": row.analyst,
        "responsible": row.responsible,
        "last_comment": row.last_comment,
        "last_comment_date": iso(row.last_comment_date),
        "status_date": iso(row.status_date),
        "updated_at": iso(row.updated_at),
    }


def _most_common(values: Iterable) -> str | None:
    counts = Counter(v for v in values if v)
    return counts.most_common(1)[0][0] if counts else None


def _price_block(priced: list[tuple[float, Row]], currency: str) -> dict:
    prices = [p for p, _ in priced]
    low_price, low = min(priced, key=lambda i: (i[0], i[1].id))
    high = max(prices)
    return {
        "currency": currency,
        "priced": len(prices),
        "min": low_price,
        "min_maker": low.maker,
        "min_country": low.maker_country,
        "min_offer_id": low.id,
        "avg": round(sum(prices) / len(prices), 4),
        "max": high,
        "max_ratio": round(high / low_price, 2) if low_price else None,
    }


def _ladder(priced: list[tuple[float, Row]]) -> list[dict]:
    best: dict[str, tuple[float, Row]] = {}
    for price, row in priced:
        key = _key(row.maker) or f"#{row.id}"
        seen = best.get(key)
        if seen is None or (price, row.id) < (seen[0], seen[1].id):
            best[key] = (price, row)
    ordered = sorted(best.values(), key=lambda i: (i[0], i[1].id))
    return [
        {
            "offer_id": row.id,
            "maker": row.maker,
            "maker_country": row.maker_country,
            "status_code": row.status_code,
            "state": row.state,
            "target_country": row.target_country,
            "price": price,
        }
        for price, row in ordered[:LADDER_LIMIT]
    ]


def _by_product(rows: list[Row]) -> dict[tuple, list[Row]]:
    out: dict[tuple, list[Row]] = defaultdict(list)
    for row in rows:
        out[row.product].append(row)
    return out


def _main(groups: Iterable[list[Row]], column: str) -> list[Row]:
    return max(
        groups,
        key=lambda g: (
            sum(1 for r in g if price_of(r, column) is not None), len(g),
        ),
    )


def _priced(
    rows: list[Row], column: str,
) -> tuple[list, str | None, bool]:
    priced_all = [
        (p, r) for r in rows if (p := price_of(r, column)) is not None
    ]
    currency = _most_common(
        currency_of(r, column) for _, r in priced_all
    )
    priced = [
        (p, r) for p, r in priced_all
        if currency_of(r, column) == currency
    ]
    mixed = len({currency_of(r, column) for _, r in priced_all}) > 1
    return priced, currency, mixed


def hero(rows: list[Row], column: str) -> dict | None:
    if not rows:
        return None
    groups = _by_product(rows)
    main = _main(groups.values(), column)
    priced, currency, mixed = _priced(main, column)
    products = []
    for group in groups.values():
        prices = [
            p for r in group
            if currency_of(r, column) == currency
            and (p := price_of(r, column)) is not None
        ]
        products.append({
            "form": _most_common(r.form for r in group),
            "dose": _most_common(r.dose for r in group),
            "offers": len(group),
            "min_price": min(prices) if prices else None,
        })
    products.sort(key=lambda p: (-p["offers"], p["form"] or "",
                                 p["dose"] or ""))
    single = len(products) == 1
    states = Counter(r.state for r in rows)
    form = _most_common(r.form for r in main)
    dose = _most_common(r.dose for r in main)
    return {
        "generic": _most_common(r.generic for r in rows),
        "form": form if single else None,
        "dose": dose if single else None,
        "offers": len(rows),
        "makers": len({_key(r.maker) for r in rows if r.maker}),
        "maker_countries": len({
            _key(r.maker_country) for r in rows if r.maker_country
        }),
        "targets": sorted({r.target_country for r in rows
                           if r.target_country}),
        "contracts": states[CONTRACT],
        "states": dict(states),
        "products": [] if single else products,
        "price": (
            _price_block(priced, currency) if priced and currency else None
        ),
        "price_product": None if single else {
            "form": form, "dose": dose, "offers": len(main),
        },
        "ladder": _ladder(priced)[:CARD_BEST],
        "mixed_currency": mixed,
    }


def _card(group: list[Row], column: str) -> dict:
    groups = _by_product(group)
    main = _main(groups.values(), column)
    priced, currency, _ = _priced(main, column)
    price = None
    if priced and currency:
        block = _price_block(priced, currency)
        price = {
            k: block[k] for k in ("currency", "priced", "min", "avg", "max")
        }
    return {
        "generic": _most_common(r.generic for r in group),
        "offers": len(group),
        "makers": len({_key(r.maker) for r in group if r.maker}),
        "products": len(groups),
        "form": _most_common(r.form for r in main),
        "dose": _most_common(r.dose for r in main),
        "price": price,
        "best": _ladder(priced)[:CARD_BEST],
    }


def mnn_cards(rows: list[Row], column: str, limit: int) -> list[dict]:
    groups: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        groups[_key(row.generic)].append(row)
    top = sorted(groups.values(), key=lambda g: -len(g))[:limit]
    return [_card(g, column) for g in top]
