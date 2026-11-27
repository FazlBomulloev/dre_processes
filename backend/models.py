from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Market(Base):
    __tablename__ = "markets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(8), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    enabled_vpc_market = Column(Boolean, nullable=False, default=False)
    enabled_rgs = Column(Boolean, nullable=False, default=False)
    settings_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(128), nullable=False)
    password_salt = Column(String(64), nullable=False)
    role = Column(String(32), nullable=False, default="viewer")
    is_active = Column(Boolean, nullable=False, default=True)
    own_only = Column(Boolean, nullable=False, default=False)
    source_names = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    last_login_at = Column(DateTime, nullable=True)


class UserSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    token_hash = Column(
        String(64), nullable=False, unique=True, index=True,
    )
    created_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False, index=True)


class UserMarket(Base):
    __tablename__ = "user_markets"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    market_id = Column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"),
        primary_key=True, index=True,
    )


class UserPermission(Base):
    __tablename__ = "user_permissions"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission = Column(String(64), primary_key=True)


class Import(Base):
    __tablename__ = "imports"

    id = Column(Integer, primary_key=True)
    kind = Column(String(8), nullable=False, index=True)
    market_id = Column(Integer, nullable=True, index=True)
    file_name = Column(String(300), nullable=False)
    stored_name = Column(String(100), nullable=True)
    data_date = Column(Date, nullable=True)
    rows = Column(Integer, nullable=False, default=0)
    report_json = Column(Text, nullable=True)
    uploaded_by = Column(Integer, nullable=True)
    uploaded_by_name = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, nullable=False, default=utcnow)
    is_current = Column(Boolean, nullable=False, default=False, index=True)


class VpcOffer(Base):
    __tablename__ = "vpc_offers"

    id = Column(Integer, primary_key=True)
    import_id = Column(
        Integer, ForeignKey("imports.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    offer_no = Column(String(40), nullable=True)
    generic = Column(String(300), nullable=False)
    form = Column(String(200), nullable=True)
    dose = Column(String(200), nullable=True)
    pack_raw = Column(String(300), nullable=True)
    pack_n = Column(Integer, nullable=True)
    maker = Column(String(300), nullable=True)
    maker_country = Column(String(100), nullable=True)
    maker_category = Column(String(20), nullable=True)
    target_country = Column(String(8), nullable=True, index=True)
    zone = Column(String(20), nullable=True)
    status_raw = Column(String(40), nullable=True)
    status_code = Column(String(12), nullable=True)
    stage = Column(String(8), nullable=True)
    state = Column(String(16), nullable=False, index=True)
    status_date = Column(DateTime, nullable=True)
    deadline = Column(String(40), nullable=True)
    bdm = Column(String(200), nullable=True)
    analyst = Column(String(200), nullable=True)
    price_usd = Column(Float, nullable=True)
    price_agreed = Column(Float, nullable=True)
    price_our1 = Column(Float, nullable=True)
    price_our2 = Column(Float, nullable=True)
    price_final = Column(Float, nullable=True)
    price_src = Column(String(16), nullable=True)
    currency = Column(String(8), nullable=True)
    forecast_y1 = Column(Float, nullable=True)
    forecast_y2 = Column(Float, nullable=True)
    forecast_y3 = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    last_comment = Column(Text, nullable=True)
    last_comment_date = Column(DateTime, nullable=True)
    comments = Column(Text, nullable=True)
    stage_dates_json = Column(Text, nullable=True)
    extra_json = Column(Text, nullable=True)


class RgsItem(Base):
    __tablename__ = "rgs_items"

    id = Column(Integer, primary_key=True)
    import_id = Column(
        Integer, ForeignKey("imports.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    sheet = Column(String(40), nullable=True)
    row_no = Column(Integer, nullable=True)
    erp_id = Column(String(60), nullable=True)
    tm = Column(String(300), nullable=False)
    tm_ru = Column(String(300), nullable=True)
    generic = Column(String(500), nullable=True)
    form = Column(String(200), nullable=True)
    dose = Column(String(300), nullable=True)
    pack = Column(String(300), nullable=True)
    category = Column(String(16), nullable=True)
    owner = Column(String(100), nullable=True)
    manufacturer = Column(String(300), nullable=True)
    applicant = Column(String(300), nullable=True)
    status_code = Column(String(16), nullable=True)
    group_code = Column(String(100), nullable=True)
    is_new = Column(Boolean, nullable=False, default=False)
    task_date = Column(Date, nullable=True)
    dossier_req = Column(Date, nullable=True)
    dossier_analysis = Column(Date, nullable=True)
    dossier_ready = Column(Date, nullable=True)
    sent_registrar = Column(Date, nullable=True)
    submitted = Column(Date, nullable=True)
    plan_submit = Column(Date, nullable=True)
    ru_date = Column(Date, nullable=True)
    exp1_invoice = Column(Date, nullable=True)
    exp1_paid = Column(Date, nullable=True)
    exp2_invoice = Column(Date, nullable=True)
    exp2_paid = Column(Date, nullable=True)
    step_due = Column(Date, nullable=True)
    next_step = Column(Text, nullable=True)
    reason_code = Column(String(100), nullable=True)
    docs_mask = Column(Integer, nullable=False, default=0)
    comment = Column(Text, nullable=True)
    comment_iz = Column(Text, nullable=True)
    comment_bdm = Column(Text, nullable=True)
    extra_json = Column(Text, nullable=True)


class RgsPlanMove(Base):
    __tablename__ = "rgs_plan_moves"

    id = Column(Integer, primary_key=True)
    market_id = Column(
        Integer, ForeignKey("markets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    import_id = Column(Integer, nullable=False, index=True)
    at = Column(Date, nullable=False)
    key = Column(String(400), nullable=False, index=True)
    tm = Column(String(300), nullable=False)
    owner = Column(String(100), nullable=True)
    old = Column(Date, nullable=False)
    new = Column(Date, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    at = Column(DateTime, nullable=False, default=utcnow, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    username = Column(String(100), nullable=True)
    action = Column(String(64), nullable=False, index=True)
    market_id = Column(Integer, nullable=True, index=True)
    details_json = Column(Text, nullable=True)
