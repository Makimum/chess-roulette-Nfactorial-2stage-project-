from __future__ import annotations

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    userId: str
    name: str
    username: str
    photoUrl: str | None = None
    rating: int
    countryCode: str = "XX"
    wins: int
    losses: int
    draws: int
    isDemo: bool = False

