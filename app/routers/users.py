from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import UserProfile
from app.schemas.auth import AuthUserOut
from app.schemas.user import PublicUserProfileOut
from app.services import auth_service, profile_photo_service, user_profile_service


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/{user_id}/profile", response_model=PublicUserProfileOut)
async def get_public_user_profile(
    user_id: str,
    recentLimit: int = Query(default=10, ge=0, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await user_profile_service.public_profile_by_id(db, user_id, recentLimit)


@router.get("/by-username/{username}/profile", response_model=PublicUserProfileOut)
async def get_public_user_profile_by_username(
    username: str,
    recentLimit: int = Query(default=10, ge=0, le=50),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await user_profile_service.public_profile_by_username(db, username, recentLimit)


@router.post("/me/photo", response_model=AuthUserOut)
async def set_my_profile_photo(
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    current_user.photo_file_id = await profile_photo_service.upload_profile_photo(current_user, photo)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return auth_service.serialize_auth_user(current_user)


@router.delete("/me/photo", response_model=AuthUserOut)
async def delete_my_profile_photo(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    current_user.photo_file_id = None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return auth_service.serialize_auth_user(current_user)


@router.get("/{user_id}/photo")
async def get_profile_photo(user_id: str, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    user = await db.get(UserProfile, user_id)
    if not user or not user.photo_file_id:
        raise HTTPException(status_code=404, detail="Profile photo not found")
    return await profile_photo_service.profile_photo_response(user.photo_file_id)
