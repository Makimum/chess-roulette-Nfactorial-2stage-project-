from __future__ import annotations

import logging
import json
from datetime import datetime, timedelta, timezone

import chess
from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.models import Game, GameActionOffer, GameEvent, Move, Room, RoomParticipant, UserProfile, utcnow
from app.schemas.game import CreateGameOfferRequest, CreateGameRequest, RespondGameOfferRequest, TimeControlIn
from app.schemas.move import MoveRequest
from app.services.profile_photo_service import profile_photo_url
from app.services.stockfish_service import StockfishService


PLAYABLE_STATUSES = {"active", "check"}
TERMINAL_STATUSES = {"checkmate", "stalemate", "draw", "resigned", "timeout", "cancelled", "expired"}
OFFER_TYPES = {"draw", "undo", "rematch"}
PROMOTION_PIECES = {"q", "r", "b", "n"}
WIN_RATING_DELTA = 12
LOSS_RATING_DELTA = 8
DRAW_RATING_DELTA = 1
MIN_RATING = 0
logger = logging.getLogger(__name__)


GAME_LOAD_OPTIONS = (
    selectinload(Game.moves),
    selectinload(Game.white_player),
    selectinload(Game.black_player),
)


def _aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _side_to_move(game: Game) -> str:
    return "white" if chess.Board(game.current_fen).turn == chess.WHITE else "black"


def _player_id_for_side(game: Game, side: str) -> str | None:
    return game.white_player_id if side == "white" else game.black_player_id


def _has_time_control(game: Game) -> bool:
    return bool(game.time_control_initial_seconds and game.white_time_ms is not None and game.black_time_ms is not None)


def _clock_can_run(game: Game) -> bool:
    if not _has_time_control(game) or game.status not in PLAYABLE_STATUSES or game.result is not None:
        return False
    if game.mode == "friend" and not (game.white_player_id and game.black_player_id):
        return False
    current_player_id = _player_id_for_side(game, _side_to_move(game))
    if game.mode != "ai" and current_player_id is None:
        return False
    return True


def _clock_elapsed_ms(game: Game, now: datetime | None = None) -> int:
    started_at = _aware_utc(game.turn_started_at)
    if not started_at or not _clock_can_run(game):
        return 0
    now = now or utcnow()
    return max(0, int((now - started_at).total_seconds() * 1000))


def _clock_times_now(game: Game, now: datetime | None = None) -> tuple[int | None, int | None]:
    if not _has_time_control(game):
        return None, None
    now = now or utcnow()
    white_ms = game.white_time_ms
    black_ms = game.black_time_ms
    elapsed_ms = _clock_elapsed_ms(game, now)
    if elapsed_ms and _side_to_move(game) == "white" and white_ms is not None:
        white_ms = max(0, white_ms - elapsed_ms)
    elif elapsed_ms and black_ms is not None:
        black_ms = max(0, black_ms - elapsed_ms)
    return white_ms, black_ms


def _time_control_payload(game: Game) -> dict | None:
    if not game.time_control_initial_seconds:
        return None
    return {
        "initialSeconds": game.time_control_initial_seconds,
        "incrementSeconds": game.time_increment_seconds or 0,
    }


def clock_payload(game: Game) -> dict | None:
    if not _has_time_control(game):
        return None
    now = utcnow()
    white_ms, black_ms = _clock_times_now(game, now)
    return {
        "whiteTimeMs": white_ms,
        "blackTimeMs": black_ms,
        "turnStartedAt": game.turn_started_at,
        "serverNow": now,
        "isRunning": _clock_can_run(game) and game.turn_started_at is not None,
    }


def _configure_time_control(game: Game, time_control: TimeControlIn | None, *, start_if_ready: bool = True) -> None:
    if not time_control:
        return
    initial_ms = time_control.initialSeconds * 1000
    game.time_control_initial_seconds = time_control.initialSeconds
    game.time_increment_seconds = time_control.incrementSeconds
    game.white_time_ms = initial_ms
    game.black_time_ms = initial_ms
    game.turn_started_at = utcnow() if start_if_ready and _clock_can_run(game) else None


def configure_time_control(game: Game, time_control: TimeControlIn | None, *, start_if_ready: bool = True) -> None:
    _configure_time_control(game, time_control, start_if_ready=start_if_ready)


def _start_clock_if_ready(game: Game) -> None:
    if _clock_can_run(game) and game.turn_started_at is None:
        game.turn_started_at = utcnow()


def start_clock_if_ready(game: Game) -> None:
    _start_clock_if_ready(game)


def time_control_payload(game: Game) -> dict | None:
    return _time_control_payload(game)


def _stop_clock(game: Game) -> None:
    if _has_time_control(game):
        game.turn_started_at = None


def _apply_elapsed_to_clock(game: Game, side: str, now: datetime) -> None:
    if not _has_time_control(game):
        return
    elapsed_ms = _clock_elapsed_ms(game, now)
    if side == "white" and game.white_time_ms is not None:
        game.white_time_ms = max(0, game.white_time_ms - elapsed_ms)
    elif side == "black" and game.black_time_ms is not None:
        game.black_time_ms = max(0, game.black_time_ms - elapsed_ms)


def _apply_increment_after_move(game: Game, side: str) -> None:
    if not _has_time_control(game):
        return
    increment_ms = (game.time_increment_seconds or 0) * 1000
    if side == "white" and game.white_time_ms is not None:
        game.white_time_ms += increment_ms
    elif side == "black" and game.black_time_ms is not None:
        game.black_time_ms += increment_ms


def _set_timeout_result(game: Game, loser_side: str, now: datetime) -> None:
    winner_side = "black" if loser_side == "white" else "white"
    game.status = "timeout"
    game.result = "0-1" if loser_side == "white" else "1-0"
    game.winner_player_id = _player_id_for_side(game, winner_side)
    if loser_side == "white":
        game.white_time_ms = 0
    else:
        game.black_time_ms = 0
    game.turn_started_at = None
    game.updated_at = now


async def flag_game_if_needed(db: AsyncSession, game: Game) -> bool:
    if not _clock_can_run(game):
        return False
    now = utcnow()
    white_ms, black_ms = _clock_times_now(game, now)
    side = _side_to_move(game)
    if side == "white" and white_ms == 0:
        _set_timeout_result(game, "white", now)
    elif side == "black" and black_ms == 0:
        _set_timeout_result(game, "black", now)
    else:
        return False

    _record_completed_game_stats(game)
    db.add(game)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        "timeout",
        actor_user_id=None,
        payload={"loserSide": side, "result": game.result, "winnerPlayerId": game.winner_player_id},
    )
    await db.commit()
    return True


async def active_game_for_user(
    db: AsyncSession,
    user: UserProfile,
    *,
    exclude_game_id: int | None = None,
) -> Game | None:
    room_participant_game = (
        select(Room.game_id)
        .join(RoomParticipant, RoomParticipant.room_id == Room.id)
        .where(
            RoomParticipant.user_profile_id == user.id,
            RoomParticipant.role == "player",
            RoomParticipant.resolved_side.is_not(None),
        )
    )
    stmt = (
        select(Game)
        .options(*GAME_LOAD_OPTIONS)
        .where(
            or_(
                Game.white_player_id == user.id,
                Game.black_player_id == user.id,
                Game.id.in_(room_participant_game),
            ),
            Game.mode != "ai",
            Game.status.in_(PLAYABLE_STATUSES),
            Game.result.is_(None),
        )
        .order_by(Game.updated_at.desc())
    )
    for game in (await db.execute(stmt)).scalars():
        if exclude_game_id is not None and game.id == exclude_game_id:
            continue
        if await flag_game_if_needed(db, game):
            continue
        await sync_friend_game_seats_from_room(db, game)
        return await get_game_or_404(db, game.id)
    return None


async def sync_friend_game_seats_from_room(db: AsyncSession, game: Game) -> None:
    if game.mode != "friend":
        return
    room = (
        await db.execute(
            select(Room)
            .options(selectinload(Room.participants))
            .where(Room.game_id == game.id)
        )
    ).scalar_one_or_none()
    if not room:
        return

    changed = False
    for participant in room.participants:
        if participant.role != "player":
            continue
        if participant.resolved_side == "white" and game.white_player_id is None:
            game.white_player_id = participant.user_profile_id
            changed = True
        elif participant.resolved_side == "black" and game.black_player_id is None:
            game.black_player_id = participant.user_profile_id
            changed = True

    if changed:
        db.add(game)
        await db.commit()


async def create_game(db: AsyncSession, payload: CreateGameRequest, user: UserProfile) -> Game:
    active_game = await active_game_for_user(db, user)
    if active_game:
        setattr(active_game, "_active_match_redirect", True)
        return active_game

    side = payload.side or "white"
    white_player_id = user.id if payload.mode == "local" or side == "white" else None
    black_player_id = user.id if payload.mode == "local" or side == "black" else None
    game = Game(
        mode=payload.mode,
        status="active",
        current_fen=chess.Board().fen(),
        pgn="",
        white_player_id=white_player_id,
        black_player_id=black_player_id,
    )
    configure_time_control(game, payload.timeControl, start_if_ready=True)
    db.add(game)
    await db.commit()
    return await get_game_or_404(db, game.id)


async def get_game_or_404(db: AsyncSession, game_id: int) -> Game:
    game = (
        await db.execute(
            select(Game)
            .options(*GAME_LOAD_OPTIONS)
            .where(Game.id == game_id)
        )
    ).scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if await flag_game_if_needed(db, game):
        game = (
            await db.execute(
                select(Game)
                .options(*GAME_LOAD_OPTIONS)
                .where(Game.id == game_id)
            )
        ).scalar_one()
    return game


def serialize_move(move: Move) -> dict:
    return {
        "id": move.id,
        "moveNumber": move.move_number,
        "ply": move.move_number,
        "color": move.color,
        "uci": move.uci,
        "san": move.san,
        "fenBefore": move.fen_before,
        "fenAfter": move.fen_after,
        "createdAt": move.created_at,
    }


def serialize_player(user: UserProfile | None, side: str, mode: str) -> dict:
    if user:
        return {
            "id": user.id,
            "name": user.username,
            "username": user.username,
            "photoUrl": profile_photo_url(user),
            "countryCode": user.country_code or "XX",
            "rating": user.rating,
            "wins": user.wins,
            "losses": user.losses,
            "draws": user.draws,
            "isAi": False,
        }
    if mode == "ai":
        name = "Mentor AI"
        rating = 1500
        player_id = f"ai_{side}"
    else:
        name = f"{side.title()} player"
        rating = 100
        player_id = f"open_{side}"
    return {
        "id": player_id,
        "name": name,
        "username": name,
        "photoUrl": None,
        "countryCode": None,
        "rating": rating,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "isAi": mode == "ai",
    }


def serialize_game(game: Game) -> dict:
    board = chess.Board(game.current_fen)
    white = serialize_player(game.white_player, "white", game.mode)
    black = serialize_player(game.black_player, "black", game.mode)
    moves = [serialize_move(move) for move in sorted(game.moves, key=lambda item: item.move_number)]
    return {
        "gameId": game.id,
        "id": game.id,
        "mode": game.mode,
        "status": game.status,
        "result": game.result,
        "currentFen": game.current_fen,
        "fen": game.current_fen,
        "pgn": game.pgn,
        "sideToMove": "white" if board.turn == chess.WHITE else "black",
        "moveHistory": moves,
        "whitePlayer": white,
        "blackPlayer": black,
        "white": white,
        "black": black,
        "winnerPlayerId": game.winner_player_id,
        "timeControl": _time_control_payload(game),
        "clocks": clock_payload(game),
        "activeMatchRedirect": bool(getattr(game, "_active_match_redirect", False)),
        "isTerminal": game.status in TERMINAL_STATUSES or game.result is not None,
        "createdAt": game.created_at,
        "updatedAt": game.updated_at,
    }


def _status_for_board(board: chess.Board) -> tuple[str, str | None]:
    if board.is_checkmate():
        return "checkmate", "0-1" if board.turn == chess.WHITE else "1-0"
    if board.is_stalemate():
        return "stalemate", "1/2-1/2"
    if board.is_insufficient_material() or board.is_seventyfive_moves() or board.is_fivefold_repetition():
        return "draw", "1/2-1/2"
    if board.is_check():
        return "check", None
    return "active", None


def _winner_for_result(game: Game, result: str | None) -> str | None:
    if result == "1-0":
        return game.white_player_id
    if result == "0-1":
        return game.black_player_id
    return None


def _pgn_from_moves(moves: list[Move], result: str | None = None) -> str:
    parts: list[str] = []
    for index, move in enumerate(sorted(moves, key=lambda item: item.move_number)):
        if index % 2 == 0:
            parts.append(f"{index // 2 + 1}. {move.san}")
        else:
            parts[-1] = f"{parts[-1]} {move.san}"
    if result:
        parts.append(result)
    return " ".join(parts)


def _json_payload(payload: dict | None = None) -> str:
    return json.dumps(payload or {}, separators=(",", ":"), default=str)


def _parse_json_payload(payload_json: str | None) -> dict:
    if not payload_json:
        return {}
    try:
        value = json.loads(payload_json)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


async def _room_id_for_game(db: AsyncSession, game_id: int) -> int | None:
    room = (await db.execute(select(Room).where(Room.game_id == game_id))).scalar_one_or_none()
    return room.id if room else None


async def record_game_event(
    db: AsyncSession,
    game_id: int,
    event_type: str,
    actor_user_id: str | None = None,
    payload: dict | None = None,
    room_id: int | None = None,
) -> GameEvent:
    if room_id is None:
        room_id = await _room_id_for_game(db, game_id)
    next_seq = (
        await db.execute(select(func.coalesce(func.max(GameEvent.seq), 0) + 1).where(GameEvent.game_id == game_id))
    ).scalar_one()
    event = GameEvent(
        game_id=game_id,
        room_id=room_id,
        seq=next_seq,
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload_json=_json_payload(payload),
    )
    db.add(event)
    await db.flush()
    return event


def _legal_moves_sample(board: chess.Board, limit: int = 20) -> list[str]:
    return [move.uci() for move in list(board.legal_moves)[:limit]]


def _move_payload_for_log(payload: MoveRequest) -> dict:
    return payload.model_dump(by_alias=True)


def _reject_move(
    game: Game,
    board: chess.Board,
    payload: MoveRequest,
    reason: str,
    normalized_uci: str | None = None,
) -> None:
    logger.warning(
        "Move rejected: game_id=%s current_fen=%s payload=%s normalized_uci=%s legal_moves_sample=%s reason=%s",
        game.id,
        game.current_fen,
        _move_payload_for_log(payload),
        normalized_uci,
        _legal_moves_sample(board),
        reason,
    )
    raise HTTPException(status_code=400, detail=reason)


def _normalize_uci(board: chess.Board, payload: MoveRequest) -> str:
    from_square = payload.from_square.lower()
    to_square = payload.to.lower()
    base_uci = f"{from_square}{to_square}"
    raw_promotion = (payload.promotion or "").strip().lower()

    try:
        from_index = chess.parse_square(from_square)
        to_index = chess.parse_square(to_square)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid move format: {base_uci}") from exc

    piece = board.piece_at(from_index)
    is_promotion_target = bool(
        piece
        and piece.piece_type == chess.PAWN
        and (
            (piece.color == chess.WHITE and chess.square_rank(to_index) == 7)
            or (piece.color == chess.BLACK and chess.square_rank(to_index) == 0)
        )
    )

    if not is_promotion_target:
        return base_uci

    if not raw_promotion:
        raise HTTPException(status_code=400, detail=f"Pawn promotion requires a promotion piece for {base_uci}")
    if raw_promotion not in PROMOTION_PIECES:
        raise HTTPException(status_code=400, detail=f"Invalid promotion piece: {raw_promotion}")
    return f"{base_uci}{raw_promotion}"


def assert_user_can_view_game(game: Game, user: UserProfile) -> None:
    if user.id not in {game.white_player_id, game.black_player_id}:
        raise HTTPException(status_code=403, detail="This user is not a participant in the game")


def _assert_user_can_move(game: Game, user: UserProfile, color: str) -> None:
    moving_player_id = game.white_player_id if color == "white" else game.black_player_id
    waiting_player_id = game.black_player_id if color == "white" else game.white_player_id

    if game.mode == "friend":
        if not (game.white_player_id and game.black_player_id):
            raise HTTPException(status_code=400, detail="Friend game requires two seated players")
        seated_player_ids = {player_id for player_id in (game.white_player_id, game.black_player_id) if player_id}
        if user.id not in seated_player_ids:
            raise HTTPException(status_code=400, detail="This user is not seated in this friend game")
        if not moving_player_id:
            raise HTTPException(status_code=400, detail=f"No player is assigned to {color}")
        if moving_player_id != user.id:
            raise HTTPException(status_code=400, detail=f"It is {color}'s turn; this user controls the other side")
        return

    if moving_player_id and moving_player_id != user.id:
        raise HTTPException(status_code=400, detail=f"It is {color}'s turn; this user does not control {color}")
    if not moving_player_id and waiting_player_id == user.id:
        raise HTTPException(status_code=400, detail=f"It is {color}'s turn; this user controls the other side")
    if game.mode == "ai" and not moving_player_id:
        raise HTTPException(status_code=400, detail="It is AI's turn")


def _apply_player_result(winner: UserProfile | None, loser: UserProfile | None) -> None:
    if winner:
        winner.wins += 1
        winner.rating += WIN_RATING_DELTA
    if loser:
        loser.losses += 1
        loser.rating = max(MIN_RATING, loser.rating - LOSS_RATING_DELTA)


def _record_completed_game_stats(game: Game) -> None:
    if game.result == "1-0":
        _apply_player_result(game.white_player, game.black_player)
    elif game.result == "0-1":
        _apply_player_result(game.black_player, game.white_player)
    elif game.result == "1/2-1/2":
        for player in (game.white_player, game.black_player):
            if player:
                player.draws += 1
                player.rating += DRAW_RATING_DELTA


async def apply_move(
    db: AsyncSession,
    game: Game,
    payload: MoveRequest,
    user: UserProfile | None = None,
    *,
    system_move: bool = False,
    stockfish: StockfishService | None = None,
) -> tuple[Game, Move]:
    if game.status not in PLAYABLE_STATUSES:
        _reject_move(
            game,
            chess.Board(game.current_fen),
            payload,
            f"Game is not active; current status is {game.status}",
        )
    if await flag_game_if_needed(db, game):
        _reject_move(
            game,
            chess.Board(game.current_fen),
            payload,
            "Game is not active; current status is timeout",
        )

    board = chess.Board(game.current_fen)
    try:
        uci = _normalize_uci(board, payload)
    except HTTPException as exc:
        _reject_move(game, board, payload, str(exc.detail))

    try:
        chess_move = chess.Move.from_uci(uci)
    except ValueError as exc:
        _reject_move(game, board, payload, f"Invalid move format: {uci}", uci)

    if chess_move not in board.legal_moves:
        _reject_move(game, board, payload, f"Illegal move: {uci} is not legal in the current position", uci)

    move_applied_at = utcnow()
    fen_before = board.fen()
    color = "white" if board.turn == chess.WHITE else "black"
    actor_user_id: str | None = None
    if system_move:
        moving_player_id = game.white_player_id if color == "white" else game.black_player_id
        if game.mode != "ai" or moving_player_id:
            _reject_move(game, board, payload, "System moves are only allowed for the AI side", uci)
    else:
        if not user:
            _reject_move(game, board, payload, "Authentication is required to make a move", uci)
        try:
            _assert_user_can_move(game, user, color)
        except HTTPException as exc:
            _reject_move(game, board, payload, str(exc.detail), uci)
        actor_user_id = user.id

    san = board.san(chess_move)
    board.push(chess_move)
    fen_after = board.fen()
    _apply_elapsed_to_clock(game, color, move_applied_at)

    move = Move(
        game_id=game.id,
        move_number=len(game.moves) + 1,
        color=color,
        uci=chess_move.uci(),
        san=san,
        fen_before=fen_before,
        fen_after=fen_after,
    )
    game.current_fen = fen_after
    game.status, game.result = _status_for_board(board)
    game.winner_player_id = _winner_for_result(game, game.result)
    game.updated_at = move_applied_at
    if game.result:
        _stop_clock(game)
        _record_completed_game_stats(game)
    else:
        _apply_increment_after_move(game, color)
        game.turn_started_at = move_applied_at if _clock_can_run(game) else None

    db.add(move)
    game.pgn = _pgn_from_moves([*game.moves, move], game.result)
    db.add(game)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        "move_made",
        actor_user_id=actor_user_id,
        payload={
            "moveId": move.id,
            "moveNumber": move.move_number,
            "color": move.color,
            "uci": move.uci,
            "san": move.san,
            "fenAfter": move.fen_after,
        },
    )
    if game.status == "check":
        await record_game_event(db, game.id, "check", actor_user_id=actor_user_id, payload={"colorInCheck": "white" if board.turn == chess.WHITE else "black"})
    elif game.status == "checkmate":
        await record_game_event(db, game.id, "checkmate", actor_user_id=actor_user_id, payload={"result": game.result, "winnerPlayerId": game.winner_player_id})
    elif game.status in {"stalemate", "draw"}:
        await record_game_event(db, game.id, "draw", actor_user_id=actor_user_id, payload={"result": game.result, "status": game.status})
    await db.commit()
    await db.refresh(move)
    return await get_game_or_404(db, game.id), move


async def ai_move(db: AsyncSession, game: Game, user: UserProfile) -> tuple[Game, Move]:
    if game.mode != "ai":
        raise HTTPException(status_code=400, detail="AI moves are only available for AI games")
    assert_user_can_view_game(game, user)
    if game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Game is not active; current status is {game.status}")

    stockfish = StockfishService()
    board = chess.Board(game.current_fen)
    ai_player_id = game.white_player_id if board.turn == chess.WHITE else game.black_player_id
    if ai_player_id:
        raise HTTPException(status_code=400, detail="It is not AI's turn")
    if not list(board.legal_moves):
        raise HTTPException(status_code=400, detail="No legal moves are available")

    selected = stockfish.choose_move(board)
    if not selected:
        raise HTTPException(status_code=400, detail="No legal moves are available")

    payload = MoveRequest.model_validate(
        {"from": chess.square_name(selected.from_square), "to": chess.square_name(selected.to_square), "promotion": selected.promotion and chess.piece_symbol(selected.promotion)}
    )
    return await apply_move(db, game, payload, system_move=True, stockfish=stockfish)


def positions_for_game(game: Game) -> list[str]:
    return [chess.Board().fen(), *[move.fen_after for move in sorted(game.moves, key=lambda item: item.move_number)]]


async def resign_game(db: AsyncSession, game: Game, user: UserProfile) -> Game:
    if game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Game is not active; current status is {game.status}")

    assert_user_can_view_game(game, user)
    await flag_game_if_needed(db, game)
    if game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Game is not active; current status is {game.status}")

    resigning_player_id = user.id

    if resigning_player_id == game.black_player_id:
        game.result = "1-0"
        game.winner_player_id = game.white_player_id
    elif resigning_player_id == game.white_player_id:
        game.result = "0-1"
        game.winner_player_id = game.black_player_id
    else:
        raise HTTPException(status_code=403, detail="This user is not a participant in the game")

    game.status = "resigned"
    _stop_clock(game)
    game.updated_at = utcnow()
    game.pgn = _pgn_from_moves(list(game.moves), game.result)
    if game.result:
        _record_completed_game_stats(game)
    db.add(game)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        "game_resigned",
        actor_user_id=resigning_player_id,
        payload={"result": game.result, "winnerPlayerId": game.winner_player_id},
    )
    await db.commit()
    return await get_game_or_404(db, game.id)


def _assert_game_participant(game: Game, user: UserProfile) -> None:
    if user.id not in {game.white_player_id, game.black_player_id}:
        raise HTTPException(status_code=403, detail="This user is not a participant in the game")


def _opponent_user_id(game: Game, user_id: str | None) -> str | None:
    if not user_id:
        return None
    if game.white_player_id == user_id:
        return game.black_player_id
    if game.black_player_id == user_id:
        return game.white_player_id
    return None


def serialize_game_offer(offer: GameActionOffer) -> dict:
    return {
        "id": offer.id,
        "gameId": offer.game_id,
        "roomId": offer.room_id,
        "offerType": offer.offer_type,
        "status": offer.status,
        "requestedByUserId": offer.requested_by_user_id,
        "targetUserId": offer.target_user_id,
        "payload": _parse_json_payload(offer.payload_json),
        "expiresAt": offer.expires_at,
        "createdAt": offer.created_at,
        "respondedAt": offer.responded_at,
    }


def serialize_game_event(event: GameEvent) -> dict:
    return {
        "id": event.id,
        "gameId": event.game_id,
        "roomId": event.room_id,
        "seq": event.seq,
        "eventType": event.event_type,
        "actorUserId": event.actor_user_id,
        "payload": _parse_json_payload(event.payload_json),
        "createdAt": event.created_at,
    }


async def create_game_offer(
    db: AsyncSession,
    game: Game,
    payload: CreateGameOfferRequest,
    requester: UserProfile,
) -> GameActionOffer:
    if game.mode != "friend":
        raise HTTPException(status_code=400, detail="Game offers are only available for friend games")
    offer_type = payload.offerType
    if offer_type not in OFFER_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported offer type")
    if offer_type in {"draw", "undo"} and game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"{offer_type} offers are only available for active games")

    _assert_game_participant(game, requester)
    target = await db.get(UserProfile, payload.targetUserId) if payload.targetUserId else None
    if payload.targetUserId and not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    if target:
        _assert_game_participant(game, target)
    target_user_id = target.id if target else _opponent_user_id(game, requester.id)
    if not target_user_id:
        raise HTTPException(status_code=400, detail="No opponent is available for this offer")
    room_id = await _room_id_for_game(db, game.id)
    offer = GameActionOffer(
        game_id=game.id,
        room_id=room_id,
        offer_type=offer_type,
        status="pending",
        requested_by_user_id=requester.id,
        target_user_id=target_user_id,
        payload_json=_json_payload(payload.payload),
        expires_at=utcnow() + timedelta(minutes=get_settings().game_offer_expire_minutes),
    )
    db.add(offer)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        f"{offer_type}_offered",
        actor_user_id=requester.id,
        room_id=room_id,
        payload={"offerId": offer.id, "targetUserId": target_user_id},
    )
    await db.commit()
    return await get_game_offer_or_404(db, game.id, offer.id)


async def get_game_offer_or_404(db: AsyncSession, game_id: int, offer_id: int) -> GameActionOffer:
    offer = (
        await db.execute(
            select(GameActionOffer)
            .options(
                selectinload(GameActionOffer.requested_by_user),
                selectinload(GameActionOffer.target_user),
            )
            .where(GameActionOffer.game_id == game_id, GameActionOffer.id == offer_id)
        )
    ).scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Game offer not found")
    return offer


async def list_game_offers(db: AsyncSession, game_id: int) -> list[GameActionOffer]:
    await expire_pending_game_offers(db, game_id)
    stmt = (
        select(GameActionOffer)
        .options(
            selectinload(GameActionOffer.requested_by_user),
            selectinload(GameActionOffer.target_user),
        )
        .where(GameActionOffer.game_id == game_id)
        .order_by(GameActionOffer.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars())


async def expire_pending_game_offers(db: AsyncSession, game_id: int) -> int:
    expired_offers = list(
        (
            await db.execute(
                select(GameActionOffer).where(
                    GameActionOffer.game_id == game_id,
                    GameActionOffer.status == "pending",
                    GameActionOffer.expires_at <= utcnow(),
                )
            )
        ).scalars()
    )
    for offer in expired_offers:
        offer.status = "expired"
        offer.responded_at = utcnow()
        db.add(offer)
        await record_game_event(
            db,
            game_id,
            f"{offer.offer_type}_expired",
            room_id=offer.room_id,
            payload={"offerId": offer.id},
        )
    if expired_offers:
        await db.commit()
    return len(expired_offers)


async def list_game_events(db: AsyncSession, game_id: int, after_seq: int | None = None) -> list[GameEvent]:
    stmt = (
        select(GameEvent)
        .options(selectinload(GameEvent.actor_user))
        .where(GameEvent.game_id == game_id)
        .order_by(GameEvent.seq.asc())
    )
    if after_seq is not None:
        stmt = stmt.where(GameEvent.seq > after_seq)
    return list((await db.execute(stmt)).scalars())


async def _accept_draw_offer(db: AsyncSession, game: Game, offer: GameActionOffer, actor: UserProfile | None) -> None:
    if game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Game is not active; current status is {game.status}")
    game.status = "draw"
    game.result = "1/2-1/2"
    game.winner_player_id = None
    _stop_clock(game)
    game.updated_at = utcnow()
    game.pgn = _pgn_from_moves(list(game.moves), game.result)
    _record_completed_game_stats(game)
    db.add(game)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        "draw_accepted",
        actor_user_id=actor.id if actor else None,
        room_id=offer.room_id,
        payload={"offerId": offer.id, "result": game.result},
    )


async def _accept_undo_offer(db: AsyncSession, game: Game, offer: GameActionOffer, actor: UserProfile | None) -> None:
    if game.status not in PLAYABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Game is not active; current status is {game.status}")
    last_move = max(game.moves, key=lambda move: move.move_number, default=None)
    if not last_move:
        raise HTTPException(status_code=400, detail="No moves are available to undo")
    game.current_fen = last_move.fen_before
    board = chess.Board(game.current_fen)
    game.status, game.result = _status_for_board(board)
    game.winner_player_id = None
    game.turn_started_at = utcnow() if _clock_can_run(game) else None
    game.updated_at = utcnow()
    remaining_moves = [move for move in game.moves if move.id != last_move.id]
    game.pgn = _pgn_from_moves(remaining_moves, game.result)
    await db.delete(last_move)
    db.add(game)
    await db.flush()
    await record_game_event(
        db,
        game.id,
        "undo_accepted",
        actor_user_id=actor.id if actor else None,
        room_id=offer.room_id,
        payload={"offerId": offer.id, "undoneMoveNumber": last_move.move_number},
    )


async def _accept_rematch_offer(db: AsyncSession, game: Game, offer: GameActionOffer, actor: UserProfile | None) -> None:
    rematch = Game(
        mode=game.mode,
        status="active",
        current_fen=chess.Board().fen(),
        pgn="",
        white_player_id=game.white_player_id,
        black_player_id=game.black_player_id,
        time_control_initial_seconds=game.time_control_initial_seconds,
        time_increment_seconds=game.time_increment_seconds or 0,
        white_time_ms=(game.time_control_initial_seconds * 1000) if game.time_control_initial_seconds else None,
        black_time_ms=(game.time_control_initial_seconds * 1000) if game.time_control_initial_seconds else None,
    )
    _start_clock_if_ready(rematch)
    db.add(rematch)
    await db.flush()
    payload = _parse_json_payload(offer.payload_json)
    payload["newGameId"] = rematch.id
    offer.payload_json = _json_payload(payload)
    if offer.room_id:
        room = await db.get(Room, offer.room_id)
        if room:
            room.game_id = rematch.id
            room.status = "active"
            room.updated_at = utcnow()
            db.add(room)
    await record_game_event(
        db,
        game.id,
        "rematch_started",
        actor_user_id=actor.id if actor else None,
        room_id=offer.room_id,
        payload={"offerId": offer.id, "newGameId": rematch.id},
    )


async def respond_to_game_offer(
    db: AsyncSession,
    game: Game,
    offer_id: int,
    payload: RespondGameOfferRequest,
    actor: UserProfile,
) -> GameActionOffer:
    offer = await get_game_offer_or_404(db, game.id, offer_id)
    _assert_game_participant(game, actor)
    if offer.status != "pending":
        raise HTTPException(status_code=400, detail=f"Offer is already {offer.status}")
    expires_at = offer.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=utcnow().tzinfo)
    if expires_at and expires_at <= utcnow():
        offer.status = "expired"
        offer.responded_at = utcnow()
        db.add(offer)
        await record_game_event(
            db,
            game.id,
            f"{offer.offer_type}_expired",
            room_id=offer.room_id,
            payload={"offerId": offer.id},
        )
        await db.commit()
        raise HTTPException(status_code=400, detail="Offer has expired")

    actor_id = actor.id
    if payload.action == "cancel":
        if actor_id != offer.requested_by_user_id:
            raise HTTPException(status_code=403, detail="Only the requester can cancel this offer")
        offer.status = "cancelled"
        event_type = f"{offer.offer_type}_cancelled"
    else:
        if actor_id == offer.requested_by_user_id:
            raise HTTPException(status_code=403, detail="The requester cannot respond to their own offer")
        if offer.target_user_id and actor_id != offer.target_user_id:
            raise HTTPException(status_code=403, detail="This offer targets a different player")
        offer.status = "accepted" if payload.action == "accept" else "declined"
        event_type = f"{offer.offer_type}_{offer.status}"

    offer.responded_at = utcnow()
    if offer.status == "accepted":
        if offer.offer_type == "draw":
            await _accept_draw_offer(db, game, offer, actor)
        elif offer.offer_type == "undo":
            await _accept_undo_offer(db, game, offer, actor)
        elif offer.offer_type == "rematch":
            await _accept_rematch_offer(db, game, offer, actor)
    else:
        await record_game_event(
            db,
            game.id,
            event_type,
            actor_user_id=actor_id,
            room_id=offer.room_id,
            payload={"offerId": offer.id},
        )

    db.add(offer)
    await db.commit()
    return await get_game_offer_or_404(db, game.id, offer.id)
