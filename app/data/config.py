from __future__ import annotations

from os import getenv
from dotenv import load_dotenv

load_dotenv()


def _env_csv(key: str, fallback: list[str] | None = None) -> list[str]:
    raw = getenv(key)
    if not raw:
        return fallback or []
    values = [value.strip() for value in raw.split(",")]
    return [_normalize_env_string(value) for value in values if value]


def _normalize_env_string(value: str) -> str:
    normalized = value.strip()
    if len(normalized) >= 3 and normalized[0].lower() == "r" and normalized[1] in {'"', "'"} and normalized[-1] == normalized[1]:
        normalized = normalized[2:-1]
    elif len(normalized) >= 2 and normalized[0] in {'"', "'"} and normalized[-1] == normalized[0]:
        normalized = normalized[1:-1]
    return normalized.strip()


def _env_string(key: str) -> str | None:
    raw = getenv(key)
    if raw is None:
        return None
    normalized = _normalize_env_string(raw)
    return normalized or None


def _env_int(key: str, default: int) -> int:
    raw = getenv(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    raw = getenv(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# --- MAIN CONFIG ---
DATABASE_URL: str | None = getenv("DATABASE_URL")
STOCKFISH_PATH: str | None = getenv("STOCKFISH_PATH")

# --- CLOUDFLARE ---
CF_TOKEN: str | None = getenv("CF_TOKEN")

# --- CORS ---
CORS_ORIGINS: tuple[str, ...] = tuple(
    dict.fromkeys(_env_csv("DEFAULT_CORS_ORIGINS") + _env_csv("BACKEND_CORS_ORIGINS"))
)
CORS_ORIGIN_REGEX: str | None = _env_string("BACKEND_CORS_ORIGIN_REGEX") or _env_string("DEFAULT_CORS_ORIGIN_REGEX")

# --- AUTH ---
DEV_JWT_SECRET: str = "super-secret-dev-key"
JWT_SECRET: str = getenv("JWT_SECRET") or DEV_JWT_SECRET

# --- TOKENS ---
ACCESS_TOKEN_EXPIRE_MINUTES: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
REFRESH_TOKEN_EXPIRE_DAYS: int = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 30)
AUTH_SESSION_INACTIVITY_DAYS: int = _env_int("AUTH_SESSION_INACTIVITY_DAYS", 14)
ROOM_INVITE_TTL_HOURS: int = _env_int("ROOM_INVITE_TTL_HOURS", 24)
GAME_OFFER_EXPIRE_MINUTES: int = _env_int("GAME_OFFER_EXPIRE_MINUTES", 10)

# --- AGORA ---
AGORA_APP_ID: str | None = _env_string("AGORA_APP_ID")
AGORA_APP_CERTIFICATE: str | None = _env_string("AGORA_APP_CERTIFICATE")
AGORA_RTC_TOKEN_EXPIRE_SECONDS: int = _env_int("AGORA_RTC_TOKEN_EXPIRE_SECONDS", 3600)

# --- EMAIL / RESEND ---
RESEND_API_KEY: str | None = _env_string("RESEND_API_KEY")
RESEND_FROM_EMAIL: str | None = _env_string("RESEND_FROM_EMAIL")
RESEND_REPLY_TO: str | None = _env_string("RESEND_REPLY_TO")
EMAIL_CODE_LENGTH: int = _env_int("EMAIL_CODE_LENGTH", 6)
EMAIL_CODE_EXPIRE_MINUTES: int = _env_int("EMAIL_CODE_EXPIRE_MINUTES", 10)
EMAIL_CODE_RESEND_COOLDOWN_SECONDS: int = _env_int("EMAIL_CODE_RESEND_COOLDOWN_SECONDS", 60)
EMAIL_CODE_MAX_ATTEMPTS: int = _env_int("EMAIL_CODE_MAX_ATTEMPTS", 5)

# --- TELEGRAM PROFILE PHOTO STORAGE ---
BOT_TOKEN: str | None = _env_string("BOT_TOKEN")
TELEGRAM_PROFILE_PHOTO_CHAT_ID: str | None = _env_string("TELEGRAM_PROFILE_PHOTO_CHAT_ID")
PROFILE_PHOTO_MAX_BYTES: int = _env_int("PROFILE_PHOTO_MAX_BYTES", 5 * 1024 * 1024)

# --- GAME REVIEW ---
GAME_REVIEW_ANALYSIS_TIME_SECONDS: float = _env_float("GAME_REVIEW_ANALYSIS_TIME_SECONDS", 0.08)
GAME_REVIEW_ANALYSIS_DEPTH: int = _env_int("GAME_REVIEW_ANALYSIS_DEPTH", 10)
