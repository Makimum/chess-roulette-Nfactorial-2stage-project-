from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserProfile
from app.services.profile_photo_service import profile_photo_url


async def leaderboard(db: AsyncSession, country_code: str | None = None) -> list[dict]:
    stmt = (
        select(UserProfile)
        .order_by(UserProfile.rating.desc(), UserProfile.wins.desc())
        .limit(20)
    )
    if country_code:
        stmt = (
            select(UserProfile)
            .where(UserProfile.country_code == country_code.upper())
            .order_by(UserProfile.rating.desc(), UserProfile.wins.desc())
            .limit(20)
        )

    rows: list[dict] = []
    for user in (await db.execute(stmt)).scalars():
        rows.append(
            {
                "rank": len(rows) + 1,
                "userId": user.id,
                "name": user.username,
                "username": user.username,
                "photoUrl": profile_photo_url(user),
                "rating": user.rating,
                "countryCode": user.country_code or "XX",
                "wins": user.wins,
                "losses": user.losses,
                "draws": user.draws,
                "isDemo": False,
            }
        )
    return rows
