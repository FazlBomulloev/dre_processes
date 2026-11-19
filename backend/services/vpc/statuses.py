from dataclasses import dataclass

from backend import config

WORK = "work"
CONTRACT = "contract"
RESULT = "result"
STOP = "stop"
UNKNOWN = "unknown"

STATES = (WORK, CONTRACT, RESULT, STOP, UNKNOWN)

NOT_IN_PORTFOLIO = "NКк"

STAGES = ("Вб", "ПО", "АЦ", "ПцКк", "Кк", "ПцР", "Р", "Р-", "За")

STAGE_NAMES = {
    "Вб": "Выборка",
    "ПО": "Прогноз объёма",
    "АЦ": "Анализ цен",
    "ПцКк": "Процесс контракта",
    "Кк": "Контракт",
    "ПцР": "Процесс регистрации",
    "Р": "Получено РУ",
    "Р-": "Получено РУ (БАД, МИ)",
    "За": "Заявка",
}

_ALIASES = {"вп": "Вб", "зя": "За"}

_LOOKALIKES = str.maketrans({
    "A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К",
    "M": "М", "O": "О", "P": "Р", "T": "Т", "X": "Х",
    "a": "а", "c": "с", "e": "е", "k": "к", "o": "о", "p": "р",
    "x": "х", "y": "у", "b": "б",
})

_BY_KEY = {code.lower(): code for code in STAGES}
_BY_KEY.update(_ALIASES)

_STOP_PREFIX = ("s", "с")
_N_PREFIX = ("n", "н")


@dataclass(frozen=True)
class Status:
    code: str | None
    stage: str | None
    state: str


def _stage(text: str) -> str | None:
    key = text.translate(_LOOKALIKES).lower()
    return _BY_KEY.get(key)


def _work_state(stage: str) -> str:
    if stage == "Кк":
        return config.VPC_KK_GROUP if config.VPC_KK_GROUP in (
            WORK, CONTRACT, RESULT,
        ) else CONTRACT
    if stage in ("ПцР", "Р", "Р-", "За"):
        return RESULT
    return WORK


STAGE_ORDER = {code: i for i, code in enumerate(STAGES)}


def status_name(code: str | None, stage: str | None, state: str) -> str:
    if code == NOT_IN_PORTFOLIO:
        return "Контракт, не выбран для портфеля"
    name = STAGE_NAMES.get(stage or "", "")
    if state == STOP:
        return f"Стоп · {name.lower()}" if name else "Стоп"
    if state == UNKNOWN:
        return "Статус не распознан"
    return name or (code or "")


def status_rank(code: str | None) -> tuple[int, int]:
    if not code:
        return (99, 0)
    if code.startswith("S"):
        return (STAGE_ORDER.get(code[1:], 50), 1)
    if code.startswith("N"):
        return (STAGE_ORDER["Кк"], 2)
    return (STAGE_ORDER.get(code, 50), 0)


def parse_status(raw) -> Status:
    text = "".join(str(raw).split()) if raw is not None else ""
    if not text:
        return Status(None, None, UNKNOWN)
    stage = _stage(text)
    if stage is not None:
        return Status(stage, stage, _work_state(stage))
    head, rest = text[0].lower(), text[1:]
    if rest and head in _STOP_PREFIX:
        stage = _stage(rest)
        if stage is not None:
            return Status(f"S{stage}", stage, STOP)
    if head in _N_PREFIX and _stage(rest) == "Кк":
        return Status(NOT_IN_PORTFOLIO, "Кк", CONTRACT)
    return Status(None, None, UNKNOWN)
