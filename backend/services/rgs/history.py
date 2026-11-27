from datetime import date

from backend.services.rgs import analytics as an
from backend.services.rgs.headers import norm


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


def snapshot_date(data_date: date | None, uploaded: date) -> date:
    return data_date or uploaded
