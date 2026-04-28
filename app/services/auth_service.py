from __future__ import annotations

from datetime import timedelta, timezone

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    utcnow,
    verify_password,
)
from app.core.validation import (
    EMAIL_MAX_LENGTH,
    EMAIL_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
)
from app.db.database import get_db
from app.db.models import AuthSession, Game, UserProfile
from app.schemas.auth import (
    AccountIdentifierRequest,
    EmailChangeConfirmRequest,
    EmailChangeSendCodeRequest,
    EmailCodeRequest,
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetConfirmRequest,
    SignupConfirmRequest,
    SignupRequest,
)
from app.services.chess_service import GAME_LOAD_OPTIONS
from app.services.email_code_service import send_code_email, verify_code
from app.services.location_service import client_ip_from_request, resolve_location_snapshot
from app.services.profile_photo_service import profile_photo_url


bearer_scheme = HTTPBearer(auto_error=False)


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if len(normalized) < EMAIL_MIN_LENGTH or len(normalized) > EMAIL_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"Email must be between {EMAIL_MIN_LENGTH} and {EMAIL_MAX_LENGTH} characters")
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(status_code=400, detail="Invalid email address")
    return normalized


def serialize_auth_user(user: UserProfile) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "photoUrl": profile_photo_url(user),
        "countryCode": user.country_code or "XX",
        "rating": user.rating,
        "wins": user.wins,
        "losses": user.losses,
        "draws": user.draws,
    }


async def _issue_auth_response(db: AsyncSession, user: UserProfile, request: Request | None = None) -> dict:
    access_token, expires_in = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
        }
    )
    refresh_token = generate_refresh_token()
    ip_address = client_ip_from_request(request)
    session = AuthSession(
        user_profile_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        ip_address=ip_address,
        expires_at=utcnow() + timedelta(days=get_settings().refresh_token_expire_days),
        last_used_at=utcnow(),
    )
    db.add(session)
    await db.commit()
    return {
        "user": serialize_auth_user(user),
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "expiresIn": expires_in,
    }


async def cleanup_expired_sessions(db: AsyncSession) -> int:
    settings = get_settings()
    now = utcnow()
    inactive_before = now - timedelta(days=settings.auth_session_inactivity_days)
    result = await db.execute(
        update(AuthSession)
        .where(
            AuthSession.revoked_at.is_(None),
            or_(AuthSession.expires_at <= now, AuthSession.last_used_at <= inactive_before),
        )
        .values(revoked_at=now)
    )
    await db.commit()
    return result.rowcount or 0


def _password_valid(password: str) -> bool:
    return PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH


def _password_reset_scope(user: UserProfile) -> str:
    return f"{user.email}:{user.password_hash}"


def _email_change_scope(user: UserProfile, new_email: str) -> str:
    return f"{user.id}:{user.email}:{new_email}"


async def _user_by_email(db: AsyncSession, email: str) -> UserProfile | None:
    return (await db.execute(select(UserProfile).where(UserProfile.email == email))).scalar_one_or_none()


async def _user_by_username(db: AsyncSession, username: str) -> UserProfile | None:
    return (
        await db.execute(
            select(UserProfile).where(func.lower(UserProfile.username) == username.strip().lower())
        )
    ).scalar_one_or_none()


def _identifier_value(payload: AccountIdentifierRequest | LoginRequest | PasswordResetConfirmRequest) -> str:
    return (payload.identifier or payload.email or "").strip()


async def _user_by_identifier(db: AsyncSession, identifier: str) -> tuple[UserProfile | None, str]:
    value = identifier.strip()
    if "@" in value:
        email = normalize_email(value)
        return await _user_by_email(db, email), email
    if len(value) < USERNAME_MIN_LENGTH or len(value) > USERNAME_MAX_LENGTH:
        return None, value.lower()
    return await _user_by_username(db, value), value.lower()


async def _ensure_signup_identity_available(db: AsyncSession, email: str, username: str | None = None) -> None:
    if await _user_by_email(db, email):
        raise HTTPException(status_code=409, detail="Email is already registered")
    if username and await _user_by_username(db, username):
        raise HTTPException(status_code=409, detail="Username is already taken")


async def send_signup_code(db: AsyncSession, payload: EmailCodeRequest) -> dict:
    email = normalize_email(payload.email)
    await _ensure_signup_identity_available(db, email, payload.username)
    return await send_code_email("signup", email, email)


async def confirm_signup(db: AsyncSession, payload: SignupConfirmRequest, request: Request | None = None) -> dict:
    email = normalize_email(payload.email)
    await _ensure_signup_identity_available(db, email, payload.username)
    verify_code("signup", email, payload.code)
    return await signup(db, SignupRequest(email=email, password=payload.password, username=payload.username), request)


async def signup(db: AsyncSession, payload: SignupRequest, request: Request | None = None) -> dict:
    await cleanup_expired_sessions(db)
    email = normalize_email(payload.email)
    if not _password_valid(payload.password):
        raise HTTPException(status_code=400, detail=f"Password must be between {PASSWORD_MIN_LENGTH} and {PASSWORD_MAX_LENGTH} characters")

    await _ensure_signup_identity_available(db, email, payload.username)

    registration_location = resolve_location_snapshot(request)
    user = UserProfile(
        email=email,
        password_hash=hash_password(payload.password),
        username=payload.username,
        country_code=registration_location.country_code,
        location_resolved_at=utcnow(),
        registered_at=utcnow(),
        last_login_at=utcnow(),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        error_text = str(exc.orig).lower()
        if "username" in error_text:
            raise HTTPException(status_code=409, detail="Username is already taken") from exc
        if "email" in error_text:
            raise HTTPException(status_code=409, detail="Email is already registered") from exc
        raise
    await db.refresh(user)
    return await _issue_auth_response(db, user, request)


async def send_password_reset_code(db: AsyncSession, payload: AccountIdentifierRequest) -> dict:
    user, normalized_identifier = await _user_by_identifier(db, _identifier_value(payload))
    scope = _password_reset_scope(user) if user else f"missing:{normalized_identifier}"
    return await send_code_email("password_reset", user.email if user else "missing@example.invalid", scope, deliver=user is not None)


async def confirm_password_reset(db: AsyncSession, payload: PasswordResetConfirmRequest) -> dict:
    user, _ = await _user_by_identifier(db, _identifier_value(payload))
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    verify_code("password_reset", _password_reset_scope(user), payload.code)
    if not _password_valid(payload.newPassword):
        raise HTTPException(status_code=400, detail=f"Password must be between {PASSWORD_MIN_LENGTH} and {PASSWORD_MAX_LENGTH} characters")
    now = utcnow()
    user.password_hash = hash_password(payload.newPassword)
    user.last_login_at = None
    db.add(user)
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_profile_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.commit()
    return {"success": True}


async def send_email_change_code(db: AsyncSession, user: UserProfile, payload: EmailChangeSendCodeRequest) -> dict:
    new_email = normalize_email(payload.newEmail)
    if new_email == user.email:
        raise HTTPException(status_code=400, detail="New email must be different")
    if not verify_password(payload.currentPassword, user.password_hash):
        raise HTTPException(status_code=403, detail="Invalid current password")
    if await _user_by_email(db, new_email):
        raise HTTPException(status_code=409, detail="Email is already registered")
    return await send_code_email("email_change", new_email, _email_change_scope(user, new_email))


async def confirm_email_change(db: AsyncSession, user: UserProfile, payload: EmailChangeConfirmRequest) -> dict:
    new_email = normalize_email(payload.newEmail)
    if new_email == user.email:
        raise HTTPException(status_code=400, detail="New email must be different")
    if await _user_by_email(db, new_email):
        raise HTTPException(status_code=409, detail="Email is already registered")
    verify_code("email_change", _email_change_scope(user, new_email), payload.code)
    user.email = new_email
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return serialize_auth_user(user)


async def change_password(db: AsyncSession, user: UserProfile, payload: PasswordChangeRequest) -> dict:
    if not verify_password(payload.currentPassword, user.password_hash):
        raise HTTPException(status_code=403, detail="Invalid current password")
    if not _password_valid(payload.newPassword):
        raise HTTPException(status_code=400, detail=f"Password must be between {PASSWORD_MIN_LENGTH} and {PASSWORD_MAX_LENGTH} characters")
    user.password_hash = hash_password(payload.newPassword)
    db.add(user)
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_profile_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    await db.commit()
    return {"success": True}


async def login(db: AsyncSession, payload: LoginRequest, request: Request | None = None) -> dict:
    await cleanup_expired_sessions(db)
    user, _ = await _user_by_identifier(db, _identifier_value(payload))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email/username or password")

    user.last_login_at = utcnow()
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return await _issue_auth_response(db, user, request)


async def _get_refresh_session(db: AsyncSession, refresh_token: str) -> AuthSession:
    session = (
        await db.execute(
            select(AuthSession)
            .options(selectinload(AuthSession.user_profile))
            .where(AuthSession.refresh_token_hash == hash_token(refresh_token))
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if session.revoked_at:
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")
    last_used_at = session.last_used_at or session.created_at
    if last_used_at.tzinfo is None:
        last_used_at = last_used_at.replace(tzinfo=timezone.utc)
    inactive_for = utcnow() - last_used_at
    if inactive_for > timedelta(days=get_settings().auth_session_inactivity_days):
        session.revoked_at = utcnow()
        db.add(session)
        await db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired due to inactivity")
    return session


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> dict:
    session = await _get_refresh_session(db, refresh_token)
    user = session.user_profile
    access_token, expires_in = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
        }
    )
    session.last_used_at = utcnow()
    db.add(session)
    await db.commit()
    return {"accessToken": access_token, "tokenType": "bearer", "expiresIn": expires_in}


async def logout(db: AsyncSession, refresh_token: str) -> dict:
    session = (await db.execute(select(AuthSession).where(AuthSession.refresh_token_hash == hash_token(refresh_token)))).scalar_one_or_none()
    if session and not session.revoked_at:
        session.revoked_at = utcnow()
        db.add(session)
        await db.commit()
    return {"success": True}


async def get_current_user_from_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")
    return await get_user_from_access_token(db, credentials.credentials)


async def get_user_from_access_token(db: AsyncSession, access_token: str) -> UserProfile:
    payload = decode_access_token(access_token)
    user_id = payload.get("sub")
    user = await db.get(UserProfile, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Authenticated user not found")
    return user


async def recent_games_for_user(db: AsyncSession, user: UserProfile) -> list[Game]:
    stmt = (
        select(Game)
        .options(*GAME_LOAD_OPTIONS)
        .where(or_(Game.white_player_id == user.id, Game.black_player_id == user.id))
        .order_by(Game.updated_at.desc())
        .limit(20)
    )
    return list((await db.execute(stmt)).scalars())
