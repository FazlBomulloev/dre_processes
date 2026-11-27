from datetime import date

from backend.services.rgs import analytics as an
from backend.services.rgs import status as st
from backend.services.rgs.headers import norm

GROUP_RANK = {key: i for i, key in enumerate(st.GROUP_KEYS)}
GROUP_NAMES = {key: name for key, name, _ in st.GROUPS}
RED_METRICS = (
    ("cycle", "цикл до подачи"),
    ("delay", "опоздание к плану подачи"),
    ("ru", "срок РУ"),
)


def item_key(item: an.Item) -> str:
    if item.erp_id:
        return f"erp:{norm(item.erp_id)}"
    parts = (item.tm, item.form, item.dose, item.pack)
    return "tm:" + "|".join(norm(p) if p else "" for p in parts)


def by_key(items: list[an.Item]) -> dict[str, an.Item]:
    out: dict[str, an.Item] = {}
    for item in items:
        out.setdefault(item_key(item), item)
    return out


def plan_moves(
    old: list[an.Item], new: list[an.Item],
) -> list[dict]:
    before = by_key(old)
    out = []
    for key, item in by_key(new).items():
        prev = before.get(key)
        if prev is None or prev.plan_submit is None:
            continue
        if item.plan_submit is None or item.plan_submit == prev.plan_submit:
            continue
        out.append({
            "key": key, "tm": item.tm, "owner": item.owner,
            "old": prev.plan_submit, "new": item.plan_submit,
        })
    return out


def _red(ev: an.Ev, metric: str) -> bool:
    if metric == "cycle":
        return ev.cycle.tone == an.RED
    if metric == "delay":
        return ev.delay.tone == an.RED
    return not ev.ru.got and ev.ru.tone == an.RED


def _value(ev: an.Ev, metric: str) -> int | None:
    if metric == "cycle":
        return ev.cycle.fact
    if metric == "delay":
        return ev.delay.fact
    return ev.ru.days


def _brief(ev: an.Ev) -> dict:
    item = ev.item
    return {
        "id": item.id,
        "tm": item.tm,
        "sub": " · ".join(
            v for v in (item.form, item.dose, item.manufacturer) if v
        ),
        "manager": ev.manager,
    }


def changes(
    current: list[an.Ev], base: list[an.Ev], warn: int,
) -> dict:
    before = {item_key(e.item): e for e in base}
    new_red, moved, plans, added = [], [], [], []
    for ev in current:
        key = item_key(ev.item)
        prev = before.get(key)
        if prev is None:
            added.append(_brief(ev))
        for metric, label in RED_METRICS:
            if _red(ev, metric) and (prev is None or not _red(prev, metric)):
                new_red.append({
                    **_brief(ev), "metric": metric, "label": label,
                    "value": _value(ev, metric),
                })
        if prev is None:
            continue
        if GROUP_RANK[ev.group] > GROUP_RANK[prev.group]:
            moved.append({
                **_brief(ev),
                "from": GROUP_NAMES[prev.group],
                "to": GROUP_NAMES[ev.group],
            })
        old_plan, new_plan = prev.item.plan_submit, ev.item.plan_submit
        if old_plan and new_plan and old_plan != new_plan:
            plans.append({
                **_brief(ev), "old": old_plan.isoformat(),
                "new": new_plan.isoformat(),
                "days": (new_plan - old_plan).days,
            })
    soon = [
        {**_brief(e), "plan": e.ru.plan.isoformat(), "days": e.ru.days}
        for e in current
        if not e.ru.got and e.ru.days is not None and 0 <= e.ru.days <= warn
    ]
    soon.sort(key=lambda r: (r["days"], r["tm"]))
    new_red.sort(key=lambda r: (r["metric"], r["tm"]))
    moved.sort(key=lambda r: r["tm"])
    plans.sort(key=lambda r: (-abs(r["days"]), r["tm"]))
    return {
        "new_red": new_red,
        "moved": moved,
        "plan_moves": plans,
        "ru_soon": soon,
        "added": added,
    }


def snapshot_date(data_date: date | None, uploaded: date) -> date:
    return data_date or uploaded
