import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.bootstrap import init_db
from backend.config import CORS_ORIGINS
from backend.routers import (
    audit, auth, imports, markets, rgs, users, vpc,
)
from backend.services.auth import require_user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Запуск EvoDash API")
    await init_db()
    yield
    log.info("Остановка EvoDash API")


app = FastAPI(title="EvoDash ВПЦ + RGS", version="0.1.0", lifespan=lifespan)

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    log.info("CORS разрешён для: %s", ", ".join(CORS_ORIGINS))


@app.get("/api/health")
async def health():
    return {"ok": True}


_protected = [Depends(require_user)]

app.include_router(auth.router, prefix="/api")
for _router in (
    markets.router, users.router, audit.router, imports.router,
    vpc.router, rgs.router,
):
    app.include_router(_router, prefix="/api", dependencies=_protected)
