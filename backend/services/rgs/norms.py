from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from backend.services.rgs.headers import norm

SHEET = "Нормативы"
CATEGORIES = ("M", "FS", "MD")

DEFAULTS: dict[str, int] = {
    "e1": 83, "e2": 3, "e3": 4, "e4": 37, "e5": 67,
    "d1": 0, "d1_red": 30,
    "ru_m": 560, "ru_fs": 330, "ru_md": 330, "ru_warn": 60,
    "k1_goal": 85, "k1_red": 70,
    "k3_goal": 0, "k3_red": 30,
    "k4_goal": 0, "k4_red": 2,
    "k5_goal": 70, "k5_red": 50,
    "k6_goal": 100, "k6_red": 90,
}
DERIVED = ("k2_goal", "k2_red")
KNOWN = frozenset((*DEFAULTS, *DERIVED))
_WORDS = (("ру_", "ru_"), ("_цель", "_goal"), ("_красный", "_red"))
_LATIN = str.maketrans({"е": "e", "к": "k", "д": "d", "м": "m"})


def red_at(value: int) -> int:
    return (3 * value + 1) // 2


def key(raw) -> str:
    text = norm(raw).replace(" ", "_")
    for ru, en in _WORDS:
        text = text.replace(ru, en)
    return text.translate(_LATIN)


@dataclass(frozen=True)
class Norms:
    values: dict[str, int] = field(default_factory=lambda: dict(DEFAULTS))

    def get(self, name: str) -> int:
        return self.values.get(name, DEFAULTS.get(name, 0))

    @property
    def t1(self) -> int:
        return self.get("e1") + self.get("e2") + self.get("e3")

    def ru(self, category: str | None) -> int | None:
        if category not in CATEGORIES:
            return None
        return self.get(f"ru_{category.casefold()}")

    def stage(self, code: str, category: str | None = None) -> int | None:
        if code == "t1":
            return self.t1
        if code == "e23":
            return self.get("e2") + self.get("e3")
        if code == "e6":
            total = self.ru(category or "M")
            if total is None:
                return None
            return total - self.t1 - self.get("e4") - self.get("e5")
        return self.get(code)

    def kpi(self, number: int) -> tuple[int, int]:
        if number == 2:
            goal = self.values.get("k2_goal", self.t1)
            return goal, self.values.get("k2_red", red_at(goal))
        return self.get(f"k{number}_goal"), self.get(f"k{number}_red")


def _number(value) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return round(value)
    text = str(value).strip().replace(",", ".").rstrip("%").strip()
    try:
        return round(float(text))
    except ValueError:
        return None


def parse(rows: Iterable[Sequence]) -> dict[str, int]:
    out: dict[str, int] = {}
    for row in rows:
        cells = [v for v in row if v is not None and str(v).strip()]
        if len(cells) < 2:
            continue
        name = key(cells[0])
        if name not in KNOWN:
            continue
        value = _number(cells[1])
        if value is not None:
            out[name] = value
    return out


def from_values(values: dict | None) -> Norms:
    merged = dict(DEFAULTS)
    for name, value in (values or {}).items():
        if name in KNOWN and isinstance(value, int):
            merged[name] = value
    return Norms(merged)
