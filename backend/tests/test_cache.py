from backend.routers import rgs, vpc
from backend.services import prewarm
from backend.tests import test_rgs
from backend.tests.test_vpc_api import EXAMPLE, XLSX, _loaded


async def test_vpc_response_cached(env):
    owner = await _loaded(env)
    first = await owner.get("/api/vpc/overview")
    assert first.status_code == 200
    filled = len(vpc.CACHE)
    second = await owner.get("/api/vpc/overview")
    assert second.json() == first.json()
    assert len(vpc.CACHE) == filled


async def test_upload_resets_cache(env):
    owner = await _loaded(env)
    await owner.get("/api/vpc/overview")
    assert len(vpc.CACHE) > 0
    with open(EXAMPLE, "rb") as f:
        response = await owner.post(
            "/api/imports/vpc",
            files={"file": (EXAMPLE.name, f.read(), XLSX)},
        )
    assert response.status_code == 200
    assert len(vpc.CACHE) == 0
    meta = (await owner.get("/api/vpc/meta")).json()
    assert meta["import_id"] == response.json()["id"]


async def test_cache_respects_market_scope(env):
    owner = await _loaded(env)
    full = (await owner.get("/api/vpc/offers?limit=200")).json()
    await env.user(
        "ann", "analyst", markets=["AZ"], grants=["module:vpc"],
    )
    analyst = await env.login("ann")
    own = (await analyst.get("/api/vpc/offers?limit=200")).json()
    assert own["total"] == 91
    assert own["total"] < full["total"]
    again = (await owner.get("/api/vpc/offers?limit=200")).json()
    assert again["total"] == full["total"]


async def test_prewarm_fills_cache(env):
    owner = await _loaded(env)
    await test_rgs._loaded(env)
    prewarm.invalidate()
    await prewarm.prewarm_all()
    warmed = len(vpc.CACHE)
    assert warmed > 0
    assert len(rgs.CACHE) > 0
    params = {"priced": "false", "price": "usd", "active": "false"}
    for url, query in (
        ("/api/vpc/overview", {}),
        ("/api/vpc/countries", {"mode": "target"}),
        ("/api/vpc/funnel", {"period": "12"}),
        ("/api/vpc/factories", {
            "period": "all", "sort": "offers", "limit": "2000",
        }),
        ("/api/vpc/offers", params),
        ("/api/vpc/facets", params),
        ("/api/vpc/overview", {"target": "AZ"}),
    ):
        assert (await owner.get(url, params=query)).status_code == 200
    assert len(vpc.CACHE) == warmed
    rgs_warmed = len(rgs.CACHE)
    assert (await owner.get("/api/rgs/AZ/overview")).status_code == 200
    assert (await owner.get("/api/rgs/AZ/products")).status_code == 200
    assert len(rgs.CACHE) == rgs_warmed
