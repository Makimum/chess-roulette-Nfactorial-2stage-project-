from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Game, Room, RoomParticipant, UserProfile
from app.schemas.agora import AgoraPublicConfigOut, AgoraRtcTokenOut, AgoraRtcTokenRequest
from app.services import auth_service
from app.services.agora_service import (
    build_rtc_token,
    channel_for_game,
    channel_for_room,
    generate_rtc_uid,
    public_agora_config,
    uid_for_identity,
    validate_channel_name,
)


router = APIRouter(prefix="/api/agora", tags=["agora"])


async def _room_for_code(db: AsyncSession, room_code: str) -> Room:
    room = (
        await db.execute(
            select(Room)
            .options(
                selectinload(Room.game),
                selectinload(Room.participants).selectinload(RoomParticipant.user_profile),
            )
            .where(Room.room_code == room_code.strip().upper())
        )
    ).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def _game_for_id(db: AsyncSession, game_id: int) -> Game:
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


def _assert_room_member(room: Room, user: UserProfile) -> None:
    participant_user_ids = {participant.user_profile_id for participant in room.participants}
    game_user_ids = {room.game.white_player_id, room.game.black_player_id} if room.game else set()
    if user.id not in participant_user_ids and user.id not in game_user_ids:
        raise HTTPException(status_code=403, detail="This user is not a room participant")


def _assert_game_member(game: Game, user: UserProfile) -> None:
    if user.id not in {game.white_player_id, game.black_player_id}:
        raise HTTPException(status_code=403, detail="This user is not a game participant")


@router.get("/config", response_model=AgoraPublicConfigOut)
async def get_agora_config() -> dict:
    return public_agora_config()


@router.post("/rtc-token", response_model=AgoraRtcTokenOut)
async def create_rtc_token(
    payload: AgoraRtcTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    if payload.roomCode:
        room = await _room_for_code(db, payload.roomCode)
        _assert_room_member(room, current_user)
        channel_name = channel_for_room(room.room_code)
    elif payload.gameId:
        game = await _game_for_id(db, payload.gameId)
        _assert_game_member(game, current_user)
        channel_name = channel_for_game(game.id)
    elif payload.channelName:
        channel_name = validate_channel_name(payload.channelName)
    else:
        raise HTTPException(status_code=400, detail="channelName, roomCode, or gameId is required")

    if payload.uid:
        uid = payload.uid
    elif payload.clientInstanceId:
        uid = uid_for_identity(f"user:{current_user.id}:channel:{channel_name}:client:{payload.clientInstanceId}")
    else:
        uid = generate_rtc_uid()
    return build_rtc_token(channel_name, uid, payload.role)
