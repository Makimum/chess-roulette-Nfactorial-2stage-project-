from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import UserProfile
from app.schemas.game import (
    ActiveMatchOut,
    CreateGameOfferRequest,
    CreateGameRequest,
    GameEventOut,
    GameOfferOut,
    GameReviewOut,
    GameState,
    MoveResult,
    PositionsOut,
    ResignRequest,
    RespondGameOfferRequest,
)
from app.schemas.move import MoveOut, MoveRequest
from app.services import auth_service, chess_service, game_review_service, room_service


router = APIRouter(prefix="/api", tags=["games"])


@router.post("/games", response_model=GameState)
async def create_game(
    payload: CreateGameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.create_game(db, payload, current_user)
    return chess_service.serialize_game(game)


@router.get("/games/active", response_model=ActiveMatchOut)
async def active_match(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.active_game_for_user(db, current_user)
    if not game:
        return {"hasActiveMatch": False, "game": None, "gameId": None, "roomCode": None}
    room = await room_service.room_for_game(db, game.id)
    return {
        "hasActiveMatch": True,
        "game": chess_service.serialize_game(game),
        "gameId": game.id,
        "roomCode": room.room_code if room else None,
    }


@router.get("/games/{game_id}", response_model=GameState)
async def get_game(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return chess_service.serialize_game(game)


@router.post("/games/{game_id}/move", response_model=MoveResult)
async def make_move(
    game_id: int,
    payload: MoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    updated_game, move = await chess_service.apply_move(db, game, payload, current_user)
    return {"game": chess_service.serialize_game(updated_game), "move": chess_service.serialize_move(move)}


@router.post("/games/{game_id}/ai-move", response_model=MoveResult)
async def make_ai_move(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    updated_game, move = await chess_service.ai_move(db, game, current_user)
    return {"game": chess_service.serialize_game(updated_game), "move": chess_service.serialize_move(move)}


@router.get("/games/{game_id}/moves", response_model=list[MoveOut])
async def get_moves(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> list[dict]:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return [chess_service.serialize_move(move) for move in game.moves]


@router.get("/games/{game_id}/positions", response_model=PositionsOut)
async def get_positions(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return {"gameId": game.id, "positions": chess_service.positions_for_game(game)}


@router.get("/games/{game_id}/review", response_model=GameReviewOut)
@router.post("/games/{game_id}/review", response_model=GameReviewOut)
async def game_review(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return await asyncio.to_thread(game_review_service.review_game, game)


@router.post("/games/{game_id}/offers", response_model=GameOfferOut)
async def create_offer(
    game_id: int,
    payload: CreateGameOfferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    offer = await chess_service.create_game_offer(db, game, payload, current_user)
    return chess_service.serialize_game_offer(offer)


@router.get("/games/{game_id}/offers", response_model=list[GameOfferOut])
async def get_offers(
    game_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> list[dict]:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return [chess_service.serialize_game_offer(offer) for offer in await chess_service.list_game_offers(db, game_id)]


@router.post("/games/{game_id}/offers/{offer_id}/respond", response_model=GameOfferOut)
async def respond_offer(
    game_id: int,
    offer_id: int,
    payload: RespondGameOfferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    offer = await chess_service.respond_to_game_offer(db, game, offer_id, payload, current_user)
    return chess_service.serialize_game_offer(offer)


@router.get("/games/{game_id}/events", response_model=list[GameEventOut])
async def get_events(
    game_id: int,
    afterSeq: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> list[dict]:
    game = await chess_service.get_game_or_404(db, game_id)
    chess_service.assert_user_can_view_game(game, current_user)
    return [chess_service.serialize_game_event(event) for event in await chess_service.list_game_events(db, game_id, afterSeq)]


@router.post("/games/{game_id}/resign", response_model=GameState)
async def resign(
    game_id: int,
    payload: ResignRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> dict:
    game = await chess_service.get_game_or_404(db, game_id)
    updated = await chess_service.resign_game(db, game, current_user)
    return chess_service.serialize_game(updated)


@router.get("/users/me/games", response_model=list[GameState])
async def authenticated_user_games(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(auth_service.get_current_user_from_bearer_token),
) -> list[dict]:
    return [chess_service.serialize_game(game) for game in await auth_service.recent_games_for_user(db, current_user)]
