from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings


try:
    from passlib.context import CryptContext
except ImportError:  # pragma: no cover - fallback keeps local MVP usable before pip install
    CryptContext = None


PASSWORD_MIN_LENGTH = 8
PBKDF2_ITERATIONS = 260_000
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") if CryptContext else None


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    if pwd_context:
        return pwd_context.hash(password)

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    if password_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt_b64, digest_b64 = password_hash.split("$", 3)
            salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
            expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
            actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False
    if pwd_context:
        return pwd_context.verify(password, password_hash)
    return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("ascii"))


def create_access_token(payload: dict[str, Any]) -> tuple[str, int]:
    settings = get_settings()
    if settings.jwt_algorithm != "HS256":
        raise RuntimeError("Only HS256 JWT signing is supported by the MVP auth implementation")

    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expires_at = utcnow() + expires_delta
    claims = {
        **payload,
        "type": "access",
        "exp": int(expires_at.timestamp()),
        "iat": int(utcnow().timestamp()),
        "jti": secrets.token_urlsafe(12),
    }
    header = {"alg": settings.jwt_algorithm, "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}", int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        header_b64, payload_b64, signature_b64 = token.split(".", 2)
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
        received = _b64url_decode(signature_b64)
        if not hmac.compare_digest(received, expected):
            raise ValueError("Invalid token signature")
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":
            raise ValueError("Unsupported token algorithm")
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    if int(payload.get("exp", 0)) < int(utcnow().timestamp()):
        raise HTTPException(status_code=401, detail="Access token expired")
    return payload
