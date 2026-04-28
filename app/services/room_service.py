from __future__ import annotations

import random
import string
from datetime import timedelta

import chess
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models import Game, Room, RoomParticipant, UserProfile, utcnow
from app.schemas.game import TimeControlIn
from app.services.chess_service import (
    active_game_for_user,
    clock_payload,
    configure_time_control,
    serialize_player,
    start_clock_if_ready,
    time_control_payload,
)
from app.services.profile_photo_service import profile_photo_url


def _room_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


async def _unique_room_code(db: AsyncSession) -> str:
    for _ in range(20):
        code = _room_code()
        exists = (await db.execute(select(Room).where(Room.room_code == code))).scalar_one_or_none()
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Unable to allocate a room code")


def _player_side(room: Room, current_user_id: str | None) -> str:
    if not current_user_id:
        return "spectator"
    for participant in room.participants:
        if current_user_id == participant.user_profile_id and participant.resolved_side:
            return participant.resolved_side
    if room.game and current_user_id == room.game.white_player_id:
        return "white"
    if room.game and current_user_id == room.game.black_player_id:
        return "black"
    return "spectator"


def _host_user_id(room: Room) -> str | None:
    if room.participants:
        return room.participants[0].user_profile_id
    if room.game:
        return room.game.white_player_id or room.game.black_player_id
    return None


ROOM_LOAD_OPTIONS = (
    selectinload(Room.game).selectinload(Game.white_player),
    selectinload(Room.game).selectinload(Game.black_player),
    selectinload(Room.participants).selectinload(RoomParticipant.user_profile),
)


def _normalize_seat_preference(value: str | None, default: str = "random") -> str:
    normalized = (value or default).strip().lower()
    if normalized not in {"white", "black", "random"}:
        raise HTTPException(status_code=400, detail="sidePreference must be white, black, or random")
    return normalized


def _resolve_host_side(side_preference: str) -> str:
    if side_preference == "random":
        return random.choice(["white", "black"])
    return side_preference


def _is_expired(room: Room) -> bool:
    if not room.invite_expires_at:
        return False
    expires_at = room.invite_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=utcnow().tzinfo)
    return room.status == "waiting" and expires_at <= utcnow()


def _serialize_participant(participant: RoomParticipant) -> dict:
    username = participant.user_profile.username if participant.user_profile else "Unknown user"
    return {
        "userId": participant.user_profile_id,
        "username": username,
        "photoUrl": profile_photo_url(participant.user_profile),
        "role": participant.role,
        "seatPreference": participant.seat_preference,
        "resolvedSide": participant.resolved_side,
        "joinedAt": participant.joined_at,
        "lastSeenAt": participant.last_seen_at,
    }


def serialize_room(room: Room, current_user_id: str | None = None) -> dict:
    white_player = room.game.white_player if room.game else None
    black_player = room.game.black_player if room.game else None
    return {
        "roomCode": room.room_code,
        "code": room.room_code,
        "gameId": room.game_id,
        "invitePath": f"/play/friend?code={room.room_code}",
        "status": room.status,
        "whiteUserId": room.game.white_player_id if room.game else None,
        "blackUserId": room.game.black_player_id if room.game else None,
        "currentUserId": current_user_id,
        "playerSide": _player_side(room, current_user_id),
        "whitePlayer": serialize_player(white_player, "white", "friend") if white_player else None,
        "blackPlayer": serialize_player(black_player, "black", "friend") if black_player else None,
        "timeControl": time_control_payload(room.game) if room.game else None,
        "clocks": clock_payload(room.game) if room.game else None,
        "activeMatchRedirect": bool(getattr(room, "_active_match_redirect", False)),
        "participants": [_serialize_participant(participant) for participant in room.participants],
        "inviteExpiresAt": room.invite_expires_at,
        "createdAt": room.created_at,
        "updatedAt": room.updated_at,
    }


async def _add_participant(
    db: AsyncSession,
    room: Room,
    user: UserProfile,
    side_preference: str,
    resolved_side: str | None,
    role: str = "player",
) -> RoomParticipant:
    existing = (
        await db.execute(
            select(RoomParticipant).where(RoomParticipant.room_id == room.id, RoomParticipant.user_profile_id == user.id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.last_seen_at = utcnow()
        existing.seat_preference = side_preference
        if resolved_side:
            existing.resolved_side = resolved_side
        db.add(existing)
        return existing

    participant = RoomParticipant(
        room_id=room.id,
        user_profile_id=user.id,
        role=role,
        seat_preference=side_preference,
        resolved_side=resolved_side,
        joined_at=utcnow(),
        last_seen_at=utcnow(),
    )
    db.add(participant)
    return participant


def _seat_user(game: Game, user: UserProfile, side: str) -> None:
    if side == "white":
        game.white_player_id = user.id
    else:
        game.black_player_id = user.id


async def room_for_game(db: AsyncSession, game_id: int) -> Room | None:
    return (
        await db.execute(
            select(Room)
            .options(*ROOM_LOAD_OPTIONS)
            .where(Room.game_id == game_id)
        )
    ).scalar_one_or_none()


async def _active_match_conflict_detail(db: AsyncSession, active_game: Game) -> dict:
    active_room = await room_for_game(db, active_game.id)
    return {
        "message": "Active match already exists",
        "activeGameId": active_game.id,
        "roomCode": active_room.room_code if active_room else None,
    }


async def create_room(
    db: AsyncSession,
    user: UserProfile,
    side_preference: str | None = None,
    time_control: TimeControlIn | None = None,
) -> Room:
    active_game = await active_game_for_user(db, user)
    if active_game:
        active_room = await room_for_game(db, active_game.id)
        if active_room:
            setattr(active_room, "_active_match_redirect", True)
            return active_room
        raise HTTPException(status_code=409, detail=await _active_match_conflict_detail(db, active_game))

    normalized_preference = _normalize_seat_preference(side_preference, default="white")
    host_side = _resolve_host_side(normalized_preference)
    game = Game(
        mode="friend",
        status="active",
        current_fen=chess.Board().fen(),
        pgn="",
    )
    if host_side == "white":
        game.white_player_id = user.id
    else:
        game.black_player_id = user.id
    configure_time_control(game, time_control, start_if_ready=False)
    db.add(game)
    await db.flush()

    room = Room(
        room_code=await _unique_room_code(db),
        game_id=game.id,
        status="waiting",
        invite_expires_at=utcnow() + timedelta(hours=get_settings().room_invite_ttl_hours),
        updated_at=utcnow(),
    )
    db.add(room)
    await db.flush()
    await _add_participant(db, room, user, normalized_preference, host_side)
    await db.commit()
    return await get_room_or_404(db, room.room_code)


async def get_room_or_404(db: AsyncSession, room_code: str) -> Room:
    room = (
        await db.execute(
            select(Room)
            .options(*ROOM_LOAD_OPTIONS)
            .where(Room.room_code == room_code.upper())
        )
    ).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if _is_expired(room):
        room.status = "expired"
        if room.game:
            room.game.status = "expired"
            room.game.updated_at = utcnow()
            db.add(room.game)
        room.updated_at = utcnow()
        db.add(room)
        await db.commit()
        await db.refresh(room)
    return room


async def join_room(
    db: AsyncSession,
    room_code: str,
    user: UserProfile,
    side_preference: str | None = None,
) -> Room:
    normalized_preference = _normalize_seat_preference(side_preference)
    room = await get_room_or_404(db, room_code)
    active_game = await active_game_for_user(db, user, exclude_game_id=room.game_id)
    if active_game:
        raise HTTPException(status_code=409, detail=await _active_match_conflict_detail(db, active_game))

    if _is_expired(room):
        room.status = "expired"
        room.updated_at = utcnow()
        db.add(room)
        await db.commit()
        raise HTTPException(status_code=400, detail="Room invite has expired")
    if room.status == "finished":
        raise HTTPException(status_code=400, detail="Room is already finished")
    if room.status == "expired":
        raise HTTPException(status_code=400, detail="Room invite has expired")
    if room.status == "cancelled":
        raise HTTPException(status_code=400, detail="Room invite has been cancelled")

    if room.game.white_player_id == user.id:
        await _add_participant(db, room, user, normalized_preference, "white")
        await db.commit()
        return await get_room_or_404(db, room.room_code)
    if room.game.black_player_id == user.id:
        await _add_participant(db, room, user, normalized_preference, "black")
        await db.commit()
        return await get_room_or_404(db, room.room_code)
    if room.game.white_player_id and room.game.black_player_id:
        raise HTTPException(status_code=400, detail="Room already has two players")

    user_side = "black" if room.game.white_player_id else "white"
    _seat_user(room.game, user, user_side)
    room.status = "active"
    room.game.status = "active"
    start_clock_if_ready(room.game)
    room.updated_at = utcnow()
    await _add_participant(db, room, user, normalized_preference, user_side)
    db.add(room.game)
    db.add(room)
    await db.commit()
    return await get_room_or_404(db, room.room_code)


async def cancel_room(db: AsyncSession, room_code: str, user: UserProfile) -> Room:
    room = await get_room_or_404(db, room_code)
    if room.status == "expired":
        raise HTTPException(status_code=400, detail="Room invite has expired")
    if room.status == "cancelled":
        return room
    if room.status != "waiting":
        raise HTTPException(status_code=400, detail="Only waiting rooms can be cancelled")

    if user.id != _host_user_id(room):
        raise HTTPException(status_code=403, detail="Only the host can cancel this room")

    room.status = "cancelled"
    if room.game:
        room.game.status = "cancelled"
        room.game.updated_at = utcnow()
        db.add(room.game)
    room.updated_at = utcnow()
    db.add(room)
    await db.commit()
    return await get_room_or_404(db, room.room_code)
