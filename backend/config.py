import os
from datetime import date
from pathlib import Path


def _flag(name: str, default: str = "") -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in ("1", "true", "yes", "on")


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = DATA_DIR / "evodash.db"
UPLOAD_DIR = DATA_DIR / "uploads"

DATABASE_URL = os.getenv(
    "DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH.as_posix()}",
)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
COOKIE_SECURE = _flag("COOKIE_SECURE")
SESSION_COOKIE = "evodash_session"
SESSION_DAYS = 30

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
]

VPC_KK_GROUP = os.getenv("VPC_KK_GROUP", "contract").strip()
VPC_KEEP_SNAPSHOTS = int(os.getenv("VPC_KEEP_SNAPSHOTS", "12"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))
PREWARM = _flag("PREWARM", "1")
RGS_KEEP_SNAPSHOTS = int(os.getenv("RGS_KEEP_SNAPSHOTS", "12"))
RGS_RU_MARGIN_MONTHS = int(os.getenv("RGS_RU_MARGIN_MONTHS", "2"))
RGS_PLAN_DATE = date.fromisoformat(
    os.getenv("RGS_PLAN_DATE", "2026-05-14"),
)


COUNTRY_NAMES = {
    "AZ": "Азербайджан", "KZ": "Казахстан", "RU": "Россия",
    "UZ": "Узбекистан", "KG": "Кыргызстан", "GE": "Грузия",
    "AM": "Армения", "BY": "Беларусь", "TJ": "Таджикистан",
    "TM": "Туркменистан", "MN": "Монголия", "MD": "Молдова",
    "UA": "Украина", "TR": "Турция", "PH": "Филиппины",
    "VN": "Вьетнам", "IQ": "Ирак", "IR": "Иран", "AF": "Афганистан",
}

DEFAULT_MARKETS = [
    ("AZ", "Азербайджан", True, True),
    ("KZ", "Казахстан", False, False),
    ("RU", "Россия", False, False),
    ("UZ", "Узбекистан", False, False),
    ("KG", "Кыргызстан", False, False),
    ("GE", "Грузия", False, False),
]
