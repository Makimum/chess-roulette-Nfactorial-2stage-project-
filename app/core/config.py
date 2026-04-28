from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.data import config as cfg


BACKEND_DIR = Path(__file__).resolve().parents[2]
logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class Settings:
    database_url: str = ""
    stockfish_path: str | None = None
    cors_origins: tuple[str, ...] = cfg.CORS_ORIGINS
    cors_origin_regex: str | None = cfg.CORS_ORIGIN_REGEX
    jwt_secret: str = cfg.JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = cfg.ACCESS_TOKEN_EXPIRE_MINUTES
    refresh_token_expire_days: int = cfg.REFRESH_TOKEN_EXPIRE_DAYS
    auth_session_inactivity_days: int = cfg.AUTH_SESSION_INACTIVITY_DAYS
    room_invite_ttl_hours: int = cfg.ROOM_INVITE_TTL_HOURS
    game_offer_expire_minutes: int = cfg.GAME_OFFER_EXPIRE_MINUTES
    agora_app_id: str | None = cfg.AGORA_APP_ID
    agora_app_certificate: str | None = cfg.AGORA_APP_CERTIFICATE
    agora_rtc_token_expire_seconds: int = cfg.AGORA_RTC_TOKEN_EXPIRE_SECONDS
    resend_api_key: str | None = cfg.RESEND_API_KEY
    resend_from_email: str | None = cfg.RESEND_FROM_EMAIL
    resend_reply_to: str | None = cfg.RESEND_REPLY_TO
    email_code_length: int = cfg.EMAIL_CODE_LENGTH
    email_code_expire_minutes: int = cfg.EMAIL_CODE_EXPIRE_MINUTES
    email_code_resend_cooldown_seconds: int = cfg.EMAIL_CODE_RESEND_COOLDOWN_SECONDS
    email_code_max_attempts: int = cfg.EMAIL_CODE_MAX_ATTEMPTS
    bot_token: str | None = cfg.BOT_TOKEN
    telegram_profile_photo_chat_id: str | None = cfg.TELEGRAM_PROFILE_PHOTO_CHAT_ID
    profile_photo_max_bytes: int = cfg.PROFILE_PHOTO_MAX_BYTES
    game_review_analysis_time_seconds: float = cfg.GAME_REVIEW_ANALYSIS_TIME_SECONDS
    game_review_analysis_depth: int = cfg.GAME_REVIEW_ANALYSIS_DEPTH


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    if not cfg.JWT_SECRET or cfg.JWT_SECRET == cfg.DEV_JWT_SECRET:
        logger.warning("JWT_SECRET is not set; using development fallback. Do not use this in production.")
    if not cfg.DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in environment variables.")
    return Settings(
        database_url=cfg.DATABASE_URL,
        stockfish_path=cfg.STOCKFISH_PATH,
        cors_origins=cfg.CORS_ORIGINS,
        cors_origin_regex=cfg.CORS_ORIGIN_REGEX,
        jwt_secret=cfg.JWT_SECRET,
        access_token_expire_minutes=cfg.ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_token_expire_days=cfg.REFRESH_TOKEN_EXPIRE_DAYS,
        auth_session_inactivity_days=cfg.AUTH_SESSION_INACTIVITY_DAYS,
        room_invite_ttl_hours=cfg.ROOM_INVITE_TTL_HOURS,
        game_offer_expire_minutes=cfg.GAME_OFFER_EXPIRE_MINUTES,
        agora_app_id=cfg.AGORA_APP_ID,
        agora_app_certificate=cfg.AGORA_APP_CERTIFICATE,
        agora_rtc_token_expire_seconds=cfg.AGORA_RTC_TOKEN_EXPIRE_SECONDS,
        resend_api_key=cfg.RESEND_API_KEY,
        resend_from_email=cfg.RESEND_FROM_EMAIL,
        resend_reply_to=cfg.RESEND_REPLY_TO,
        email_code_length=cfg.EMAIL_CODE_LENGTH,
        email_code_expire_minutes=cfg.EMAIL_CODE_EXPIRE_MINUTES,
        email_code_resend_cooldown_seconds=cfg.EMAIL_CODE_RESEND_COOLDOWN_SECONDS,
        email_code_max_attempts=cfg.EMAIL_CODE_MAX_ATTEMPTS,
        bot_token=cfg.BOT_TOKEN,
        telegram_profile_photo_chat_id=cfg.TELEGRAM_PROFILE_PHOTO_CHAT_ID,
        profile_photo_max_bytes=cfg.PROFILE_PHOTO_MAX_BYTES,
        game_review_analysis_time_seconds=cfg.GAME_REVIEW_ANALYSIS_TIME_SECONDS,
        game_review_analysis_depth=cfg.GAME_REVIEW_ANALYSIS_DEPTH,
    )
