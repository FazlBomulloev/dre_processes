import re
from collections.abc import Sequence

_SPACES = re.compile(r"\s+")

DOCS = ("Dossier", "Artwork", "Leaflet", "CPP/FSC", "Sample", "WS", "COA")

FIELDS: dict[str, tuple[str, ...]] = {
    "tm": ("TM ENG",),
    "tm_ru": ("TM RUS", "TM RUSS"),
    "generic": ("GENERIC",),
    "form": ("FORM",),
    "dose": ("DOSAGE", "DOSE"),
    "pack": ("PACK",),
    "category": ("CATEGORY",),
    "owner": ("ОЛ (ФИО)",),
    "manufacturer": ("MFG",),
    "applicant": ("PARTY",),
    "status_code": ("статус",),
    "group_code": ("Упр Ктг",),
    "is_new": ("IN (новый)",),
    "task_date": ("Дата получ. задачи", "1. Дата Получ Зч по почте"),
    "dossier_req": ("ЗД (запрос досье)", "ЗД"),
    "dossier_analysis": ("АД (анализ досье)", "АД"),
    "submitted_may": ("Подано в ГНЦЛ",),
    "submitted_fact": ("ПД",),
    "plan_submit": ("План подачи (май)", "План подача"),
    "plan_ru": ("План получение РУ",),
    "plan_ru_shifted": ("План получения РУ (май)",),
    "ru_date": ("РУ",),
    "exp1_invoice": (
        "Первичная экспертиза: инвойс",
        "Premilinary Expertise / Invoice receipt date",
        "Preliminary Expertise / Invoice receipt date",
    ),
    "exp1_paid": (
        "Первичная экспертиза: оплата",
        "Premilinary Expertise / Payment",
        "Preliminary Expertise / Payment",
    ),
    "exp2_invoice": (
        "Специализированная экспертиза: инвойс",
        "Specilized Expertise / Invoice receipt date",
        "Specialized Expertise / Invoice receipt date",
    ),
    "exp2_paid": (
        "Специализированная экспертиза: оплата",
        "Specilized Expertise / Payment",
        "Specialized Expertise / Payment",
    ),
    "comment": ("Комментарий", "JS / IZ (Comments)"),
    **{f"doc_{i}": (name,) for i, name in enumerate(DOCS)},
}
REQUIRED = ("tm",)
DATE_FIELDS = (
    "task_date", "dossier_req", "dossier_analysis", "submitted_may",
    "submitted_fact", "plan_submit", "plan_ru", "plan_ru_shifted",
    "ru_date",
    "exp1_invoice", "exp1_paid", "exp2_invoice", "exp2_paid",
)


def norm(value) -> str:
    text = _SPACES.sub(" ", str(value)).strip().casefold()
    return text.replace("ı", "i")


def _text(value) -> str | None:
    if value is None:
        return None
    text = _SPACES.sub(" ", str(value)).strip()
    return text or None


def find_header(
    rows: Sequence[Sequence], aliases: Sequence[str],
) -> int | None:
    keys = {norm(a) for a in aliases}
    for i, row in enumerate(rows):
        if any(v is not None and norm(v) in keys for v in row):
            return i
    return None


def column_names(
    above: Sequence | None, main: Sequence, below: Sequence | None,
) -> list[str | None]:
    width = max(len(main), len(above or ()), len(below or ()))

    def at(row: Sequence | None, j: int):
        return _text(row[j]) if row is not None and j < len(row) else None

    names: list[str | None] = []
    for j in range(width):
        mid = at(main, j)
        sub = at(below, j)
        if mid:
            names.append(mid)
        elif sub:
            parent = next(
                (at(above, k) for k in range(j, -1, -1) if at(above, k)),
                None,
            )
            names.append(f"{parent} / {sub}" if parent else sub)
        else:
            names.append(at(above, j))
    return names


def resolve(
    names: Sequence[str | None], overrides: dict[str, list[str]],
) -> dict[str, int]:
    index: dict[str, int] = {}
    for j, name in enumerate(names):
        if name:
            index.setdefault(norm(name), j)
    out: dict[str, int] = {}
    for field, aliases in FIELDS.items():
        for alias in (*overrides.get(field, ()), *aliases):
            j = index.get(norm(alias))
            if j is not None:
                out[field] = j
                break
    return out
