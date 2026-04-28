from __future__ import annotations

import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path


if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.data import config as cfg
from app.db.database import init_db
from app.routers import agora, auth, games, health, leaderboard, live, rooms, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


settings = get_settings()

app = FastAPI(title="Chess Roulette API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(games.router)
app.include_router(leaderboard.router)
app.include_router(rooms.router)
app.include_router(agora.router)
app.include_router(users.router)
app.include_router(live.router)


if __name__ == "__main__":
    import uvicorn

    _tunnel: subprocess.Popen | None = None
    if cfg.CF_TOKEN:
        _tunnel = subprocess.Popen(
            ["cloudflared", "tunnel", "run", "--token", cfg.CF_TOKEN],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    try:
        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=8000,
            log_level="info",
        )
    finally:
        if _tunnel is not None:
            _tunnel.terminate()
            _tunnel.wait()
