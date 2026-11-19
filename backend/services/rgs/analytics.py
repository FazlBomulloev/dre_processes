from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from statistics import mean, median

from backend.services.rgs.headers import DOCS

CATEGORIES = {"M": "Лекарства", "FS": "БАДы", "MD": "Медизделия"}

STEPS = (
    ("task", "Задача получена", "task_date"),
    ("req", "Досье запрошено у завода", "dossier_req"),
    ("analysis", "Досье проанализировано", "dossier_analysis"),
    ("submitted", "Подано в Минздрав", "submitted"),
    ("exp1", "Оплачена первичная экспертиза", "exp1_paid"),
    ("exp2", "Оплачена специализированная экспертиза", "exp2_paid"),
    ("ru", "РУ получено", None),
)
STAGES = (
    ("prep", "Готовится"),
    ("wait", "Ждёт экспертизы"),
    ("exp1", "Первичная оплачена"),
    ("exp2", "Специализированная оплачена"),
    ("ru", "РУ получено"),
    ("stop", "Стоп"),
)
STAGE_NAMES = dict(STAGES)
DURATIONS = (
    ("task_req", "от задачи до запроса досье",
     (("task_date", "dossier_req"),)),
    ("req_analysis", "от запроса до анализа досье",
     (("dossier_req", "dossier_analysis"),)),
    ("analysis_submit", "от анализа досье до подачи",
     (("dossier_analysis", "submitted"),)),
    ("invoice_paid", "от инвойса до оплаты",
     (("exp1_invoice", "exp1_paid"), ("exp2_invoice", "exp2_paid"))),
)
TIMELINE = (
    ("task_date", "Задача получена"),
    ("dossier_req", "Досье запрошено"),
    ("dossier_analysis", "Досье проанализировано"),
    ("submitted", "Подано в Минздрав"),
    ("exp1_invoice", "Первичная: инвойс"),
    ("exp1_paid", "Первичная: оплата"),
    ("exp2_invoice", "Специализированная: инвойс"),
    ("exp2_paid", "Специализированная: оплата"),
)
MONTHS_AHEAD = 13
NO_REASON = "Без комментария"
LONG_GROUP = "03"


@dataclass
class Settings:
    today: date
    margin: int = 2
    plan_date: date | None = None
    split_blockers: bool = False


@dataclass
class Item:
    id: int
    tm: str
    tm_ru: str | None = None
    generic: str | None = None
    form: str | None = None
    dose: str | None = None
    pack: str | None = None
    category: str | None = None
    owner: str | None = None
    manufacturer: str | None = None
    applicant: str | None = None
    status_code: str | None = None
    group_code: str | None = None
    is_new: bool = False
    task_date: date | None = None
    dossier_req: date | None = None
    dossier_analysis: date | None = None
    submitted: date | None = None
    plan_submit: date | None = None
    plan_ru: date | None = None
    plan_ru_shifted: date | None = None
    ru_date: date | None = None
    exp1_invoice: date | None = None
    exp1_paid: date | None = None
    exp2_invoice: date | None = None
    exp2_paid: date | None = None
    docs_mask: int = 0
    comment: str | None = None
    extra: dict = field(default_factory=dict)


def add_months(value: date, months: int) -> date:
    total = value.month - 1 + months
    year, month = value.year + total // 12, total % 12 + 1
    days = [31, 29 if year % 4 == 0 and (
        year % 100 != 0 or year % 400 == 0
    ) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(value.day, days[month - 1]))


def is_stop(item: Item) -> bool:
    group = (item.group_code or "").casefold()
    if "стоп" in group or "stop" in group:
        return True
    code = item.status_code or ""
    return not group and code.startswith("s")


def is_registered(item: Item) -> bool:
    return item.status_code == "r" or item.ru_date is not None


def stage(item: Item) -> str:
    if is_stop(item):
        return "stop"
    if is_registered(item):
        return "ru"
    if item.exp2_paid:
        return "exp2"
    if item.exp1_paid:
        return "exp1"
    if item.submitted:
        return "wait"
    return "prep"


def furthest(item: Item) -> int:
    if is_registered(item):
        return len(STEPS) - 1
    reached = 0
    for i, (_, _, attr) in enumerate(STEPS):
        if attr and getattr(item, attr):
            reached = i
    return reached


def plan_ru(item: Item, s: Settings) -> date | None:
    if item.plan_ru is not None:
        return add_months(item.plan_ru, s.margin)
    return item.plan_ru_shifted


def _month(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _filter(items: list[Item], cat: str | None) -> list[Item]:
    if not cat:
        return items
    return [i for i in items if (i.category or "") == cat]


def _stats(values: list[int]) -> dict:
    if not values:
        return {"median": None, "mean": None, "count": 0}
    return {
        "median": round(median(values)),
        "mean": round(mean(values)),
        "count": len(values),
    }


def _brief(item: Item) -> dict:
    return {
        "id": item.id,
        "tm": item.tm,
        "manufacturer": item.manufacturer,
        "generic": item.generic,
        "form": item.form,
        "category": item.category,
    }


def _months(active: list[Item], s: Settings) -> dict:
    start = date(s.today.year, s.today.month, 1)
    keys = [_month(add_months(start, i)) for i in range(MONTHS_AHEAD)]
    counts = dict.fromkeys(keys, 0)
    no_plan = 0
    later = 0
    for item in active:
        if is_registered(item):
            continue
        planned = plan_ru(item, s)
        if planned is None:
            no_plan += 1
            continue
        key = max(_month(planned), keys[0])
        if key in counts:
            counts[key] += 1
        else:
            later += 1
    year_end = f"{s.today.year:04d}-12"
    mid_next = f"{s.today.year + 1:04d}-06"
    running = 0
    totals = {"year": 0, "mid": 0, "period": 0}
    for key in keys:
        running += counts[key]
        if key <= year_end:
            totals["year"] = running
        if key <= mid_next:
            totals["mid"] = running
        totals["period"] = running
    return {
        "items": [
            {"month": k, "count": counts[k], "this_year": k <= year_end}
            for k in keys
        ],
        "no_plan": no_plan,
        "later": later,
        "totals": [
            {"label": f"К концу {s.today.year}", "count": totals["year"]},
            {"label": f"К середине {s.today.year + 1}",
             "count": totals["mid"]},
            {"label": "К концу периода", "month": keys[-1],
             "count": totals["period"]},
        ],
    }


def _plan(active: list[Item]) -> dict:
    planned = [i for i in active if i.plan_submit]
    done = [i for i in planned if i.submitted]
    delays = [(i.submitted - i.plan_submit).days for i in done]
    late = [d for d in delays if d > 0]
    return {
        "total": len(planned),
        "submitted": len(done),
        "on_time": len(delays) - len(late),
        "late": len(late),
        "late_median": round(median(late)) if late else None,
        "not_submitted": len(planned) - len(done),
    }


def _durations(items: list[Item]) -> list[dict]:
    out = []
    for key, label, pairs in DURATIONS:
        values = []
        for item in items:
            for a, b in pairs:
                start, end = getattr(item, a), getattr(item, b)
                if start and end and end >= start:
                    values.append((end - start).days)
        out.append({"key": key, "label": label, **_stats(values)})
    return out


def _blockers(active: list[Item], s: Settings) -> list[dict]:
    rows = []
    for item in active:
        if item.submitted or not item.plan_submit:
            continue
        if item.plan_submit >= s.today:
            continue
        rows.append({
            **_brief(item),
            "comment": item.comment,
            "days": (s.today - item.plan_submit).days,
            "plan_submit": item.plan_submit.isoformat(),
            "kind": (
                "long" if (item.group_code or "").startswith(LONG_GROUP)
                else "problem"
            ),
        })
    rows.sort(key=lambda r: (-r["days"], r["tm"]))
    return rows


def overview(items: list[Item], s: Settings, cat: str | None) -> dict:
    scoped = _filter(items, cat)
    active = [i for i in scoped if not is_stop(i)]
    reach = [furthest(i) for i in active]
    steps = []
    for k, (key, name, _) in enumerate(STEPS):
        steps.append({
            "key": key,
            "name": name,
            "reached": sum(r >= k for r in reach),
            "now": sum(r == k for r in reach),
        })
    months = _months(active, s)
    this_year = sum(
        m["count"] for m in months["items"] if m["this_year"]
    )
    next_year = sum(
        1 for i in active
        if not is_registered(i) and plan_ru(i, s)
        and plan_ru(i, s).year == s.today.year + 1
    )
    return {
        "today": s.today.isoformat(),
        "plan_date": s.plan_date.isoformat() if s.plan_date else None,
        "margin": s.margin,
        "categories": _category_counts(items),
        "now": {
            "in_work": len(active),
            "submitted": sum(1 for i in active if i.submitted),
            "ru_this_year": this_year,
            "ru_next_year": next_year,
            "year": s.today.year,
        },
        "steps": steps,
        "months": months,
        "plan": _plan(active),
        "durations": _durations(active),
        "blockers": _blockers(active, s),
        "split_blockers": s.split_blockers,
        "stopped": sum(1 for i in scoped if is_stop(i)),
    }


def _category_counts(items: list[Item]) -> dict:
    out = {"": 0, **dict.fromkeys(CATEGORIES, 0)}
    for item in items:
        if is_stop(item):
            continue
        out[""] += 1
        if item.category in CATEGORIES:
            out[item.category] += 1
    return out


def _variant(item: Item) -> dict:
    return {
        "id": item.id,
        "generic": item.generic,
        "form": item.form,
        "dose": item.dose,
        "pack": item.pack,
        "stage": stage(item),
    }


def month(
    items: list[Item], s: Settings, key: str, cat: str | None,
) -> dict:
    first = _month(s.today)
    picked = []
    for item in _filter(items, cat):
        if is_stop(item) or is_registered(item):
            continue
        planned = plan_ru(item, s)
        if planned and max(_month(planned), first) == key:
            picked.append(item)
    return {"month": key, "count": len(picked), "groups": _groups(
        picked, lambda i: i.manufacturer or "Без производителя",
    )}


def _groups(items: list[Item], key) -> list[dict]:
    by_group: dict[str, dict[str, list[Item]]] = defaultdict(
        lambda: defaultdict(list),
    )
    for item in items:
        by_group[key(item)][item.tm].append(item)
    out = []
    for name, products in by_group.items():
        rows = []
        for tm, variants in sorted(products.items()):
            head = variants[0]
            rows.append({
                "tm": tm,
                "manufacturer": head.manufacturer,
                "generic": head.generic,
                "form": head.form,
                "category": head.category,
                "comment": head.comment,
                "count": len(variants),
                "variants": [_variant(v) for v in variants],
            })
        out.append({
            "name": name,
            "count": sum(r["count"] for r in rows),
            "rows": rows,
        })
    out.sort(key=lambda g: (-g["count"], g["name"]))
    return out


def stops(items: list[Item], cat: str | None) -> dict:
    stopped = [i for i in _filter(items, cat) if is_stop(i)]
    return {"count": len(stopped), "groups": _groups(
        stopped, lambda i: (i.comment or NO_REASON).strip(),
    )}


def _row(item: Item, s: Settings) -> dict:
    planned = plan_ru(item, s)
    return {
        **_brief(item),
        "dose": item.dose,
        "pack": item.pack,
        "is_new": item.is_new,
        "stage": stage(item),
        "submitted": item.submitted.isoformat() if item.submitted else None,
        "plan_submit": (
            item.plan_submit.isoformat() if item.plan_submit else None
        ),
        "overdue": bool(
            not item.submitted and item.plan_submit
            and item.plan_submit < s.today
        ),
        "plan_ru": planned.isoformat() if planned else None,
        "plan_ru_raw": item.plan_ru.isoformat() if item.plan_ru else None,
    }


def _order(item: Item) -> tuple:
    if is_stop(item):
        return (3, date.max, item.tm)
    if item.submitted:
        return (0, item.submitted, item.tm)
    if item.plan_submit:
        return (1, item.plan_submit, item.tm)
    return (2, date.max, item.tm)


def products(
    items: list[Item], s: Settings, stage_key: str | None,
    q: str | None, cat: str | None,
) -> dict:
    scoped = _filter(items, cat)
    if q:
        needle = q.casefold().strip()
        scoped = [
            i for i in scoped
            if any(
                needle in (v or "").casefold()
                for v in (i.tm, i.tm_ru, i.generic, i.manufacturer)
            )
        ]
    counts = {"": len([i for i in scoped if not is_stop(i)])}
    for key, _ in STAGES:
        counts[key] = sum(1 for i in scoped if stage(i) == key)
    if stage_key:
        scoped = [i for i in scoped if stage(i) == stage_key]
    else:
        scoped = [i for i in scoped if not is_stop(i)]
    scoped.sort(key=_order)
    return {
        "counts": counts,
        "items": [_row(i, s) for i in scoped],
    }


def product(item: Item, s: Settings) -> dict:
    shift = None
    if item.submitted and item.plan_submit:
        shift = (item.submitted - item.plan_submit).days
    return {
        **_row(item, s),
        "tm_ru": item.tm_ru,
        "owner": item.owner,
        "applicant": item.applicant,
        "status_code": item.status_code,
        "group_code": item.group_code,
        "comment": item.comment,
        "shift": shift,
        "timeline": [
            {
                "key": attr, "label": label,
                "date": getattr(item, attr).isoformat()
                if getattr(item, attr) else None,
            }
            for attr, label in TIMELINE
        ],
        "docs": [
            {"name": name, "ok": bool(item.docs_mask & (1 << i))}
            for i, name in enumerate(DOCS)
        ],
    }
