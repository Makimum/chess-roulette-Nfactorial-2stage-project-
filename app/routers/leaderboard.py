from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.leaderboard import LeaderboardEntry
from app.services.leaderboard_service import leaderboard


router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    countryCode: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await leaderboard(db, countryCode)
