from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import UserProfile
from app.schemas.room import CancelRoomRequest, CreateRoomRequest, JoinRoomRequest, RoomOut
from app.services import auth_service
from app.services.room_service import cancel_room, create_room, get_room_or_404, join_room, serialize_room


router = APIRouter(prefix="/api", tags=["rooms"])


@router.post("/rooms", response_model=RoomOut)
async def create(
    payload: CreateRoomRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    side_preference = payload.sidePreference if payload else None
    time_control = payload.timeControl if payload else None
    room = await create_room(db, current_user, side_preference, time_control)
    return serialize_room(room, current_user_id=current_user.id)


@router.get("/rooms/{room_code}", response_model=RoomOut)
async def get_room(
    room_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    return serialize_room(await get_room_or_404(db, room_code), current_user_id=current_user.id)


@router.post("/rooms/{room_code}/join", response_model=RoomOut)
async def join(
    room_code: str,
    payload: JoinRoomRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    room = await join_room(
        db,
        room_code,
        current_user,
        payload.sidePreference if payload else None,
    )
    return serialize_room(room, current_user_id=current_user.id)


@router.post("/rooms/{room_code}/cancel", response_model=RoomOut)
async def cancel(
    room_code: str,
    payload: CancelRoomRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    room = await cancel_room(db, room_code, current_user)
    return serialize_room(room, current_user_id=current_user.id)
