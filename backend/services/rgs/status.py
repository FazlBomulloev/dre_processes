import re

ORDER = {
    "d": 1, "da": 2, "db": 3, "dbo": 4, "dc": 5, "dca": 6, "dcb": 7,
    "dcc": 8, "dct": 9, "dcz": 10, "dh": 11, "dha": 12, "dhb": 13,
    "dhi": 14, "dhp": 15, "dhp1": 15, "dhp2": 16, "r": 17,
}
OWN_DATE = frozenset({"dcz", "dh", "dha", "dhp1", "dhp2", "r"})
SPLIT_CODES = frozenset({"dcz", "dh"})
FLOATING = frozenset({"dhi", "dhp"})
PREFIXES = ("s", "w", "y")
GROUPS = (
    ("prep", "Комплектация", "d…dcz"),
    ("submit", "Подача", "dh, dha"),
    ("exp1", "1-я экспертиза оплачена", "dhp1"),
    ("exp2", "2-я экспертиза оплачена", "dhp2"),
    ("ru", "Зарегистрировано", "r"),
)
GROUP_KEYS = tuple(k for k, _, _ in GROUPS)
BY_DATE = (
    ("r", "ru_date", "РУ получено"),
    ("dhp2", "exp2_paid", "2-я экспертиза оплачена"),
    ("dhp1", "exp1_paid", "1-я экспертиза оплачена"),
    ("dha", "submitted", "подано в Минздрав"),
    ("dh", "sent_registrar", "отправлено регистратору"),
    ("dcz", "dossier_ready", "досье готово"),
    ("d", "task_date", "задача получена"),
)
_DB = re.compile(r"^db[a-d]?$")
_DBO = re.compile(r"^dbo[a-d]?$")


def _plain(code: str) -> str | None:
    if code in ORDER:
        return code
    if _DBO.match(code):
        return "dbo"
    if _DB.match(code):
        return "db"
    return None


def base(code: str | None) -> str | None:
    if not code:
        return None
    plain = _plain(code)
    if plain is None and code[0] in PREFIXES:
        plain = _plain(code[1:])
    return plain


def known_status(code: str | None) -> bool:
    return not code or base(code) is not None


def rank(code: str | None, exp1_paid) -> int | None:
    plain = base(code)
    if plain is None:
        return None
    if plain in FLOATING and exp1_paid is not None:
        return ORDER["dhp2"]
    return ORDER[plain]


def group_of(rank_value: int | None) -> str | None:
    if rank_value is None:
        return None
    if rank_value <= 10:
        return "prep"
    if rank_value <= 13:
        return "submit"
    if rank_value <= 15:
        return "exp1"
    if rank_value == 16:
        return "exp2"
    return "ru"


def by_dates(item) -> tuple[str, str, object] | None:
    for code, attr, label in BY_DATE:
        value = getattr(item, attr, None)
        if value is not None:
            return code, label, value
    return None
