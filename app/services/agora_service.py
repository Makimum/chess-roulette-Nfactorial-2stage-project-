from __future__ import annotations

import hashlib
import re
import secrets
import time
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import Settings, get_settings


AGORA_ROLE_VALUES = {
    "publisher": 1,
    "subscriber": 2,
}
CHANNEL_PATTERN = re.compile(r"^[A-Za-z0-9 _!#$%&()+\-:;<=.>?@\[\]^_{|}~,]{1,64}$")
MAX_RTC_TOKEN_EXPIRE_SECONDS = 86_400


def require_agora_settings(settings: Settings | None = None) -> Settings:
    settings = settings or get_settings()
    if not settings.agora_app_id or not settings.agora_app_certificate:
        raise HTTPException(status_code=503, detail="Agora is not configured")
    return settings


def public_agora_config(settings: Settings | None = None) -> dict:
    settings = require_agora_settings(settings)
    return {
        "appId": settings.agora_app_id,
        "tokenExpireSeconds": min(max(settings.agora_rtc_token_expire_seconds, 1), MAX_RTC_TOKEN_EXPIRE_SECONDS),
    }


def validate_channel_name(channel_name: str) -> str:
    normalized = channel_name.strip()
    if not CHANNEL_PATTERN.fullmatch(normalized):
        raise HTTPException(status_code=400, detail="Invalid Agora channel name")
    return normalized


def channel_for_room(room_code: str) -> str:
    return validate_channel_name(f"room-{room_code.strip().upper()}")


def channel_for_game(game_id: int | str) -> str:
    digest = hashlib.sha256(str(game_id).encode("utf-8")).hexdigest()[:24]
    return validate_channel_name(f"game-{digest}")


def uid_for_identity(identity: str) -> int:
    digest = hashlib.sha256(identity.encode("utf-8")).digest()
    # Agora integer UID range is 1..2^32-1. Keep zero reserved.
    return int.from_bytes(digest[:4], "big") or 1


def generate_rtc_uid() -> int:
    return secrets.randbelow(4_294_967_295) + 1


def build_rtc_token(channel_name: str, uid: int, role: str = "publisher", settings: Settings | None = None) -> dict:
    settings = require_agora_settings(settings)
    channel_name = validate_channel_name(channel_name)
    role_value = AGORA_ROLE_VALUES.get(role)
    if role_value is None:
        raise HTTPException(status_code=400, detail="Invalid Agora role")
    expire_seconds = min(max(settings.agora_rtc_token_expire_seconds, 1), MAX_RTC_TOKEN_EXPIRE_SECONDS)
    expires_at_ts = int(time.time()) + expire_seconds

    try:
        from agora_token_builder import RtcTokenBuilder
    except ImportError as exc:  # pragma: no cover - environment-level dependency issue
        raise HTTPException(status_code=500, detail="Missing dependency: agora-token-builder") from exc

    token = RtcTokenBuilder.buildTokenWithUid(
        settings.agora_app_id,
        settings.agora_app_certificate,
        channel_name,
        uid,
        role_value,
        expires_at_ts,
    )
    return {
        "appId": settings.agora_app_id,
        "channelName": channel_name,
        "token": token,
        "uid": uid,
        "role": role,
        "tokenType": "rtc",
        "expireSeconds": expire_seconds,
        "expiresAt": datetime.fromtimestamp(expires_at_ts, tz=timezone.utc),
        "audioEnabled": True,
        "videoEnabled": True,
    }
