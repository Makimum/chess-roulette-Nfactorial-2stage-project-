from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


GameMode = Literal["ai", "friend", "local"]
GameStatus = Literal["active", "check", "checkmate", "stalemate", "draw", "resigned", "timeout", "cancelled", "expired"]
Color = Literal["white", "black"]
GameOfferType = Literal["draw", "undo", "rematch"]
GameOfferAction = Literal["accept", "decline", "cancel"]


class CreateGameRequest(BaseModel):
    mode: GameMode
    side: Color | None = "white"
    timeControl: "TimeControlIn | None" = None


class TimeControlIn(BaseModel):
    initialSeconds: int = Field(ge=30, le=10_800)
    incrementSeconds: int = Field(default=0, ge=0, le=60)


class TimeControlOut(BaseModel):
    initialSeconds: int
    incrementSeconds: int = 0


class GameClockOut(BaseModel):
    whiteTimeMs: int | None = None
    blackTimeMs: int | None = None
    turnStartedAt: datetime | None = None
    serverNow: datetime
    isRunning: bool = False


class PlayerOut(BaseModel):
    id: str
    name: str
    username: str
    photoUrl: str | None = None
    countryCode: str | None = None
    rating: int
    wins: int = 0
    losses: int = 0
    draws: int = 0
    isAi: bool = False


class GameState(BaseModel):
    gameId: int
    id: int
    mode: str
    status: str
    result: str | None = None
    currentFen: str
    fen: str
    pgn: str
    sideToMove: Color
    moveHistory: list["MoveOut"]
    whitePlayer: PlayerOut
    blackPlayer: PlayerOut
    white: PlayerOut
    black: PlayerOut
    winnerPlayerId: str | None = None
    timeControl: TimeControlOut | None = None
    clocks: GameClockOut | None = None
    activeMatchRedirect: bool = False
    isTerminal: bool = False
    createdAt: datetime
    updatedAt: datetime


class ActiveMatchOut(BaseModel):
    hasActiveMatch: bool
    game: GameState | None = None
    gameId: int | None = None
    roomCode: str | None = None


class ResignRequest(BaseModel):
    reason: str | None = None


class PositionsOut(BaseModel):
    gameId: int
    positions: list[str]


class GameReviewMoveOut(BaseModel):
    moveId: int
    moveNumber: int
    ply: int
    color: str
    san: str
    uci: str
    fenBefore: str
    fenAfter: str
    evalBefore: int | None = None
    evalAfter: int | None = None
    evalBeforeForPlayer: int | None = None
    evalAfterForPlayer: int | None = None
    bestMove: str | None = None
    bestMoveSan: str | None = None
    centipawnLoss: int | None = None
    classification: str
    comment: str


class GameReviewSummaryOut(BaseModel):
    totalMoves: int
    accuracyWhite: float | None = None
    accuracyBlack: float | None = None
    averageCentipawnLossWhite: float | None = None
    averageCentipawnLossBlack: float | None = None
    countsWhite: dict[str, int]
    countsBlack: dict[str, int]


class GameReviewOut(BaseModel):
    gameId: int
    stockfishAvailable: bool
    engineUsed: bool
    analysisDepth: int | None = None
    finalEvaluation: int | None = None
    summary: GameReviewSummaryOut
    moves: list[GameReviewMoveOut]


class CreateGameOfferRequest(BaseModel):
    offerType: GameOfferType
    targetUserId: str | None = None
    payload: dict[str, object] | None = None


class RespondGameOfferRequest(BaseModel):
    action: GameOfferAction


class GameOfferOut(BaseModel):
    id: int
    gameId: int
    roomId: int | None = None
    offerType: str
    status: str
    requestedByUserId: str | None = None
    targetUserId: str | None = None
    payload: dict[str, object]
    expiresAt: datetime | None = None
    createdAt: datetime
    respondedAt: datetime | None = None


class GameEventOut(BaseModel):
    id: int
    gameId: int
    roomId: int | None = None
    seq: int
    eventType: str
    actorUserId: str | None = None
    payload: dict[str, object]
    createdAt: datetime


from app.schemas.move import MoveOut  # noqa: E402

CreateGameRequest.model_rebuild()
GameState.model_rebuild()


class MoveResult(BaseModel):
    game: GameState
    move: MoveOut
