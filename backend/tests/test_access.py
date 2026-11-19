async def test_analyst_sees_only_assigned_markets(env):
    await env.user("ann", "analyst", markets=["AZ"])
    analyst = await env.login("ann")
    codes = [m["code"] for m in (await analyst.get("/api/markets")).json()]
    assert codes == ["AZ"]
    assert (await analyst.get("/api/markets/az")).status_code == 200
    assert (await analyst.get("/api/markets/KZ")).status_code == 404
    assert (await analyst.get("/api/markets/XX")).status_code == 404


async def test_default_markets(env):
    owner = await env.owner()
    markets = {m["code"]: m for m in (await owner.get("/api/markets")).json()}
    assert set(markets) == {"AZ", "KZ", "RU", "UZ", "KG", "GE"}
    assert markets["AZ"]["enabled_rgs"] is True
    assert markets["KZ"]["enabled_vpc_market"] is False


async def test_only_owner_creates_markets(env):
    await env.user("boss", "admin")
    admin = await env.login("boss")
    body = {"code": "am", "name": "Армения"}
    assert (await admin.post("/api/markets", json=body)).status_code == 403
    owner = await env.owner()
    created = await owner.post("/api/markets", json=body)
    assert created.status_code == 200
    assert created.json()["code"] == "AM"
    assert (await owner.post("/api/markets", json=body)).status_code == 400


async def test_market_update_needs_write(env):
    await env.user("boss", "admin")
    await env.user("ann", "analyst", markets=["KZ"])
    admin = await env.login("boss")
    analyst = await env.login("ann")
    body = {"enabled_rgs": True}
    assert (await analyst.patch(
        "/api/markets/KZ", json=body,
    )).status_code == 403
    response = await admin.patch("/api/markets/KZ", json=body)
    assert response.status_code == 200
    assert response.json()["enabled_rgs"] is True
    owner = await env.owner()
    audit = (await owner.get("/api/audit?action=market_update")).json()
    assert audit["items"][0]["market_code"] == "KZ"


async def test_audit_only_for_owner(env):
    await env.user("boss", "admin")
    admin = await env.login("boss")
    assert (await admin.get("/api/audit")).status_code == 403
    owner = await env.owner()
    assert (await owner.get("/api/audit")).json()["total"] >= 2
