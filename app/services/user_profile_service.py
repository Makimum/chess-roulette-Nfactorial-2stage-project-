from __future__ import annotations

from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Game, UserProfile
from app.services.profile_photo_service import profile_photo_url


PLAYABLE_STATUSES = {"active", "check"}
KNOWN_MODES = ("ai", "friend", "local")


def _empty_mode_results() -> dict[str, int]:
    return {"games": 0, "completed": 0, "active": 0, "wins": 0, "losses": 0, "draws": 0}


def _round_rate(value: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((value / total) * 100, 2)


def _played_as(game: Game, user_id: str) -> str:
    is_white = game.white_player_id == user_id
    is_black = game.black_player_id == user_id
    if is_white and is_black:
        return "both"
    if is_white:
        return "white"
    if is_black:
        return "black"
    return "none"


def _result_for_user(game: Game, user_id: str) -> str:
    if game.result is None:
        return "active" if game.status in PLAYABLE_STATUSES else game.status

    played_as = _played_as(game, user_id)
    if played_as == "both":
        return "draw" if game.result == "1/2-1/2" else "completed"
    if game.result == "1/2-1/2":
        return "draw"
    if game.result == "1-0":
        return "win" if played_as == "white" else "loss"
    if game.result == "0-1":
        return "win" if played_as == "black" else "loss"
    return "completed"


def _opponent_payload(game: Game, user_id: str) -> dict:
    played_as = _played_as(game, user_id)
    if played_as == "white":
        opponent = game.black_player
        ai_side = "black"
    elif played_as == "black":
        opponent = game.white_player
        ai_side = "white"
    else:
        opponent = None
        ai_side = "ai"

    if opponent:
        return {
            "id": opponent.id,
            "username": opponent.username,
            "photoUrl": profile_photo_url(opponent),
            "rating": opponent.rating,
            "isAi": False,
        }
    if game.mode == "ai":
        return {
            "id": f"ai_{ai_side}",
            "username": "Mentor AI",
            "photoUrl": None,
            "rating": 1500,
            "isAi": True,
        }
    if played_as == "both":
        return {
            "id": user_id,
            "username": "Self play",
            "photoUrl": None,
            "rating": None,
            "isAi": False,
        }
    return {
        "id": None,
        "username": "Open seat",
        "photoUrl": None,
        "rating": None,
        "isAi": False,
    }


def _current_streak(games: list[Game], user_id: str) -> dict[str, int | str] | None:
    streak_type: str | None = None
    count = 0
    for game in games:
        result = _result_for_user(game, user_id)
        if result not in {"win", "loss", "draw"}:
            continue
        if streak_type is None:
            streak_type = result
            count = 1
            continue
        if result != streak_type:
            break
        count += 1
    if streak_type is None:
        return None
    return {"type": streak_type, "count": count}


def _serialize_recent_game(game: Game, user_id: str) -> dict:
    return {
        "gameId": game.id,
        "mode": game.mode,
        "status": game.status,
        "result": game.result,
        "resultForUser": _result_for_user(game, user_id),
        "playedAs": _played_as(game, user_id),
        "opponent": _opponent_payload(game, user_id),
        "createdAt": game.created_at,
        "updatedAt": game.updated_at,
    }


async def _leaderboard_rank(db: AsyncSession, user: UserProfile) -> int:
    better_users = await db.scalar(
        select(func.count())
        .select_from(UserProfile)
        .where(
            or_(
                UserProfile.rating > user.rating,
                and_(UserProfile.rating == user.rating, UserProfile.wins > user.wins),
            )
        )
    )
    return int(better_users or 0) + 1


async def _games_for_user(db: AsyncSession, user_id: str) -> list[Game]:
    stmt = (
        select(Game)
        .options(selectinload(Game.white_player), selectinload(Game.black_player))
        .where(or_(Game.white_player_id == user_id, Game.black_player_id == user_id))
        .order_by(Game.updated_at.desc())
    )
    return list((await db.execute(stmt)).scalars())


async def _profile_payload(db: AsyncSession, user: UserProfile, recent_limit: int) -> dict:
    games = await _games_for_user(db, user.id)
    completed_games = [game for game in games if game.result is not None]
    active_games = [game for game in games if game.result is None and game.status in PLAYABLE_STATUSES]
    mode_counts = {mode: 0 for mode in KNOWN_MODES}
    mode_results: defaultdict[str, dict[str, int]] = defaultdict(_empty_mode_results)
    for mode in KNOWN_MODES:
        mode_results[mode]
    games_as_white = 0
    games_as_black = 0
    games_as_both = 0

    for game in games:
        mode_counts.setdefault(game.mode, 0)
        mode_counts[game.mode] += 1
        mode_result = mode_results[game.mode]
        mode_result["games"] += 1

        if game.result is None and game.status in PLAYABLE_STATUSES:
            mode_result["active"] += 1
        elif game.result is not None:
            mode_result["completed"] += 1

        played_as = _played_as(game, user.id)
        if played_as == "white":
            games_as_white += 1
        elif played_as == "black":
            games_as_black += 1
        elif played_as == "both":
            games_as_both += 1

        result = _result_for_user(game, user.id)
        if result in {"win", "loss", "draw"}:
            result_key = "losses" if result == "loss" else f"{result}s"
            mode_result[result_key] += 1

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "photoUrl": profile_photo_url(user),
            "countryCode": user.country_code or "XX",
            "rating": user.rating,
            "createdAt": user.created_at,
            "registeredAt": user.registered_at,
        },
        "stats": {
            "leaderboardRank": await _leaderboard_rank(db, user),
            "rating": user.rating,
            "wins": user.wins,
            "losses": user.losses,
            "draws": user.draws,
            "totalGames": len(games),
            "completedGames": len(completed_games),
            "activeGames": len(active_games),
            "winRate": _round_rate(user.wins, len(completed_games)),
            "lossRate": _round_rate(user.losses, len(completed_games)),
            "drawRate": _round_rate(user.draws, len(completed_games)),
            "gamesAsWhite": games_as_white,
            "gamesAsBlack": games_as_black,
            "gamesAsBoth": games_as_both,
            "gamesByMode": mode_counts,
            "resultsByMode": dict(mode_results),
            "currentStreak": _current_streak(completed_games, user.id),
            "lastGameAt": games[0].updated_at if games else None,
        },
        "recentGames": [_serialize_recent_game(game, user.id) for game in games[:recent_limit]],
    }


async def public_profile_by_id(db: AsyncSession, user_id: str, recent_limit: int = 10) -> dict:
    user = await db.get(UserProfile, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _profile_payload(db, user, recent_limit)


async def public_profile_by_username(db: AsyncSession, username: str, recent_limit: int = 10) -> dict:
    user = (
        await db.execute(
            select(UserProfile).where(func.lower(UserProfile.username) == username.strip().lower())
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _profile_payload(db, user, recent_limit)
