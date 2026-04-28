from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.validation import EMAIL_MAX_LENGTH, USERNAME_MAX_LENGTH
from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str | None] = mapped_column(String(EMAIL_MAX_LENGTH), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    username: Mapped[str] = mapped_column(String(USERNAME_MAX_LENGTH), unique=True, index=True)
    photo_file_id: Mapped[str | None] = mapped_column(String, nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), index=True, nullable=True)
    location_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=100)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    auth_sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user_profile",
        cascade="all, delete-orphan",
    )
    room_participants: Mapped[list["RoomParticipant"]] = relationship(back_populates="user_profile")


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mode: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="active", index=True)
    result: Mapped[str | None] = mapped_column(String, nullable=True)
    white_player_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True)
    black_player_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True)
    current_fen: Mapped[str] = mapped_column(String)
    pgn: Mapped[str] = mapped_column(Text, default="")
    winner_player_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True)
    time_control_initial_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_increment_seconds: Mapped[int] = mapped_column(Integer, default=0)
    white_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    turn_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    white_player: Mapped[UserProfile | None] = relationship(foreign_keys=[white_player_id])
    black_player: Mapped[UserProfile | None] = relationship(foreign_keys=[black_player_id])
    winner_player: Mapped[UserProfile | None] = relationship(foreign_keys=[winner_player_id])
    moves: Mapped[list["Move"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="Move.move_number",
    )
    action_offers: Mapped[list["GameActionOffer"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="GameActionOffer.created_at",
    )
    events: Mapped[list["GameEvent"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="GameEvent.seq",
    )


class Move(Base):
    __tablename__ = "moves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    move_number: Mapped[int] = mapped_column(Integer, index=True)
    color: Mapped[str] = mapped_column(String)
    uci: Mapped[str] = mapped_column(String)
    san: Mapped[str] = mapped_column(String)
    fen_before: Mapped[str] = mapped_column(String)
    fen_after: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    game: Mapped[Game] = relationship(back_populates="moves")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_code: Mapped[str] = mapped_column(String, unique=True, index=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="waiting", index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    game: Mapped[Game] = relationship()
    participants: Mapped[list["RoomParticipant"]] = relationship(
        back_populates="room",
        cascade="all, delete-orphan",
        order_by="RoomParticipant.joined_at",
    )


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    user_profile_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    role: Mapped[str] = mapped_column(String, default="player")
    seat_preference: Mapped[str] = mapped_column(String, default="random")
    resolved_side: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    room: Mapped[Room] = relationship(back_populates="participants")
    user_profile: Mapped[UserProfile] = relationship(back_populates="room_participants")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_profile_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    user_profile: Mapped[UserProfile] = relationship(back_populates="auth_sessions")


class GameActionOffer(Base):
    __tablename__ = "game_action_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True, index=True)
    offer_type: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)
    requested_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True, index=True)
    target_user_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="action_offers")
    room: Mapped[Room | None] = relationship()
    requested_by_user: Mapped[UserProfile | None] = relationship(foreign_keys=[requested_by_user_id])
    target_user: Mapped[UserProfile | None] = relationship(foreign_keys=[target_user_id])


class GameEvent(Base):
    __tablename__ = "game_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True, index=True)
    seq: Mapped[int] = mapped_column(Integer, index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id"), nullable=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    game: Mapped[Game] = relationship(back_populates="events")
    room: Mapped[Room | None] = relationship()
    actor_user: Mapped[UserProfile | None] = relationship()
