from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PublicUserSummary(BaseModel):
    id: str
    username: str
    photoUrl: str | None = None
    countryCode: str = "XX"
    rating: int
    createdAt: datetime
    registeredAt: datetime | None = None


class PublicUserProfileStats(BaseModel):
    leaderboardRank: int | None = None
    rating: int
    wins: int
    losses: int
    draws: int
    totalGames: int
    completedGames: int
    activeGames: int
    winRate: float
    lossRate: float
    drawRate: float
    gamesAsWhite: int
    gamesAsBlack: int
    gamesAsBoth: int
    gamesByMode: dict[str, int]
    resultsByMode: dict[str, dict[str, int]]
    currentStreak: dict[str, int | str] | None = None
    lastGameAt: datetime | None = None


class PublicProfileOpponent(BaseModel):
    id: str | None = None
    username: str
    photoUrl: str | None = None
    rating: int | None = None
    isAi: bool = False


class PublicProfileGameSummary(BaseModel):
    gameId: int
    mode: str
    status: str
    result: str | None = None
    resultForUser: str
    playedAs: str
    opponent: PublicProfileOpponent
    createdAt: datetime
    updatedAt: datetime


class PublicUserProfileOut(BaseModel):
    user: PublicUserSummary
    stats: PublicUserProfileStats
    recentGames: list[PublicProfileGameSummary]
