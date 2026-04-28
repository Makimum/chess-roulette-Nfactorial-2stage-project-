from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import mimetypes
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.db.models import UserProfile


logger = logging.getLogger(__name__)

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
CHUNK_SIZE = 64 * 1024


def profile_photo_url(user: UserProfile | None) -> str | None:
    if not user or not user.photo_file_id:
        return None
    version = hashlib.sha256(user.photo_file_id.encode("utf-8")).hexdigest()[:12]
    return f"/api/users/{user.id}/photo?v={version}"


def ensure_profile_photo_storage_configured() -> None:
    settings = get_settings()
    if not settings.bot_token or not settings.telegram_profile_photo_chat_id:
        raise HTTPException(status_code=503, detail="Profile photo storage is not configured")


def _telegram_api_url(method: str) -> str:
    settings = get_settings()
    return f"https://api.telegram.org/bot{settings.bot_token}/{method}"


def _telegram_file_url(file_path: str) -> str:
    settings = get_settings()
    quoted_path = urllib.parse.quote(file_path, safe="/")
    return f"https://api.telegram.org/file/bot{settings.bot_token}/{quoted_path}"


def _detect_photo_content_type(content: bytes, supplied_content_type: str | None) -> str:
    normalized = (supplied_content_type or "").split(";")[0].strip().lower()
    if normalized == "image/jpg":
        normalized = "image/jpeg"
    if normalized and normalized not in ALLOWED_PHOTO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Profile photo must be JPEG, PNG, or WebP")

    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"

    raise HTTPException(status_code=400, detail="Profile photo must be JPEG, PNG, or WebP")


async def _read_upload_content(photo: UploadFile) -> tuple[bytes, str, str]:
    settings = get_settings()
    max_bytes = max(settings.profile_photo_max_bytes, 1)
    content = await photo.read(max_bytes + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Profile photo file is empty")
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Profile photo file is too large")

    content_type = _detect_photo_content_type(content, photo.content_type)
    filename = Path(photo.filename or "profile-photo").name
    if not filename:
        filename = "profile-photo"
    return content, filename, content_type


def _multipart_body(
    fields: dict[str, str],
    files: dict[str, tuple[str, str, bytes]],
) -> tuple[bytes, str]:
    boundary = f"----ChessRoulette{uuid4().hex}"
    body = bytearray()

    def append_line(value: str = "") -> None:
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")

    for name, value in fields.items():
        append_line(f"--{boundary}")
        append_line(f'Content-Disposition: form-data; name="{name}"')
        append_line()
        append_line(value)

    for name, (filename, content_type, content) in files.items():
        safe_filename = filename.replace('"', "")
        append_line(f"--{boundary}")
        append_line(f'Content-Disposition: form-data; name="{name}"; filename="{safe_filename}"')
        append_line(f"Content-Type: {content_type}")
        append_line()
        body.extend(content)
        body.extend(b"\r\n")

    append_line(f"--{boundary}--")
    return bytes(body), boundary


def _telegram_request_json(method: str, payload: bytes, content_type: str) -> dict:
    request = urllib.request.Request(
        _telegram_api_url(method),
        data=payload,
        headers={
            "Content-Type": content_type,
            "Accept": "application/json",
            "User-Agent": "chess-roulette-backend/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.warning("Telegram %s failed: status=%s body=%s", method, exc.code, error_body)
        raise HTTPException(status_code=503, detail="Profile photo storage request failed") from exc
    except Exception as exc:
        logger.warning("Telegram %s failed: %s", method, exc)
        raise HTTPException(status_code=503, detail="Profile photo storage request failed") from exc

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.warning("Telegram %s returned invalid JSON", method)
        raise HTTPException(status_code=503, detail="Profile photo storage returned invalid response") from exc

    if not data.get("ok"):
        logger.warning("Telegram %s returned non-ok response: %s", method, data)
        raise HTTPException(status_code=503, detail="Profile photo storage request failed")
    return data


def _telegram_get_json(method: str, params: dict[str, str]) -> dict:
    encoded = urllib.parse.urlencode(params).encode("utf-8")
    return _telegram_request_json(method, encoded, "application/x-www-form-urlencoded")


def _upload_photo_to_telegram(user_id: str, content: bytes, filename: str, content_type: str) -> str:
    settings = get_settings()
    body, boundary = _multipart_body(
        {
            "chat_id": settings.telegram_profile_photo_chat_id or "",
            "caption": f"Chess Roulette profile photo: {user_id}",
        },
        {
            "photo": (filename, content_type, content),
        },
    )
    data = _telegram_request_json("sendPhoto", body, f"multipart/form-data; boundary={boundary}")
    photos = data.get("result", {}).get("photo", [])
    if not isinstance(photos, list) or not photos:
        raise HTTPException(status_code=503, detail="Profile photo storage returned invalid response")
    file_id = photos[-1].get("file_id")
    if not isinstance(file_id, str) or not file_id:
        raise HTTPException(status_code=503, detail="Profile photo storage returned invalid response")
    return file_id


async def upload_profile_photo(user: UserProfile, photo: UploadFile) -> str:
    ensure_profile_photo_storage_configured()
    content, filename, content_type = await _read_upload_content(photo)
    return await asyncio.to_thread(_upload_photo_to_telegram, user.id, content, filename, content_type)


def _telegram_file_path(file_id: str) -> str:
    data = _telegram_get_json("getFile", {"file_id": file_id})
    file_path = data.get("result", {}).get("file_path")
    if not isinstance(file_path, str) or not file_path:
        raise HTTPException(status_code=404, detail="Profile photo file not found")
    return file_path


def _telegram_file_iterator(file_path: str) -> Iterator[bytes]:
    with urllib.request.urlopen(_telegram_file_url(file_path), timeout=20) as response:
        while True:
            chunk = response.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk


async def profile_photo_response(file_id: str) -> StreamingResponse:
    ensure_profile_photo_storage_configured()
    file_path = await asyncio.to_thread(_telegram_file_path, file_id)
    media_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
    return StreamingResponse(
        _telegram_file_iterator(file_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )
