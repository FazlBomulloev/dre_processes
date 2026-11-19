from backend.tests.conftest import OWNER, PASSWORD


async def test_first_owner_from_env(env):
    client = await env.owner()
    data = (await client.get("/api/auth/session")).json()["user"]
    assert data["username"] == OWNER
    assert data["role"] == "owner"
    assert data["permissions"] == ["*"]
    assert data["markets"] is None


async def test_wrong_password_is_logged(env):
    client = env.client()
    response = await client.post(
        "/api/auth/login", json={"username": OWNER, "password": "nope"},
    )
    assert response.status_code == 401
    owner = await env.owner()
    audit = (await owner.get("/api/audit?action=login_failed")).json()
    assert audit["total"] == 1
    assert audit["items"][0]["username"] == OWNER


async def test_session_without_cookie_is_empty(env):
    client = env.client()
    response = await client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json() == {"user": None}
    assert (await client.get("/api/markets")).status_code == 401


async def test_logout_closes_session(env):
    await env.user("ann", "viewer")
    client = await env.login("ann")
    assert (await client.get("/api/markets")).status_code == 200
    await client.post("/api/auth/logout")
    assert (await client.get("/api/markets")).status_code == 401


async def test_inactive_user_cannot_login(env):
    await env.user("ann", "viewer", active=False)
    response = await env.client().post(
        "/api/auth/login", json={"username": "ann", "password": PASSWORD},
    )
    assert response.status_code == 401


async def test_password_change_drops_other_sessions(env):
    await env.user("ann", "viewer")
    first = await env.login("ann")
    second = await env.login("ann")
    wrong = await first.post("/api/auth/password", json={
        "old_password": "bad", "new_password": "new-password",
    })
    assert wrong.status_code == 400
    ok = await first.post("/api/auth/password", json={
        "old_password": PASSWORD, "new_password": "new-password",
    })
    assert ok.status_code == 200
    assert (await first.get("/api/markets")).status_code == 200
    assert (await second.get("/api/markets")).status_code == 401
    await env.login("ann", "new-password")
