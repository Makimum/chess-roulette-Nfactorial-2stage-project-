from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException

from app.core.config import get_settings


Purpose = str

TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"
logger = logging.getLogger(__name__)

PURPOSE_TEMPLATES: dict[Purpose, tuple[str, str]] = {
    "signup": ("signup_verification.htm", "Verify your Chess Roulette account"),
    "password_reset": ("password_reset.htm", "Reset your Chess Roulette password"),
    "email_change": ("email_change.htm", "Confirm your new Chess Roulette email"),
}


@dataclass
class _Attempts:
    count: int
    started_at: float


_last_send_at: dict[str, float] = {}
_attempts: dict[str, _Attempts] = {}


def _tracker_key(purpose: Purpose, scope: str) -> str:
    return f"{purpose}:{scope}"


def _code_secret() -> bytes:
    settings = get_settings()
    return f"email-code:{settings.jwt_secret}".encode("utf-8")


def _code_for_counter(purpose: Purpose, scope: str, counter: int) -> str:
    settings = get_settings()
    digits = max(6, min(settings.email_code_length, 10))
    payload = f"{purpose}:{scope}:{counter}".encode("utf-8")
    digest = hmac.new(_code_secret(), payload, hashlib.sha256).digest()
    value = int.from_bytes(digest[:8], "big") % (10**digits)
    return str(value).zfill(digits)


def generate_code(purpose: Purpose, scope: str) -> str:
    counter = int(time.time() // 60)
    return _code_for_counter(purpose, scope, counter)


def verify_code(purpose: Purpose, scope: str, code: str) -> None:
    settings = get_settings()
    normalized = code.strip()
    if not normalized.isdigit() or len(normalized) != settings.email_code_length:
        _record_failed_attempt(purpose, scope)
        raise HTTPException(status_code=400, detail="Invalid verification code")

    now_counter = int(time.time() // 60)
    valid_window_minutes = settings.email_code_expire_minutes + 1
    for counter in range(now_counter, now_counter - valid_window_minutes - 1, -1):
        expected = _code_for_counter(purpose, scope, counter)
        if hmac.compare_digest(expected, normalized):
            _attempts.pop(_tracker_key(purpose, scope), None)
            return

    oldest_valid_counter = now_counter - valid_window_minutes
    for counter in range(oldest_valid_counter - 1, now_counter - 1440, -1):
        expected = _code_for_counter(purpose, scope, counter)
        if hmac.compare_digest(expected, normalized):
            _record_failed_attempt(purpose, scope)
            raise HTTPException(status_code=400, detail="Verification code expired")

    _record_failed_attempt(purpose, scope)
    raise HTTPException(status_code=400, detail="Invalid verification code")


def _record_failed_attempt(purpose: Purpose, scope: str) -> None:
    settings = get_settings()
    key = _tracker_key(purpose, scope)
    now = time.time()
    window_seconds = settings.email_code_expire_minutes * 60
    current = _attempts.get(key)
    if not current or now - current.started_at > window_seconds:
        current = _Attempts(count=0, started_at=now)
    current.count += 1
    _attempts[key] = current
    if current.count >= settings.email_code_max_attempts:
        raise HTTPException(status_code=400, detail="Too many invalid verification attempts")


def _enforce_send_cooldown(purpose: Purpose, scope: str) -> None:
    settings = get_settings()
    key = _tracker_key(purpose, scope)
    now = time.time()
    last_sent_at = _last_send_at.get(key)
    if last_sent_at and now - last_sent_at < settings.email_code_resend_cooldown_seconds:
        raise HTTPException(status_code=429, detail="Please wait before requesting another code")
    _last_send_at[key] = now


def code_response() -> dict:
    settings = get_settings()
    return {
        "success": True,
        "expiresIn": settings.email_code_expire_minutes * 60,
        "resendAfter": settings.email_code_resend_cooldown_seconds,
    }


def ensure_email_delivery_configured() -> None:
    settings = get_settings()
    if not settings.resend_api_key or not settings.resend_from_email:
        raise HTTPException(status_code=503, detail="Email delivery is not configured")


def _render_template(template_name: str, context: dict[str, str]) -> str:
    template_path = TEMPLATE_DIR / template_name
    content = template_path.read_text(encoding="utf-8")
    for key, value in context.items():
        content = content.replace("{{ " + key + " }}", html.escape(value))
    return content


def _format_from_email(value: str) -> str:
    normalized = value.strip()
    if "<" in normalized and ">" in normalized:
        return normalized
    return f"Chess Roulette <{normalized}>"


def _plain_text_for_code(subject: str, code: str, expires_minutes: int) -> str:
    return (
        f"{subject}\n\n"
        f"Код: {code}\n\n"
        f"Код действует {expires_minutes} минут.\n"
        "Если вы не запрашивали это письмо, просто проигнорируйте его."
    )


def _send_resend_email(to_email: str, subject: str, rendered_html: str, plain_text: str) -> None:
    settings = get_settings()
    ensure_email_delivery_configured()

    payload: dict[str, object] = {
        "from": _format_from_email(settings.resend_from_email),
        "to": [to_email],
        "subject": subject,
        "html": rendered_html,
        "text": plain_text,
    }
    if settings.resend_reply_to:
        payload["reply_to"] = settings.resend_reply_to

    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "chess-roulette-backend/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status >= 400:
                raise HTTPException(status_code=503, detail="Email delivery failed")
    except HTTPException:
        raise
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.warning("Resend email delivery failed: status=%s body=%s", exc.code, error_body)
        raise HTTPException(status_code=503, detail="Email delivery failed") from exc
    except Exception as exc:
        logger.warning("Resend email delivery failed: %s", exc)
        raise HTTPException(status_code=503, detail="Email delivery failed") from exc


async def send_code_email(purpose: Purpose, email: str, scope: str, *, deliver: bool = True) -> dict:
    ensure_email_delivery_configured()
    _enforce_send_cooldown(purpose, scope)
    if not deliver:
        return code_response()

    template = PURPOSE_TEMPLATES.get(purpose)
    if not template:
        raise RuntimeError(f"Unsupported email code purpose: {purpose}")

    template_name, subject = template
    code = generate_code(purpose, scope)
    settings = get_settings()
    rendered = _render_template(
        template_name,
        {
            "code": code,
            "expires_minutes": str(settings.email_code_expire_minutes),
        },
    )
    plain_text = _plain_text_for_code(subject, code, settings.email_code_expire_minutes)
    await asyncio.to_thread(_send_resend_email, email, subject, rendered, plain_text)
    return code_response()
