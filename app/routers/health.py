from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.stockfish_service import StockfishService


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "database": "postgresql" if settings.database_url.startswith("postgres") else "sqlite",
        "stockfishAvailable": StockfishService().available,
    }

