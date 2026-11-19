from backend.tests.conftest import PASSWORD


def _new(username: str, role: str, **extra) -> dict:
    return {"username": username, "password": PASSWORD, "role": role,
            **extra}


async def test_admin_creates_analyst_with_grants(env):
    await env.user("boss", "admin")
    admin = await env.login("boss")
    response = await admin.post("/api/users", json=_new(
        "ann", "analyst", markets=["az"],
        grants=["module:rgs", "upload:rgs"],
    ))
    assert response.status_code == 200, response.text
    assert response.json()["markets"] == ["AZ"]

    analyst = await env.login("ann")
    me = (await analyst.get("/api/auth/session")).json()["user"]
    assert me["markets"] == ["AZ"]
    assert me["permissions"] == ["export:xlsx", "module:rgs", "upload:rgs"]


async def test_viewer_cannot_get_upload(env):
    owner = await env.owner()
    response = await owner.post("/api/users", json=_new(
        "ann", "viewer", grants=["upload:vpc"],
    ))
    assert response.status_code == 400


async def test_only_owner_manages_admins(env):
    await env.user("boss", "admin")
    await env.user("boss2", "admin")
    admin = await env.login("boss")
    assert (await admin.post(
        "/api/users", json=_new("new", "admin"),
    )).status_code == 403
    users = (await admin.get("/api/users")).json()
    other = next(u for u in users if u["username"] == "boss2")
    owner = next(u for u in users if u["role"] == "owner")
    for target in (other, owner):
        response = await admin.patch(
            f"/api/users/{target['id']}", json={"is_active": False},
        )
        assert response.status_code == 403

    root = await env.owner()
    assert (await root.post(
        "/api/users", json=_new("new", "admin"),
    )).status_code == 200
    assert (await root.post(
        "/api/users", json=_new("other", "owner"),
    )).status_code == 400


async def test_all_markets_role_ignores_list(env):
    owner = await env.owner()
    response = await owner.post("/api/users", json=_new(
        "boss", "manager", markets=["AZ"],
    ))
    assert response.json()["markets"] == []
    manager = await env.login("boss")
    markets = (await manager.get("/api/markets")).json()
    assert len(markets) == 6


async def test_role_change_trims_grants_and_drops_sessions(env):
    uid = await env.user(
        "ann", "analyst", markets=["AZ"],
        grants=["module:vpc", "upload:vpc"],
    )
    analyst = await env.login("ann")
    owner = await env.owner()
    response = await owner.patch(f"/api/users/{uid}", json={
        "role": "viewer",
    })
    assert response.status_code == 200
    assert response.json()["grants"] == ["module:vpc"]
    assert response.json()["markets"] == ["AZ"]
    assert (await analyst.get("/api/markets")).status_code == 401


async def test_validation_errors(env):
    owner = await env.owner()
    assert (await owner.post("/api/users", json=_new(
        "ann", "analyst", markets=["ZZ"],
    ))).status_code == 400
    assert (await owner.post(
        "/api/users", json=_new("ann", "analyst"),
    )).status_code == 200
    assert (await owner.post(
        "/api/users", json=_new("ann", "viewer"),
    )).status_code == 400


async def test_analyst_cannot_manage_users(env):
    await env.user("ann", "analyst")
    analyst = await env.login("ann")
    assert (await analyst.get("/api/users")).status_code == 403


async def test_delete_keeps_audit_username(env):
    uid = await env.user("ann", "viewer")
    await env.login("ann")
    owner = await env.owner()
    assert (await owner.delete(f"/api/users/{uid}")).status_code == 200
    audit = (await owner.get("/api/audit?action=login")).json()
    assert "ann" in {item["username"] for item in audit["items"]}


async def test_reset_password(env):
    uid = await env.user("ann", "viewer")
    old = await env.login("ann")
    owner = await env.owner()
    response = await owner.post(
        f"/api/users/{uid}/password", json={"password": "fresh-pass"},
    )
    assert response.status_code == 200
    assert (await old.get("/api/markets")).status_code == 401
    await env.login("ann", "fresh-pass")
