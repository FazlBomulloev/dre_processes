from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import func, select

from backend import config, database
from backend.models import VpcOffer

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / (
    "vpc_export_example.xlsx"
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _upload(client, path: Path = EXAMPLE, name: str | None = None):
    with open(path, "rb") as f:
        return await client.post(
            "/api/imports/vpc",
            files={"file": (name or path.name, f.read(), XLSX)},
        )


async def _offers(import_id: int) -> int:
    async with database.state.session() as db:
        return (await db.execute(
            select(func.count()).select_from(VpcOffer)
            .where(VpcOffer.import_id == import_id)
        )).scalar_one()


async def test_upload_example(env):
    await env.user("boss", "admin")
    admin = await env.login("boss")
    response = await _upload(admin)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["rows"] == 240
    assert data["is_current"] is True
    assert data["report"]["unknown_total"] == 0
    assert data["report"]["new_markets"] == []
    assert await _offers(data["id"]) == 240
    stored = config.UPLOAD_DIR / "vpc" / f"{data['id']}.xlsx"
    assert stored.exists()
    assert not any((config.UPLOAD_DIR / "tmp").iterdir())


async def test_switch_current_and_delete(env):
    admin_id = await env.user("boss", "admin")
    assert admin_id
    admin = await env.login("boss")
    first = (await _upload(admin)).json()
    second = (await _upload(admin)).json()
    listing = (await admin.get("/api/imports?kind=vpc")).json()
    assert [i["is_current"] for i in listing] == [True, False]

    back = await admin.post(f"/api/imports/{first['id']}/current")
    assert back.status_code == 200
    listing = (await admin.get("/api/imports")).json()
    current = [i["id"] for i in listing if i["is_current"]]
    assert current == [first["id"]]

    assert (await admin.delete(
        f"/api/imports/{first['id']}",
    )).status_code == 403
    owner = await env.owner()
    response = await owner.delete(f"/api/imports/{first['id']}")
    assert response.json() == {"ok": True, "current": second["id"]}
    assert await _offers(first["id"]) == 0
    assert not (config.UPLOAD_DIR / "vpc" / f"{first['id']}.xlsx").exists()


async def test_upload_permissions(env):
    await env.user("ann", "analyst")
    await env.user("bob", "analyst", grants=["upload:vpc"])
    await env.user("max", "manager")
    for name in ("ann", "max"):
        client = await env.login(name)
        assert (await _upload(client)).status_code == 403
        assert (await client.get("/api/imports")).status_code == 403
    bob = await env.login("bob")
    assert (await _upload(bob)).status_code == 200


async def test_bad_files(env, tmp_path):
    owner = await env.owner()
    text = tmp_path / "x.xlsx"
    text.write_text("not excel", encoding="utf-8")
    assert (await _upload(owner, text)).status_code == 400
    assert (await _upload(owner, EXAMPLE, "x.csv")).status_code == 400
    wb = Workbook()
    wb.active.append(["Дженерик"])
    wb.active.append(["X"])
    broken = tmp_path / "noheader.xlsx"
    wb.save(broken)
    response = await _upload(owner, broken)
    assert response.status_code == 400
    assert "Статус Пд" in response.json()["detail"]
    assert (await owner.get("/api/imports")).json() == []


async def test_new_target_creates_market(env, tmp_path):
    wb = Workbook()
    ws = wb.active
    ws.append(["Дженерик", "Проиводитель", "Страна поиска", "Статус Пд"])
    ws.append(["X", "ACME", "AM", "АЦ"])
    path = tmp_path / "am.xlsx"
    wb.save(path)
    owner = await env.owner()
    response = await _upload(owner, path)
    assert response.json()["report"]["new_markets"] == ["AM"]
    market = (await owner.get("/api/markets/AM")).json()
    assert market["name"] == "Армения"


async def test_keeps_limited_snapshots(env, monkeypatch):
    monkeypatch.setattr(config, "VPC_KEEP_SNAPSHOTS", 2)
    owner = await env.owner()
    ids = [(await _upload(owner)).json()["id"] for _ in range(3)]
    listing = (await owner.get("/api/imports")).json()
    assert [i["id"] for i in listing] == [ids[2], ids[1]]
    assert await _offers(ids[0]) == 0
