from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from datetime import date, timedelta

from backend import config
from backend.services.vpc import analytics as an
from backend.services.vpc.dataset import Row
from backend.services.vpc.statuses import (
    CONTRACT,
    RESULT,
    STAGE_NAMES,
    STOP,
    WORK,
)

PERIODS = {"3": 3, "6": 6, "12": 12, "all": None}
CONTRACT_STEP = an.FUNNEL_INDEX["Кк"]
REGISTERED_STEP = an.FUNNEL_INDEX["Р"]
NEW_DAYS = 90
TOP_COUNTRIES = 10
TOP_ORIGIN = 12
TOP_LIST = 7
TOP_PEOPLE = 6
TOP_NESTED = 5
TOP_DETAIL = 100
TOP_OVERVIEW = 10
BOTTLENECK_MIN = 5
BOTTLENECK_SHARE = 20
SOURCE_SHARE = 15
PROFILE_PRODUCTS = 100
PROFILE_EVENTS = 12
MONTHS = 12

STOP_REASONS = (
    ("price", "Цена / референтная цена",
     ("цен", "price", "дорог", "референт", "таргет")),
    ("silent", "Завод не отвечает",
     ("не отвеч", "нет ответа", "молч", "no response", "ждём ответ",
      "ждем ответ")),
    ("other_maker", "Выбран другой завод",
     ("другой завод", "другого завода", "другим завод", "выбрали")),
    ("moq", "МОК / объём", ("мок", "moq", "объём", "объем")),
    ("dossier", "Досье / GMP / БЭ",
     ("досье", "dossier", "gmp", "ctd", "бэ", "би ")),
    ("priority", "Смена приоритета", ("приоритет", "портфел")),
)
OTHER_REASON = ("other", "Другое")
NO_REASON = ("none", "Без комментария")


def _key(value: str | None) -> str:
    return (value or "").casefold()


def _avg(values: Iterable[float]) -> float | None:
    values = list(values)
    return round(sum(values) / len(values), 1) if values else None


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def _top(values: Iterable[str | None]) -> str | None:
    counts = Counter(v for v in values if v)
    return counts.most_common(1)[0][0] if counts else None


def entry_date(row: Row) -> date | None:
    if row.created_at is not None:
        return row.created_at.date()
    first = row.stages.get("Вб")
    if first is not None:
        return first
    return row.status_date.date() if row.status_date else None


def in_period(rows: list[Row], period: str, today: date) -> list[Row]:
    months = PERIODS.get(period)
    if months is None:
        return rows
    since = today - timedelta(days=round(months * 30.44))
    return [r for r in rows if (d := entry_date(r)) and d > since]


def in_year(rows: list[Row], year: int) -> list[Row]:
    return [r for r in rows if (d := entry_date(r)) and d.year == year]


def by_period(rows: list[Row], period: str, today: date) -> list[Row]:
    if period.isdigit() and len(period) == 4:
        return in_year(rows, int(period))
    return in_period(rows, period, today)


def period_end(period: str, today: date) -> date:
    if period.isdigit() and len(period) == 4:
        return min(today, date(int(period), 12, 31))
    return today


def _options(values: Iterable[str | None]) -> list[dict]:
    counts = Counter(v for v in values if v)
    return [
        {"value": v, "count": n}
        for v, n in sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    ]


def overview_filters(rows: list[Row]) -> dict:
    years = {d.year for r in rows if (d := entry_date(r))}
    return {
        "responsible": _options(r.responsible for r in rows),
        "klass": _options(r.klass for r in rows),
        "years": sorted(years, reverse=True),
    }


def to_contract(row: Row) -> int | None:
    signed = row.stages.get("Кк")
    start = entry_date(row)
    if signed is None or start is None or signed < start:
        return None
    return (signed - start).days


def _contracted(row: Row) -> bool:
    return an.reach(row) >= CONTRACT_STEP


def price_index(rows: list[Row]) -> dict[str, float]:
    pct = an.to_min(rows, an.AGGREGATE_PRICE)
    groups: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        if row.id in pct and row.maker:
            groups[_key(row.maker)].append(pct[row.id])
    return {k: round(sum(v) / len(v), 1) for k, v in groups.items()}


def _group(
    rows: list[Row], key: Callable[[Row], str | None],
) -> dict[str, list[Row]]:
    out: dict[str, list[Row]] = defaultdict(list)
    for row in rows:
        value = key(row)
        if value:
            out[value].append(row)
    return out


def _states(rows: list[Row]) -> dict[str, int]:
    return dict(Counter(r.state for r in rows))


def factories(
    rows: list[Row], today: date, sort: str, limit: int,
) -> dict:
    index = price_index(rows)
    makers = _group(rows, lambda r: _key(r.maker) or None)
    rating = []
    for key, group in makers.items():
        rating.append({
            "maker": _top(r.maker for r in group),
            "country": _top(r.maker_country for r in group),
            "category": _top(r.maker_category for r in group),
            "offers": len(group),
            "mnn": len({_key(r.generic) for r in group}),
            "targets": sorted({
                r.target_country for r in group if r.target_country
            }),
            "states": _states(group),
            "index": index.get(key),
            "contracts": sum(1 for r in group if _contracted(r)),
        })
    orders = {
        "offers": lambda m: (-m["offers"], m["maker"]),
        "price": lambda m: (
            m["index"] is None, m["index"] or 0, -m["offers"],
        ),
        "contracts": lambda m: (-m["contracts"], -m["offers"]),
    }
    rating.sort(key=orders.get(sort, orders["offers"]))

    since = today - timedelta(days=NEW_DAYS)
    first_seen = {
        key: min((d for r in group if (d := entry_date(r))), default=None)
        for key, group in makers.items()
    }
    active = sum(
        1 for group in makers.values()
        if any(r.state == WORK for r in group)
    )
    signed = sum(
        1 for group in makers.values() if any(_contracted(r) for r in group)
    )
    total = len(makers)
    kpi = {
        "makers": total,
        "maker_countries": len({
            _key(r.maker_country) for r in rows if r.maker_country
        }),
        "new": sum(1 for d in first_seen.values() if d and d > since),
        "new_days": NEW_DAYS,
        "active": active,
        "active_pct": _pct(active, total),
        "contract_makers": signed,
        "contract_pct": _pct(signed, total),
        "avg_to_contract": _avg(
            d for r in rows if (d := to_contract(r)) is not None
        ),
    }
    return {
        "kpi": kpi,
        "total": total,
        "rating": rating[:limit],
        "by_country": _country_prices(rows),
    }


def _country_prices(rows: list[Row]) -> list:
    pct = an.to_min(rows, "auto")
    groups = _group(rows, lambda r: r.maker_country)
    out = []
    for country, group in groups.items():
        values = [pct[r.id] for r in group if r.id in pct]
        if values:
            out.append({
                "country": country,
                "offers": len(group),
                "index": _avg(values),
            })
    out.sort(key=lambda c: -c["offers"])
    out = out[:TOP_COUNTRIES]
    out.sort(key=lambda c: c["index"])
    return out


def _stage_counts(rows: list[Row]) -> list[dict]:
    counts = Counter(
        an.funnel_code(r) for r in rows if r.state not in an.INACTIVE
    )
    out = [
        {"code": code, "name": STAGE_NAMES[code], "count": counts[code]}
        for code in an.FUNNEL if counts[code]
    ]
    stopped = sum(1 for r in rows if r.state in an.INACTIVE)
    if stopped:
        out.append({"code": "stop", "name": "Остановлено",
                    "count": stopped})
    return out


def _event(row: Row) -> dict | None:
    moves = [(d, code) for code, d in row.stages.items()]
    if row.status_date is not None:
        moves.append((row.status_date.date(), row.status_code))
    moved = max(moves, key=lambda m: m[0], default=None)
    commented = (
        row.last_comment_date.date() if row.last_comment_date else None
    )
    if moved is None and commented is None:
        return None
    product = row.generic
    if moved is not None and (commented is None or moved[0] >= commented):
        title = f"{product} → {row.status_code or row.status_raw or '—'}"
        stamp = moved[0]
    else:
        title = f"{product} · комментарий"
        stamp = commented
    return {
        "offer_id": row.id,
        "date": stamp.isoformat(),
        "title": title,
        "text": row.last_comment,
        "state": row.state,
    }


def factory_profile(rows: list[Row], maker: str) -> dict | None:
    key = _key(maker)
    own = [r for r in rows if _key(r.maker) == key]
    if not own:
        return None
    pct = an.to_min(rows, an.AGGREGATE_PRICE)
    bands: dict[tuple, list[tuple[float, str]]] = defaultdict(list)
    for row in rows:
        if row.price_usd is not None:
            bands[row.product].append(
                (row.price_usd, _key(row.maker)),
            )
    products = []
    ordered = sorted(
        own,
        key=lambda r: (
            r.state in an.INACTIVE, r.price_usd is None,
            -(r.updated_at.timestamp() if r.updated_at else 0),
        ),
    )
    for row in ordered[:PROFILE_PRODUCTS]:
        band = bands.get(row.product, [])
        prices = [p for p, _ in band]
        products.append({
            "id": row.id,
            "generic": row.generic,
            "form": row.form,
            "dose": row.dose,
            "pack_n": row.pack_n,
            "target_country": row.target_country,
            "price": row.price_usd,
            "currency": an.USD,
            "price_agreed": row.price_agreed,
            "agreed_currency": row.currency,
            "low": min(prices) if prices else None,
            "high": max(prices) if prices else None,
            "makers": len({m for _, m in band}),
            "to_min": pct.get(row.id),
            "status_code": row.status_code,
            "status_raw": row.status_raw,
            "state": row.state,
        })
    events = [e for r in own if (e := _event(r))]
    events.sort(key=lambda e: e["date"], reverse=True)
    starts = [d for r in own if (d := entry_date(r))]
    moves = [r.updated_at.date() for r in own if r.updated_at]
    signed = sum(1 for r in own if _contracted(r))
    return {
        "maker": _top(r.maker for r in own),
        "country": _top(r.maker_country for r in own),
        "category": _top(r.maker_category for r in own),
        "bdm": _top(r.bdm for r in own),
        "first_date": min(starts).isoformat() if starts else None,
        "last_date": max(moves).isoformat() if moves else None,
        "offers": len(own),
        "mnn": len({_key(r.generic) for r in own}),
        "index": price_index(rows).get(key),
        "contracts": signed,
        "contract_pct": _pct(signed, len(own)),
        "avg_days": _avg(
            r.days for r in own if r.state == WORK and r.days is not None
        ),
        "states": _states(own),
        "stages": _stage_counts(own),
        "products": products,
        "events": events[:PROFILE_EVENTS],
    }


def _country_key(mode: str) -> Callable[[Row], str | None]:
    if mode == "maker":
        return lambda r: r.maker_country
    return lambda r: r.target_country


def country_name(code: str, mode: str) -> str:
    if mode == "maker":
        return code
    return config.COUNTRY_NAMES.get(code.upper(), code)


def _country_totals(group: list[Row]) -> dict:
    signed = sum(1 for r in group if _contracted(r))
    return {
        "offers": len(group),
        "products": len({r.product for r in group}),
        "states": _states(group),
        "contracts": signed,
        "conversion": _pct(signed, len(group)),
    }


def countries(rows: list[Row], mode: str) -> dict:
    groups = _group(rows, _country_key(mode))
    tiles = []
    heat = []
    for code, group in sorted(groups.items(), key=lambda g: -len(g[1])):
        totals = _country_totals(group)
        tiles.append({
            "code": code, "name": country_name(code, mode), **totals,
        })
        counts = Counter(
            an.funnel_code(r) for r in group if r.state not in an.INACTIVE
        )
        heat.append({
            "code": code,
            "name": country_name(code, mode),
            "counts": {s: counts[s] for s in an.FUNNEL},
            "conversion": totals["conversion"],
        })
    index = price_index(rows)
    origin = []
    for country, group in _group(rows, lambda r: r.maker_country).items():
        pct = [
            index[_key(r.maker)] for r in group if _key(r.maker) in index
        ]
        origin.append({
            "country": country,
            "offers": len(group),
            "index": _avg(pct),
            "contracts": sum(1 for r in group if _contracted(r)),
        })
    origin.sort(key=lambda o: -o["offers"])
    return {
        "mode": mode,
        "tiles": tiles,
        "stages": [
            {"code": s, "name": STAGE_NAMES[s]} for s in an.FUNNEL
        ],
        "heat": heat,
        "origin": origin[:TOP_ORIGIN],
    }


def _other_key(mode: str) -> Callable[[Row], str | None]:
    return _country_key("target" if mode == "maker" else "maker")


def _brief(group: list[Row], total: int) -> dict:
    signed = sum(1 for r in group if _contracted(r))
    return {
        "offers": len(group),
        "share": _pct(len(group), total),
        "states": _states(group),
        "contracts": signed,
        "conversion": _pct(signed, len(group)),
    }


def _ranked(
    rows: list[Row], key: Callable[[Row], str | None], limit: int,
) -> list[tuple[str, list[Row]]]:
    groups = _group(rows, key)
    ordered = sorted(groups.items(), key=lambda g: (-len(g[1]), g[0]))
    return ordered[:limit]


def _mnn_key(row: Row) -> str | None:
    return _key(row.generic) or None


def _maker_key(row: Row) -> str | None:
    return _key(row.maker) or None


def _nested_countries(rows: list[Row], mode: str) -> list[dict]:
    other = "target" if mode == "maker" else "maker"
    return [
        {"code": code, "name": country_name(code, other),
         **_brief(group, len(rows))}
        for code, group in _ranked(rows, _other_key(mode), TOP_NESTED)
    ]


def _nested_mnn(rows: list[Row]) -> list[dict]:
    return [
        {"name": _top(r.generic for r in group),
         **_brief(group, len(rows))}
        for _, group in _ranked(rows, _mnn_key, TOP_NESTED)
    ]


def _nested_makers(rows: list[Row]) -> list[dict]:
    return [
        {"maker": _top(r.maker for r in group),
         "country": _top(r.maker_country for r in group),
         **_brief(group, len(rows))}
        for _, group in _ranked(rows, _maker_key, TOP_NESTED)
    ]


def _index(group: list[Row], pct: dict[int, int]) -> float | None:
    return _avg(pct[r.id] for r in group if r.id in pct)


def _links(own: list[Row], mode: str, pct: dict[int, int]) -> list[dict]:
    other = "target" if mode == "maker" else "maker"
    out = []
    for code, group in _ranked(own, _other_key(mode), TOP_DETAIL):
        out.append({
            "code": code,
            "name": country_name(code, other),
            **_brief(group, len(own)),
            "index": _index(group, pct),
            "mnn": _nested_mnn(group),
            "makers": _nested_makers(group),
        })
    return out


def _best(group: list[Row], pct: dict[int, int]) -> dict | None:
    priced = [r for r in group if r.id in pct]
    if not priced:
        return None
    row = min(priced, key=lambda r: pct[r.id])
    return {"maker": row.maker, "country": row.maker_country}


def _molecules(
    own: list[Row], mode: str, pct: dict[int, int],
) -> list[dict]:
    pick = _other_key(mode)
    out = []
    for _, group in _ranked(own, _mnn_key, TOP_DETAIL):
        out.append({
            "name": _top(r.generic for r in group),
            **_brief(group, len(own)),
            "countries": len({pick(r) for r in group if pick(r)}),
            "makers_count": len({_key(r.maker) for r in group if r.maker}),
            "index": _index(group, pct),
            "best": _best(group, pct),
            "links": _nested_countries(group, mode),
            "makers": _nested_makers(group),
        })
    return out


def _stops(own: list[Row], mode: str) -> dict:
    stopped = [r for r in own if r.state == STOP]
    groups: dict[tuple[str, str], list[Row]] = defaultdict(list)
    for row in stopped:
        groups[stop_reason(row.last_comment)].append(row)
    reasons = [
        {"key": key, "label": label, "count": len(group),
         "share": _pct(len(group), len(stopped)),
         "mnn": _nested_mnn(group),
         "links": _nested_countries(group, mode)}
        for (key, label), group in sorted(
            groups.items(), key=lambda g: (-len(g[1]), g[0][0]),
        )
    ]
    return {"total": len(stopped), "reasons": reasons}


def country_detail(rows: list[Row], code: str, mode: str) -> dict | None:
    pick = _country_key(mode)
    own = [r for r in rows if _key(pick(r)) == _key(code)]
    if not own:
        return None
    index = price_index(rows)
    makers = []
    for key, group in _group(own, lambda r: _key(r.maker) or None).items():
        makers.append({
            "maker": _top(r.maker for r in group),
            "country": _top(r.maker_country for r in group),
            "offers": len(group),
            "index": index.get(key),
        })
    makers.sort(key=lambda m: (-m["offers"], m["maker"]))
    people = []
    for role, attr in (("БДМ", "bdm"), ("Аналитик", "analyst")):
        for name, group in _group(own, lambda r: getattr(r, attr)).items():
            people.append({
                "name": name,
                "role": role,
                "work": sum(1 for r in group if r.state == WORK),
                "contracts": sum(1 for r in group if _contracted(r)),
            })
    people.sort(key=lambda p: (-p["work"], p["name"]))
    value = pick(own[0]) or code
    pct = an.to_min(rows, "auto")
    signed = sum(1 for r in rows if _contracted(r))
    return {
        "code": value,
        "name": country_name(value, mode),
        "mode": mode,
        **_country_totals(own),
        "stages": _stage_counts(own),
        "makers": makers[:TOP_LIST],
        "people": people[:TOP_PEOPLE],
        "average": _pct(signed, len(rows)),
        "links": _links(own, mode, pct),
        "links_total": len(_group(own, _other_key(mode))),
        "molecules": _molecules(own, mode, pct),
        "molecules_total": len(_group(own, _mnn_key)),
        "stops": _stops(own, mode),
    }


def stop_reason(comment: str | None) -> tuple[str, str]:
    text = _key(comment)
    if not text:
        return NO_REASON
    for key, label, words in STOP_REASONS:
        if any(w in text for w in words):
            return key, label
    return OTHER_REASON


def _month(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _months(today: date) -> list[str]:
    out = []
    year, month = today.year, today.month
    for _ in range(MONTHS):
        out.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return out[::-1]


def funnel(rows: list[Row], period: str, today: date) -> dict:
    entered = in_period(rows, period, today)
    reached = Counter(an.reach(r) for r in entered)
    at_least = []
    running = 0
    for i in reversed(range(len(an.FUNNEL))):
        running += reached[i]
        at_least.append(running)
    at_least.reverse()

    steps = []
    for i, code in enumerate(an.FUNNEL):
        here = [
            r for r in entered
            if r.state in (WORK, CONTRACT, RESULT)
            and an.funnel_code(r) == code
        ]
        steps.append({
            "code": code,
            "name": STAGE_NAMES[code],
            "reached": at_least[i],
            "conversion": _pct(at_least[i], at_least[i - 1]) if i else None,
            "avg_days": _avg(
                r.days for r in here
                if r.state in an.MOVING and r.days is not None
            ),
        })

    reasons = Counter(
        stop_reason(r.last_comment) for r in entered if r.state == STOP
    )
    stopped = sum(reasons.values())

    total = len(entered)
    return {
        "period": period,
        "entered": total,
        "contracts": at_least[CONTRACT_STEP],
        "contract_pct": _pct(at_least[CONTRACT_STEP], total),
        "registered": at_least[REGISTERED_STEP],
        "registered_pct": _pct(at_least[REGISTERED_STEP], total),
        "avg_to_contract": _avg(
            d for r in entered if (d := to_contract(r)) is not None
        ),
        "steps": steps,
        "reasons": {
            "total": stopped,
            "items": [
                {"key": key, "label": label, "count": n,
                 "pct": _pct(n, stopped)}
                for (key, label), n in reasons.most_common()
            ],
        },
        "months": monthly(rows, today),
    }


def monthly(rows: list[Row], today: date) -> list[dict]:
    months = _months(today)
    known = set(months)
    new = Counter()
    signed = Counter()
    stops = Counter()
    for row in rows:
        start = entry_date(row)
        if start and _month(start) in known:
            new[_month(start)] += 1
        contract = row.stages.get("Кк")
        if contract and _month(contract) in known:
            signed[_month(contract)] += 1
        if row.state == STOP and row.status_date is not None:
            stamp = _month(row.status_date.date())
            if stamp in known:
                stops[stamp] += 1
    return [
        {"month": m, "new": new[m], "contracts": signed[m],
         "stops": stops[m]}
        for m in months
    ]


def summary(rows: list[Row]) -> dict:
    return {
        "offers": len(rows),
        "products": len({r.product for r in rows}),
        "makers": len({_key(r.maker) for r in rows if r.maker}),
        "maker_countries": len({
            _key(r.maker_country) for r in rows if r.maker_country
        }),
        "avg_days": _avg(r.days for r in rows if r.days is not None),
    }


def _top_mnn(rows: list[Row]) -> list[dict]:
    out = []
    for group in _group(rows, lambda r: _key(r.generic) or None).values():
        out.append({
            "generic": _top(r.generic for r in group),
            "offers": len(group),
            "products": len({r.product for r in group}),
            "makers": len({_key(r.maker) for r in group if r.maker}),
            "countries": len({
                _key(r.maker_country) for r in group if r.maker_country
            }),
            "targets": sorted({
                r.target_country for r in group if r.target_country
            }),
            "contracts": sum(1 for r in group if _contracted(r)),
            "states": _states(group),
        })
    out.sort(key=lambda m: (-m["offers"], -m["makers"], m["generic"]))
    return out[:TOP_OVERVIEW]


def _top_makers(rows: list[Row]) -> list[dict]:
    index = price_index(rows)
    out = []
    for key, group in _group(rows, lambda r: _key(r.maker) or None).items():
        out.append({
            "maker": _top(r.maker for r in group),
            "country": _top(r.maker_country for r in group),
            "offers": len(group),
            "mnn": len({_key(r.generic) for r in group}),
            "contracts": sum(1 for r in group if _contracted(r)),
            "index": index.get(key),
            "states": _states(group),
        })
    out.sort(key=lambda m: (-m["offers"], m["maker"]))
    return out[:TOP_OVERVIEW]


def _shares(
    rows: list[Row], key: Callable[[Row], str | None], mode: str,
) -> list[dict]:
    total = len(rows)
    out = []
    for code, group in _group(rows, key).items():
        signed = sum(1 for r in group if _contracted(r))
        out.append({
            "code": code,
            "name": country_name(code, mode),
            "offers": len(group),
            "pct": _pct(len(group), total),
            "makers": len({_key(r.maker) for r in group if r.maker}),
            "contracts": signed,
            "conversion": _pct(signed, len(group)),
        })
    out.sort(key=lambda c: (-c["offers"], c["name"]))
    return out[:TOP_ORIGIN]


def _stages_now(rows: list[Row]) -> list[dict]:
    active = [r for r in rows if r.state not in an.INACTIVE]
    counts = Counter(an.funnel_code(r) for r in active)
    out = []
    for code in an.FUNNEL:
        if not counts[code]:
            continue
        days = [
            r.days for r in active
            if an.funnel_code(r) == code and r.state in an.MOVING
            and r.days is not None
        ]
        out.append({
            "code": code,
            "name": STAGE_NAMES[code],
            "count": counts[code],
            "avg_days": _avg(days),
        })
    stopped = len(rows) - len(active)
    if stopped:
        out.append({
            "code": "stop", "name": "Остановлено", "count": stopped,
            "avg_days": None,
        })
    return out


def _kpi(rows: list[Row], today: date) -> dict:
    total = len(rows)
    signed = sum(1 for r in rows if _contracted(r))
    since = today - timedelta(days=NEW_DAYS)
    return {
        "offers": total,
        "mnn": len({_key(r.generic) for r in rows}),
        "products": len({r.product for r in rows}),
        "makers": len({_key(r.maker) for r in rows if r.maker}),
        "maker_countries": len({
            _key(r.maker_country) for r in rows if r.maker_country
        }),
        "targets": len({
            r.target_country for r in rows if r.target_country
        }),
        "work": sum(1 for r in rows if r.state == WORK),
        "contracts": signed,
        "contract_pct": _pct(signed, total),
        "stopped": sum(1 for r in rows if r.state in an.INACTIVE),
        "new": sum(
            1 for r in rows if (d := entry_date(r)) and d > since
        ),
        "new_days": NEW_DAYS,
        "avg_to_contract": _avg(
            d for r in rows if (d := to_contract(r)) is not None
        ),
    }


def _fmt(value: float | None) -> str:
    if value is None:
        return "—"
    text = f"{value:.1f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


def _plural(n: int, one: str, few: str, many: str) -> str:
    tail = n % 100
    if 11 <= tail <= 14:
        word = many
    elif n % 10 == 1:
        word = one
    elif 2 <= n % 10 <= 4:
        word = few
    else:
        word = many
    return f"{n} {word}"


def _offers(n: int) -> str:
    return _plural(n, "предложение", "предложения", "предложений")


def _bottleneck(stages: list[dict]) -> dict | None:
    active = [s for s in stages if s["code"] != "stop"]
    total = sum(s["count"] for s in active)
    if total < BOTTLENECK_MIN:
        return None
    s = max(active, key=lambda c: c["count"])
    share = _pct(s["count"], total) or 0
    if share < BOTTLENECK_SHARE:
        return None
    return {
        "kind": "bottleneck",
        "title": f"{s['name']} — {s['count']} из {total}",
        "text": (
            f"{_fmt(share)}% предложений в процессе стоят на этом этапе"
            + (
                f", в среднем {round(s['avg_days'])} дн."
                if s["avg_days"] is not None else ""
            )
        ),
        "tone": "bad",
        "link": {"to": "list", "params": {"stage": s["code"]}},
    }


def _best_source(rows: list[Row], origin: list[dict]) -> dict | None:
    index = price_index(rows)
    averages = {}
    for country, group in _group(rows, lambda r: r.maker_country).items():
        values = [index[k] for r in group if (k := _key(r.maker)) in index]
        if values:
            averages[country] = _avg(values)
    big = [
        o for o in origin
        if (o["pct"] or 0) >= SOURCE_SHARE and o["code"] in averages
    ]
    if not big:
        return None
    best = min(big, key=lambda o: (averages[o["code"]], -o["offers"]))
    signed = _plural(
        best["contracts"], "контракт", "контракта", "контрактов",
    )
    text = (
        f"{_offers(best['offers'])}, {signed}, "
        f"ценовой индекс +{_fmt(averages[best['code']])}%"
    )
    if len(big) > 1:
        text += " — самый низкий среди крупных"
    return {
        "kind": "source",
        "title": f"{best['name']} — {_fmt(best['pct'])}% предложений",
        "text": text,
        "tone": "good",
        "link": {"to": "country", "params": {
            "code": best["code"], "mode": "maker",
        }},
    }


def _main_market(
    targets: list[dict], average: float | None,
) -> dict | None:
    if len(targets) < 2 or average is None:
        return None
    top = targets[0]
    conv = top["conversion"]
    if conv is None:
        return None
    side = "выше" if conv >= average else "ниже"
    return {
        "kind": "market",
        "title": f"{top['name']} — {_fmt(top['pct'])}% поиска",
        "text": (
            f"{_offers(top['offers'])}, конверсия {_fmt(conv)}% — "
            f"{side} средней {_fmt(average)}%"
        ),
        "tone": "info",
        "code": top["code"],
        "link": {"to": "country", "params": {
            "code": top["code"], "mode": "target",
        }},
    }


def _stop_insight(rows: list[Row]) -> dict | None:
    stopped = [r for r in rows if r.state == STOP]
    reasons = Counter(stop_reason(r.last_comment) for r in stopped)
    real = [
        (k, n) for k, n in reasons.most_common()
        if k[0] not in (OTHER_REASON[0], NO_REASON[0])
    ]
    if not real or real[0][1] < 3:
        return None
    (_, label), count = real[0]
    return {
        "kind": "stop",
        "title": f"{label} — {_fmt(_pct(count, len(stopped)))}% остановок",
        "text": (
            f"{count} из {_offers(len(stopped))} остановлены "
            "по этой причине"
        ),
        "tone": "warn",
        "link": {"to": "list", "params": {"tab": "stop"}},
    }


def _funnel_steps(rows: list[Row], today: date) -> dict:
    data = funnel(rows, "all", today)
    steps = []
    prev = None
    for s in data["steps"]:
        steps.append({
            "code": s["code"],
            "name": s["name"],
            "reached": s["reached"],
            "conversion": s["conversion"],
            "lost": None if prev is None else prev - s["reached"],
        })
        prev = s["reached"]
    worst = max(
        (i for i, s in enumerate(steps) if s["lost"]),
        key=lambda i: steps[i]["lost"], default=None,
    )
    return {
        "steps": steps,
        "worst": None if worst is None else {
            "code": steps[worst]["code"],
            "name": steps[worst]["name"],
            "from": steps[worst - 1]["name"],
            "lost": steps[worst]["lost"],
        },
    }


def overview(
    rows: list[Row], today: date, market: bool, until: date | None = None,
) -> dict:
    kpi = _kpi(rows, today)
    stages = _stages_now(rows)
    origin = _shares(rows, lambda r: r.maker_country, "maker")
    targets = [] if market else _shares(
        rows, lambda r: r.target_country, "target",
    )
    rules = [
        _bottleneck(stages),
        _best_source(rows, origin),
        None if market else _main_market(targets, kpi["contract_pct"]),
        _stop_insight(rows),
    ]
    return {
        "kpi": kpi,
        "states": _states(rows),
        "stages": stages,
        "funnel": _funnel_steps(rows, today),
        "insights": [r for r in rules if r],
        "mnn": _top_mnn(rows),
        "makers": _top_makers(rows),
        "origin": origin,
        "targets": targets,
        "months": monthly(rows, until or today),
    }
