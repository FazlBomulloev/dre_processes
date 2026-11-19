from pydantic import BaseModel, Field

_USERNAME = r"^[A-Za-z0-9._@-]+$"
_CODE = r"^[A-Za-z]{2,3}$"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class PasswordChange(BaseModel):
    old_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class PasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=200)


class SessionOut(BaseModel):
    id: int
    username: str
    role: str
    permissions: list[str]
    markets: list[str] | None
    own_only: bool = False


class SessionEnvelope(BaseModel):
    user: SessionOut | None


class MarketOut(BaseModel):
    id: int
    code: str
    name: str
    enabled_vpc_market: bool
    enabled_rgs: bool


class MarketCreate(BaseModel):
    code: str = Field(pattern=_CODE)
    name: str = Field(min_length=1, max_length=200)
    enabled_vpc_market: bool = False
    enabled_rgs: bool = False


class MarketUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    enabled_vpc_market: bool | None = None
    enabled_rgs: bool | None = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    markets: list[str]
    grants: list[str]
    own_only: bool
    source_names: str | None
    created_at: str
    last_login_at: str | None


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=100, pattern=_USERNAME)
    password: str = Field(min_length=8, max_length=200)
    role: str
    markets: list[str] = []
    grants: list[str] = []
    own_only: bool = False
    source_names: str | None = Field(None, max_length=500)


class UserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    markets: list[str] | None = None
    grants: list[str] | None = None
    own_only: bool | None = None
    source_names: str | None = Field(None, max_length=500)


class ImportOut(BaseModel):
    id: int
    kind: str
    market_code: str | None
    file_name: str
    data_date: str | None
    rows: int
    uploaded_by: str | None
    uploaded_at: str
    is_current: bool
    report: dict | None = None


class AuditOut(BaseModel):
    id: int
    at: str
    username: str | None
    action: str
    market_code: str | None
    details: dict | None


class AuditPage(BaseModel):
    total: int
    items: list[AuditOut]
