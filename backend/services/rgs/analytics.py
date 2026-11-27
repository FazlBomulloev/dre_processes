from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from math import floor
from statistics import mean, median

from backend.services.rgs import status as st
from backend.services.rgs.headers import DOCS, norm
from backend.services.rgs.norms import Norms, red_at

CATEGORIES = {"M": "Лекарства", "FS": "БАДы", "MD": "Медизделия"}
GRN, AMB, RED, NA = "grn", "amb", "red", "na"
CHAIN = (
    ("task_date", "задача получена"),
    ("dossier_ready", "досье готово"),
    ("sent_registrar", "отправлено регистратору"),
    ("submitted", "подано"),
    ("exp1_paid", "1-я экспертиза оплачена"),
    ("exp2_paid", "2-я экспертиза оплачена"),
    ("ru_date", "РУ получено"),
)
CHAIN_INDEX = {attr: i for i, (attr, _) in enumerate(CHAIN)}
STAGES = (
    ("e1", "Комплектация досье", "d → dcz", "task_date", "dossier_ready"),
    ("e2", "Отправка регистратору", "dcz → dh", "dossier_ready",
     "sent_registrar"),
    ("e3", "Подача в Минздрав", "dh → dha", "sent_registrar", "submitted"),
    ("e23", "Передача регистратору и подача", "dcz → dh → dha",
     "dossier_ready", "submitted"),
    ("t1", "Итого до подачи", "d → dha", "task_date", "submitted"),
    ("e4", "Первичная экспертиза", "dha → dhp1", "submitted", "exp1_paid"),
    ("e5", "Специализированная экспертиза", "dhp1 → dhp2", "exp1_paid",
     "exp2_paid"),
    ("e6", "Регистрация", "dhp2 → r", "exp2_paid", "ru_date"),
)
STAGE_BY_CODE = {s[0]: s for s in STAGES}
SPLIT_STAGES = frozenset({"e1", "e2", "e3", "e23"})
OVERVIEW_STAGES = ("e1", "e23", "t1", "e4", "e5", "e6")
CARD_STEPS = (
    ("task", "Задача получена", "d", "task_date", None),
    ("e1", "Комплектация", "d → dcz", "dossier_ready", "e1"),
    ("e23", "Передача и подача", "dcz → dh → dha", "submitted", "e23"),
    ("e4", "1-я экспертиза оплачена", "dha → dhp1", "exp1_paid", "e4"),
    ("e5", "2-я экспертиза оплачена", "dhp1 → dhp2", "exp2_paid", "e5"),
    ("e6", "РУ получено", "dhp2 → r", "ru_date", "e6"),
)
KPIS = (
    (1, "Подано в срок", "%", True,
     "Подано не позже «Пл ПД» / все поданные с планом"),
    (2, "Цикл «задача → подача»", "дн.", False,
     "Дата подачи − дата задачи, среднее по поданным"),
    (3, "Опоздание к плану подачи", "дн.", False,
     "Дата подачи − «Пл ПД», среднее. Без плана не считается"),
    (4, "Срок РУ: жёлтые и красные", "", False,
     "РУ нет, а до плана {warn} дн. и меньше или план прошёл"),
    (5, "РУ в плановый срок", "%", True,
     "РУ получено не позже плана / все полученные РУ"),
    (6, "Статусы актуальны", "%", True,
     "Статус в трекере совпадает со статусом по датам / все проекты"),
)
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
COMMENTS = (
    ("comment", "JS / IZ (Comments)"),
    ("comment_iz", "Комментарии ИЗ и ЧС"),
    ("comment_bdm", "Комментарии БДМ"),
)
VIEWS = (*st.GROUP_KEYS, "stop", "red_cycle", "red_ru")
MONTHS_AHEAD = 13
OVERDUE = "overdue"
NO_REASON = "Без комментария"
NO_MANAGER = "Без менеджера"


@dataclass
class Settings:
    today: date
    norms: Norms = field(default_factory=Norms)
    managers: dict[str, str] = field(default_factory=dict)
    split: bool = True


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
    sheet: str | None = None
    row_no: int | None = None
    erp_id: str | None = None
    task_date: date | None = None
    dossier_req: date | None = None
    dossier_analysis: date | None = None
    dossier_ready: date | None = None
    sent_registrar: date | None = None
    submitted: date | None = None
    plan_submit: date | None = None
    ru_date: date | None = None
    plan_ru: date | None = None
    exp1_invoice: date | None = None
    exp1_paid: date | None = None
    exp2_invoice: date | None = None
    exp2_paid: date | None = None
    step_due: date | None = None
    next_step: str | None = None
    reason_code: str | None = None
    docs_mask: int = 0
    comment: str | None = None
    comment_iz: str | None = None
    comment_bdm: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Scope:
    cat: str | None = None
    year: int | None = None
    tms: tuple[str, ...] = ()


@dataclass
class Span:
    fact: int | None
    norm: int | None
    tone: str
    running: bool = False

    def out(self) -> dict:
        return {
            "fact": self.fact, "norm": self.norm, "tone": self.tone,
            "running": self.running,
            "red": red_at(self.norm) if self.norm is not None else None,
        }


@dataclass
class RuPlan:
    plan: date | None
    days: int | None
    tone: str
    got: bool
    late: int | None
    source: str | None = None

    def out(self) -> dict:
        return {
            "plan": _iso(self.plan), "days": self.days, "tone": self.tone,
            "got": self.got, "late": self.late, "source": self.source,
        }


@dataclass
class Status:
    code: str | None
    rank: int | None
    by_date: str | None
    issue: str | None


@dataclass
class Ev:
    item: Item
    stop: bool
    manager: str | None
    status: Status
    group: str
    spans: dict[str, Span]
    delay: Span
    ru: RuPlan
    checks: list[dict]

    @property
    def cycle(self) -> Span:
        return self.spans["t1"]


def rnd(value: float) -> int:
    return floor(value + 0.5)


def pct(part: int, total: int) -> int | None:
    return rnd(100 * part / total) if total else None


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _ru_date(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def tone(fact: int | None, norm_days: int | None, red: int) -> str:
    if fact is None or norm_days is None:
        return NA
    if fact <= norm_days:
        return GRN
    if fact <= red:
        return AMB
    return RED


def is_stop(item: Item) -> bool:
    group = (item.group_code or "").casefold()
    if "стоп" in group or "stop" in group:
        return True
    code = item.status_code or ""
    return not group and code.startswith("s")


def manager(item: Item, s: Settings) -> str | None:
    if not item.owner:
        return None
    names = {norm(k): v for k, v in s.managers.items()}
    return names.get(norm(item.owner), item.owner)


def _later(item: Item, attr: str) -> bool:
    return any(
        getattr(item, a) is not None
        for a, _ in CHAIN[CHAIN_INDEX[attr] + 1:]
    )


def ru_plan(item: Item, s: Settings) -> RuPlan:
    total = s.norms.ru(item.category)
    got = item.ru_date is not None
    if item.plan_ru is not None:
        plan, source = item.plan_ru, "tracker"
    elif total is not None and item.task_date is not None:
        plan = item.task_date + timedelta(days=total)
        source = "norm"
    else:
        return RuPlan(None, None, NA, got, None)
    if got:
        late = (item.ru_date - plan).days
        tone = GRN if late <= 0 else RED
        return RuPlan(plan, None, tone, True, late, source)
    left = (plan - s.today).days
    if left > s.norms.get("ru_warn"):
        color = GRN
    elif left >= 0:
        color = AMB
    else:
        color = RED
    return RuPlan(plan, left, color, False, None, source)


def span(item: Item, code: str, s: Settings, ru: RuPlan) -> Span:
    _, _, _, start_attr, end_attr = STAGE_BY_CODE[code]
    norm_days = s.norms.stage(code, item.category)
    if code in SPLIT_STAGES and not s.split:
        return Span(None, norm_days, NA)
    start, end = getattr(item, start_attr), getattr(item, end_attr)
    if start is None:
        return Span(None, norm_days, NA)
    running = end is None
    if running:
        if _later(item, end_attr):
            return Span(None, norm_days, NA)
        end = s.today
    fact = (end - start).days
    if fact < 0:
        return Span(None, norm_days, NA)
    if code == "e6":
        return Span(fact, norm_days, ru.tone, running)
    return Span(
        fact, norm_days, tone(fact, norm_days, red_at(norm_days or 0)),
        running,
    )


def delay(item: Item, s: Settings) -> Span:
    plan = item.plan_submit
    if plan is None:
        return Span(None, None, NA)
    running = item.submitted is None
    if not running:
        value = (item.submitted - plan).days
    elif plan < s.today:
        value = (s.today - plan).days
    else:
        value = 0
    limit = s.norms.get("d1")
    return Span(
        value, limit, tone(value, limit, s.norms.get("d1_red")), running,
    )


def status(item: Item, s: Settings) -> Status:
    code = item.status_code
    plain = st.base(code)
    own = st.OWN_DATE if s.split else st.OWN_DATE - st.SPLIT_CODES
    rank = st.rank(code, item.exp1_paid)
    found = st.by_dates(item)
    if found is None:
        issue = None
        if rank is not None and plain in own:
            issue = f"статус {code}, а даты для него в трекере нет"
        return Status(code, rank, None, issue)
    date_code, label, value = found
    date_rank = st.ORDER[date_code]
    issue = None
    if rank is not None and rank < date_rank:
        issue = (
            f"статус {code}, а по датам {date_code} "
            f"({label} {_ru_date(value)})"
        )
    elif (
        rank is not None and rank > date_rank and plain in own
    ):
        issue = f"статус {code}, а даты для него в трекере нет"
    return Status(code, rank, date_code, issue)


def _checks(item: Item, ev_status: Status, s: Settings) -> list[dict]:
    out = []
    if ev_status.issue:
        out.append({"kind": "status", "text": ev_status.issue})
    if not st.known_status(item.status_code):
        out.append({
            "kind": "unknown",
            "text": f"неизвестный код статуса «{item.status_code}»",
        })
    filled = [
        (attr, label, getattr(item, attr)) for attr, label in CHAIN
        if getattr(item, attr) is not None
    ]
    for (_, a_label, a), (_, b_label, b) in zip(filled, filled[1:]):
        if b < a:
            out.append({"kind": "order", "text": (
                f"даты не по порядку: {b_label} {_ru_date(b)} раньше, "
                f"чем {a_label} {_ru_date(a)}"
            )})
    for _, label, value in filled:
        if value > s.today:
            out.append({
                "kind": "future",
                "text": f"дата в будущем: {label} {_ru_date(value)}",
            })
    if (
        item.plan_submit is None and item.submitted is None
        and item.ru_date is None
    ):
        out.append({"kind": "no_plan", "text": "нет «Пл ПД» (план подачи)"})
    if item.category not in CATEGORIES:
        out.append({
            "kind": "no_category",
            "text": "нет категории — план РУ не посчитать",
        })
    if item.step_due is not None and item.step_due < s.today:
        step = f" ({item.next_step})" if item.next_step else ""
        out.append({"kind": "step", "text": (
            f"срок следующего шага {_ru_date(item.step_due)} прошёл{step}"
        )})
    return out


def evaluate(item: Item, s: Settings) -> Ev:
    ru = ru_plan(item, s)
    spans = {code: span(item, code, s, ru) for code, *_ in STAGES}
    info = status(item, s)
    rank = st.ORDER[info.by_date] if info.by_date else info.rank
    stop = is_stop(item)
    return Ev(
        item=item,
        stop=stop,
        manager=manager(item, s),
        status=info,
        group=st.group_of(rank) or "prep",
        spans=spans,
        delay=delay(item, s),
        ru=ru,
        checks=[] if stop else _checks(item, info, s),
    )


def scope(items: list[Item], sc: Scope) -> list[Item]:
    out = items
    if sc.cat:
        out = [i for i in out if (i.category or "") == sc.cat]
    if sc.year:
        out = [
            i for i in out if i.task_date and i.task_date.year == sc.year
        ]
    if sc.tms:
        wanted = {norm(t) for t in sc.tms}
        out = [i for i in out if norm(i.tm) in wanted]
    return out


def _evs(items: list[Item], s: Settings) -> list[Ev]:
    return [evaluate(i, s) for i in items]


def _kpi_tone(value: int | None, goal: int, red: int, up: bool) -> str:
    if value is None:
        return NA
    if up:
        return GRN if value >= goal else RED if value < red else AMB
    return GRN if value <= goal else RED if value > red else AMB


def _kpi_values(evs: list[Ev]) -> dict[int, tuple[int | None, str]]:
    with_plan = [
        e for e in evs if e.item.submitted and e.item.plan_submit
    ]
    on_time = sum(
        e.item.submitted <= e.item.plan_submit for e in with_plan
    )
    cycles = [
        e.cycle.fact for e in evs
        if e.item.submitted and e.cycle.fact is not None
    ]
    delays = [e.delay.fact for e in evs if e.delay.fact is not None]
    pending = [e for e in evs if not e.ru.got and e.ru.plan]
    warned = sum(e.ru.tone in (AMB, RED) for e in pending)
    got = [e for e in evs if e.ru.got and e.ru.plan]
    got_ok = sum((e.ru.late or 0) <= 0 for e in got)
    fresh = sum(e.status.issue is None for e in evs)
    return {
        1: (pct(on_time, len(with_plan)), (
            f"{on_time} из {len(with_plan)} с планом" if with_plan
            else "нет поданных с планом"
        )),
        2: (rnd(mean(cycles)) if cycles else None, (
            f"среднее по {len(cycles)}" if cycles else "нет поданных"
        )),
        3: (rnd(mean(delays)) if delays else None, (
            f"среднее по {len(delays)}" if delays else "нет плана подачи"
        )),
        4: (warned if pending else None, f"из {len(pending)}"),
        5: (pct(got_ok, len(got)), (
            f"{got_ok} из {len(got)}" if got else "РУ ещё не получено"
        )),
        6: (pct(fresh, len(evs)), f"{fresh} из {len(evs)}"),
    }


def kpis(evs: list[Ev], s: Settings) -> list[dict]:
    values = _kpi_values(evs)
    out = []
    for number, label, unit, up, how in KPIS:
        goal, red = s.norms.kpi(number)
        value, base = values[number]
        out.append({
            "key": f"k{number}",
            "label": label,
            "value": value,
            "unit": unit,
            "base": base,
            "tone": _kpi_tone(value, goal, red, up),
            "goal": goal,
            "red": red,
            "up": up,
            "how": how.format(warn=s.norms.get("ru_warn")),
        })
    return out


def active_evs(items: list[Item], s: Settings, sc: Scope) -> list[Ev]:
    return [e for e in _evs(scope(items, sc), s) if not e.stop]


def _stage_block(evs: list[Ev], s: Settings, cat: str | None) -> list:
    out = []
    for code in OVERVIEW_STAGES:
        _, name, codes, _, _ = STAGE_BY_CODE[code]
        facts = [
            e.spans[code].fact for e in evs
            if e.spans[code].fact is not None and not e.spans[code].running
        ]
        norm_days = s.norms.stage(code, cat)
        fact = rnd(mean(facts)) if facts else None
        red = red_at(norm_days) if norm_days is not None else None
        out.append({
            "key": code, "name": name, "codes": codes, "norm": norm_days,
            "red": red, "fact": fact, "count": len(facts),
            "tone": tone(fact, norm_days, red or 0),
        })
    return out


def _sub(item: Item) -> str:
    return " · ".join(
        v for v in (item.form, item.dose, item.manufacturer) if v
    )


def _ru_due(evs: list[Ev]) -> list[dict]:
    rows = [
        {
            "id": e.item.id, "tm": e.item.tm, "sub": _sub(e.item),
            "manager": e.manager, **e.ru.out(),
        }
        for e in evs
        if not e.ru.got and e.ru.tone in (AMB, RED)
    ]
    rows.sort(key=lambda r: (r["days"], r["tm"]))
    return rows


def _funnel(evs: list[Ev]) -> list[dict]:
    return [
        {
            "key": key, "name": name, "codes": codes,
            "count": sum(e.group == key for e in evs),
        }
        for key, name, codes in st.GROUPS
    ]


def _month(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def add_months(value: date, months: int) -> date:
    total = value.month - 1 + months
    return date(value.year + total // 12, total % 12 + 1, 1)


def _bucket(e: Ev, s: Settings) -> str | None:
    if e.ru.got or e.ru.plan is None:
        return None
    if e.ru.plan < s.today:
        return OVERDUE
    return _month(e.ru.plan)


def _months(evs: list[Ev], s: Settings) -> dict:
    start = date(s.today.year, s.today.month, 1)
    keys = [_month(add_months(start, i)) for i in range(MONTHS_AHEAD)]
    counts = dict.fromkeys(keys, 0)
    overdue = no_plan = later = 0
    for e in evs:
        if e.ru.got:
            continue
        key = _bucket(e, s)
        if key is None:
            no_plan += 1
        elif key == OVERDUE:
            overdue += 1
        elif key in counts:
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
        "overdue": overdue,
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


def _stats(values: list[int]) -> dict:
    if not values:
        return {"median": None, "mean": None, "count": 0}
    return {
        "median": rnd(median(values)),
        "mean": rnd(mean(values)),
        "count": len(values),
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


def _check_rows(evs: list[Ev]) -> list[dict]:
    rows = []
    for e in evs:
        for check in e.checks:
            rows.append({
                "tm": e.item.tm, "sub": _sub(e.item),
                "manager": e.manager, "sheet": e.item.sheet,
                "row": e.item.row_no, **check,
            })
    rows.sort(key=lambda r: (r["manager"] or "", r["tm"], r["row"] or 0))
    return rows


def filters(items: list[Item]) -> dict:
    years: dict[int, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        counts[item.tm] += 1
        if item.task_date:
            years[item.task_date.year] += 1
    return {
        "years": [
            {"value": str(y), "count": n}
            for y, n in sorted(years.items(), reverse=True)
        ],
        "products": [
            {"tm": tm, "count": n} for tm, n in sorted(counts.items())
        ],
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


def overview(items: list[Item], s: Settings, sc: Scope) -> dict:
    scoped = scope(items, sc)
    evs = _evs(scoped, s)
    active = [e for e in evs if not e.stop]
    return {
        "today": s.today.isoformat(),
        "split": s.split,
        "ru_days": {c: s.norms.ru(c) for c in CATEGORIES},
        "ru_warn": s.norms.get("ru_warn"),
        "filters": filters(items),
        "categories": _category_counts(scope(items, Scope(
            year=sc.year, tms=sc.tms,
        ))),
        "in_work": len(active),
        "kpis": kpis(active, s),
        "stages": _stage_block(active, s, sc.cat),
        "durations": _durations([e.item for e in active]),
        "ru_due": _ru_due(active),
        "funnel": _funnel(active),
        "months": _months(active, s),
        "stopped": sum(e.stop for e in evs),
    }


def checks(items: list[Item], s: Settings, sc: Scope) -> dict:
    active = [e for e in _evs(scope(items, sc), s) if not e.stop]
    rows = _check_rows(active)
    return {"count": len(rows), "items": rows}


def _variant(e: Ev) -> dict:
    item = e.item
    return {
        "id": item.id,
        "generic": item.generic,
        "form": item.form,
        "dose": item.dose,
        "pack": item.pack,
        "group": "stop" if e.stop else e.group,
    }


def _groups(evs: list[Ev], key) -> list[dict]:
    by_group: dict[str, dict[str, list[Ev]]] = defaultdict(
        lambda: defaultdict(list),
    )
    for e in evs:
        by_group[key(e)][e.item.tm].append(e)
    out = []
    for name, products_ in by_group.items():
        rows = []
        for tm, variants in sorted(products_.items()):
            head = variants[0].item
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


def month(items: list[Item], s: Settings, key: str, sc: Scope) -> dict:
    picked = [
        e for e in _evs(scope(items, sc), s)
        if not e.stop and _bucket(e, s) == key
    ]
    return {"month": key, "count": len(picked), "groups": _groups(
        picked, lambda e: e.item.manufacturer or "Без производителя",
    )}


def stops(items: list[Item], s: Settings, sc: Scope) -> dict:
    stopped = [e for e in _evs(scope(items, sc), s) if e.stop]
    return {"count": len(stopped), "groups": _groups(
        stopped, lambda e: (e.item.comment or NO_REASON).strip(),
    )}


def _row(e: Ev) -> dict:
    item = e.item
    return {
        "id": item.id,
        "tm": item.tm,
        "generic": item.generic,
        "form": item.form,
        "dose": item.dose,
        "pack": item.pack,
        "manufacturer": item.manufacturer,
        "category": item.category,
        "is_new": item.is_new,
        "manager": e.manager,
        "group": "stop" if e.stop else e.group,
        "status_code": item.status_code,
        "status_by_date": e.status.by_date,
        "status_issue": e.status.issue is not None,
        "plan_submit": _iso(item.plan_submit),
        "submitted": _iso(item.submitted),
        "delay": e.delay.out(),
        "cycle": e.cycle.out(),
        "ru": e.ru.out(),
        "checks": len(e.checks),
    }


def _order(e: Ev) -> tuple:
    item = e.item
    if e.stop:
        return (3, date.max, item.tm)
    if item.submitted:
        return (0, item.submitted, item.tm)
    if item.plan_submit:
        return (1, item.plan_submit, item.tm)
    return (2, date.max, item.tm)


def _in_view(e: Ev, view: str) -> bool:
    if view == "stop":
        return e.stop
    if e.stop:
        return False
    if view == "red_cycle":
        return e.cycle.tone == RED
    if view == "red_ru":
        return not e.ru.got and e.ru.tone == RED
    return not view or e.group == view


def product_evs(
    items: list[Item], s: Settings, view: str | None, q: str | None,
    cat: str | None, mgr: str | None,
) -> tuple[dict, list[dict], list[Ev]]:
    scoped = scope(items, Scope(cat=cat))
    if q:
        needle = q.casefold().strip()
        scoped = [
            i for i in scoped
            if any(
                needle in (v or "").casefold()
                for v in (i.tm, i.tm_ru, i.generic, i.manufacturer)
            )
        ]
    evs = _evs(scoped, s)
    names: dict[str, int] = defaultdict(int)
    for e in evs:
        if not e.stop:
            names[e.manager or NO_MANAGER] += 1
    if mgr:
        evs = [e for e in evs if (e.manager or NO_MANAGER) == mgr]
    counts = {v: sum(_in_view(e, v) for e in evs) for v in ("", *VIEWS)}
    picked = sorted(
        (e for e in evs if _in_view(e, view or "")), key=_order,
    )
    managers = [
        {"name": n, "count": c}
        for n, c in sorted(names.items(), key=lambda x: (-x[1], x[0]))
    ]
    return counts, managers, picked


def products(
    items: list[Item], s: Settings, view: str | None, q: str | None,
    cat: str | None, mgr: str | None,
) -> dict:
    counts, managers, picked = product_evs(items, s, view, q, cat, mgr)
    return {
        "counts": counts,
        "managers": managers,
        "items": [_row(e) for e in picked],
    }


def _steps(e: Ev, s: Settings) -> list[dict]:
    item = e.item
    total = e.spans["e1"].fact is None and e.spans["e23"].fact is None
    out = []
    for key, name, codes, attr, code in CARD_STEPS:
        value = getattr(item, attr)
        if code is None:
            sp = Span(None, None, GRN if value else NA)
            label_total = False
        elif code == "e23" and total:
            sp = e.spans["t1"]
            label_total = True
        else:
            sp = e.spans[code]
            label_total = False
        out.append({
            "key": key, "name": name, "codes": codes, "date": _iso(value),
            "total": label_total, **sp.out(),
        })
    return out


def product(item: Item, s: Settings) -> dict:
    e = evaluate(item, s)
    shift = None
    if item.submitted and item.plan_submit:
        shift = (item.submitted - item.plan_submit).days
    return {
        **_row(e),
        "tm_ru": item.tm_ru,
        "owner": item.owner,
        "applicant": item.applicant,
        "status_label": next(
            (lbl for c, _, lbl in st.BY_DATE if c == e.status.by_date),
            None,
        ),
        "shift": shift,
        "ru_term": s.norms.ru(item.category),
        "steps": _steps(e, s),
        "dossier_req": _iso(item.dossier_req),
        "dossier_analysis": _iso(item.dossier_analysis),
        "reason_code": item.reason_code,
        "next_step": item.next_step,
        "step_due": _iso(item.step_due),
        "step_overdue": bool(item.step_due and item.step_due < s.today),
        "comments": [
            {"label": label, "text": getattr(item, attr)}
            for attr, label in COMMENTS if getattr(item, attr)
        ],
        "docs": [
            {"name": name, "ok": bool(item.docs_mask & (1 << i))}
            for i, name in enumerate(DOCS)
        ],
        "sheet": item.sheet,
        "row": item.row_no,
    }
