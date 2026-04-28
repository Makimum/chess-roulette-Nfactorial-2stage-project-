from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.game import GameClockOut, PlayerOut, TimeControlIn, TimeControlOut

SeatPreference = Literal["white", "black", "random"]


class CreateRoomRequest(BaseModel):
    sidePreference: SeatPreference = "white"
    timeControl: TimeControlIn | None = None


class JoinRoomRequest(BaseModel):
    sidePreference: SeatPreference = "random"


class CancelRoomRequest(BaseModel):
    reason: str | None = None


class RoomParticipantOut(BaseModel):
    userId: str
    username: str
    photoUrl: str | None = None
    role: str
    seatPreference: str
    resolvedSide: str | None = None
    joinedAt: datetime
    lastSeenAt: datetime


class RoomOut(BaseModel):
    roomCode: str
    code: str
    gameId: int
    invitePath: str
    status: str
    whiteUserId: str | None = None
    blackUserId: str | None = None
    currentUserId: str | None = None
    playerSide: Literal["white", "black", "spectator"]
    whitePlayer: PlayerOut | None = None
    blackPlayer: PlayerOut | None = None
    timeControl: TimeControlOut | None = None
    clocks: GameClockOut | None = None
    activeMatchRedirect: bool = False
    participants: list[RoomParticipantOut] = []
    inviteExpiresAt: datetime | None = None
    createdAt: datetime
    updatedAt: datetime
