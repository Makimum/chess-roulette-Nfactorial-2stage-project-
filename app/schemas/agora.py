from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AgoraRole = Literal["publisher", "subscriber"]


class AgoraPublicConfigOut(BaseModel):
    appId: str
    tokenExpireSeconds: int


class AgoraRtcTokenRequest(BaseModel):
    channelName: str | None = Field(default=None, min_length=1, max_length=64)
    roomCode: str | None = Field(default=None, min_length=1, max_length=32)
    gameId: int | None = None
    uid: int | None = Field(default=None, ge=1, le=4_294_967_295)
    clientInstanceId: str | None = Field(default=None, min_length=1, max_length=128)
    role: AgoraRole = "publisher"


class AgoraRtcTokenOut(BaseModel):
    appId: str
    channelName: str
    token: str
    uid: int
    role: AgoraRole
    tokenType: str = "rtc"
    expireSeconds: int
    expiresAt: datetime
    audioEnabled: bool = True
    videoEnabled: bool = True
