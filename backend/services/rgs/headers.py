import re
from collections.abc import Sequence

_SPACES = re.compile(r"\s+")

DOCS = ("Dossier", "Artwork", "Leaflet", "CPP/FSC", "Sample", "WS", "COA")

FIELDS: dict[str, tuple[str, ...]] = {
    "tm": ("TM ENG",),
    "erp_id": ("ERP-ID", "ERP ID"),
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
    "task_date": ("1. Дата Получ Зч по почте", "Дата получ. задачи"),
    "dossier_req": ("ЗД", "ЗД (запрос досье)"),
    "dossier_analysis": ("АД", "АД (анализ досье)"),
    "dossier_ready": ("dcz: досье готово", "dcz", "Досье готово"),
    "sent_registrar": (
        "dh: отправлено регистратору", "dh", "Отправлено регистратору",
    ),
    "plan_submit": ("Пл ПД", "План подачи (май)"),
    "submitted": ("ПД", "Подано в ГНЦЛ"),
    "ru_date": ("РУ",),
    "exp1_invoice": (
        "Premilinary Expertise / Invoice receipt date",
        "Preliminary Expertise / Invoice receipt date",
        "Первичная экспертиза: инвойс",
    ),
    "exp1_paid": (
        "Premilinary Expertise / Payment",
        "Preliminary Expertise / Payment",
        "Первичная экспертиза: оплата",
    ),
    "exp2_invoice": (
        "Specilized Expertise / Invoice receipt date",
        "Specialized Expertise / Invoice receipt date",
        "Специализированная экспертиза: инвойс",
    ),
    "exp2_paid": (
        "Specilized Expertise / Payment",
        "Specialized Expertise / Payment",
        "Специализированная экспертиза: оплата",
    ),
    "next_step": ("Следующий шаг",),
    "step_due": ("Срок шага",),
    "reason_code": ("Код причины",),
    "comment": ("JS / IZ (Comments)", "Комментарий"),
    "comment_iz": ("Комментарии ИЗ и ЧС",),
    "comment_bdm": ("Комментарии БДМ",),
    **{f"doc_{i}": (name,) for i, name in enumerate(DOCS)},
}
REQUIRED = ("tm",)
DATE_FIELDS = (
    "task_date", "dossier_req", "dossier_analysis", "dossier_ready",
    "sent_registrar", "plan_submit", "submitted", "ru_date",
    "exp1_invoice", "exp1_paid", "exp2_invoice", "exp2_paid", "step_due",
)
OPTIONAL = (
    "dossier_ready", "sent_registrar", "next_step", "step_due",
    "reason_code",
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
