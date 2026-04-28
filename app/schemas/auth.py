from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.validation import (
    EMAIL_MAX_LENGTH,
    EMAIL_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
)


class AuthUserOut(BaseModel):
    id: str
    email: str | None = None
    username: str
    photoUrl: str | None = None
    countryCode: str = "XX"
    rating: int
    wins: int
    losses: int
    draws: int


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=EMAIL_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    username: str = Field(min_length=USERNAME_MIN_LENGTH, max_length=USERNAME_MAX_LENGTH)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("username", mode="before")
    @classmethod
    def strip_username(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return value.strip()


class EmailCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=EMAIL_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    username: str = Field(min_length=USERNAME_MIN_LENGTH, max_length=USERNAME_MAX_LENGTH)

    @field_validator("email", "username", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class SignupConfirmRequest(SignupRequest):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("code", mode="before")
    @classmethod
    def strip_code(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class AccountIdentifierRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    email: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)

    @field_validator("identifier", "email", mode="before")
    @classmethod
    def strip_identifier(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_identifier(self) -> "AccountIdentifierRequest":
        if not self.identifier and not self.email:
            raise ValueError("identifier or email is required")
        return self


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    email: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("identifier", "email", mode="before")
    @classmethod
    def strip_identifier(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_identifier(self) -> "LoginRequest":
        if not self.identifier and not self.email:
            raise ValueError("identifier or email is required")
        return self


class RefreshRequest(BaseModel):
    refreshToken: str


class LogoutRequest(BaseModel):
    refreshToken: str


class PasswordResetConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    email: str | None = Field(default=None, min_length=USERNAME_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    newPassword: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("identifier", "email", "code", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_identifier(self) -> "PasswordResetConfirmRequest":
        if not self.identifier and not self.email:
            raise ValueError("identifier or email is required")
        return self


class EmailChangeSendCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    newEmail: str = Field(min_length=EMAIL_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    currentPassword: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("newEmail", mode="before")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class EmailChangeConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    newEmail: str = Field(min_length=EMAIL_MIN_LENGTH, max_length=EMAIL_MAX_LENGTH)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("newEmail", "code", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentPassword: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    newPassword: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class SendCodeResponse(BaseModel):
    success: bool = True
    expiresIn: int
    resendAfter: int


class AuthResponse(BaseModel):
    user: AuthUserOut
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"
    expiresIn: int


class AccessTokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresIn: int


class SuccessResponse(BaseModel):
    success: bool = True
