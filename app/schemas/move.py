from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MoveRequest(BaseModel):
    from_square: str = Field(alias="from", min_length=2, max_length=2)
    to: str = Field(min_length=2, max_length=2)
    promotion: str | None = Field(default=None, max_length=1)


class MoveOut(BaseModel):
    id: int
    moveNumber: int
    ply: int
    color: str
    uci: str
    san: str
    fenBefore: str
    fenAfter: str
    createdAt: datetime


