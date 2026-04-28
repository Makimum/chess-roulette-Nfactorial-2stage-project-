from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.auth import (
    AccessTokenResponse,
    AccountIdentifierRequest,
    AuthResponse,
    AuthUserOut,
    EmailChangeConfirmRequest,
    EmailChangeSendCodeRequest,
    EmailCodeRequest,
    LoginRequest,
    LogoutRequest,
    PasswordChangeRequest,
    PasswordResetConfirmRequest,
    RefreshRequest,
    SendCodeResponse,
    SignupConfirmRequest,
    SignupRequest,
    SuccessResponse,
)
from app.services import auth_service
from app.db.models import UserProfile


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    raise HTTPException(
        status_code=410,
        detail="Signup requires email verification. Use /api/auth/signup/send-code and /api/auth/signup/confirm",
    )


@router.post("/signup/send-code", response_model=SendCodeResponse)
async def signup_send_code(payload: EmailCodeRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.send_signup_code(db, payload)


@router.post("/signup/confirm", response_model=AuthResponse)
async def signup_confirm(payload: SignupConfirmRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.confirm_signup(db, payload, request)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.login(db, payload, request)


@router.get("/me", response_model=AuthUserOut)
async def me(current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token)) -> dict:
    return auth_service.serialize_auth_user(current_user)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.refresh_access_token(db, payload.refreshToken)


@router.post("/logout", response_model=SuccessResponse)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.logout(db, payload.refreshToken)


@router.post("/password-reset/send-code", response_model=SendCodeResponse)
async def password_reset_send_code(payload: AccountIdentifierRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.send_password_reset_code(db, payload)


@router.post("/password-reset/confirm", response_model=SuccessResponse)
async def password_reset_confirm(payload: PasswordResetConfirmRequest, db: AsyncSession = Depends(get_db)) -> dict:
    return await auth_service.confirm_password_reset(db, payload)


@router.post("/email-change/send-code", response_model=SendCodeResponse)
async def email_change_send_code(
    payload: EmailChangeSendCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    return await auth_service.send_email_change_code(db, current_user, payload)


@router.post("/email-change/confirm", response_model=AuthUserOut)
async def email_change_confirm(
    payload: EmailChangeConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    return await auth_service.confirm_email_change(db, current_user, payload)


@router.post("/password/change", response_model=SuccessResponse)
async def password_change(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    return await auth_service.change_password(db, current_user, payload)
