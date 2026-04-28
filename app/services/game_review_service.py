from __future__ import annotations

import logging
import math
from dataclasses import dataclass

import chess
import chess.engine

from app.core.config import get_settings
from app.db.models import Game, Move
from app.services.stockfish_service import StockfishService


logger = logging.getLogger(__name__)

MATE_SCORE = 100000
PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
}
CLASSIFICATIONS = ("best", "excellent", "good", "inaccuracy", "mistake", "blunder")


@dataclass(frozen=True)
class PositionEvaluation:
    centipawns: int | None
    best_move: str | None = None


def _material_evaluation(board: chess.Board) -> int:
    score = 0
    for piece in board.piece_map().values():
        value = PIECE_VALUES.get(piece.piece_type, 0)
        score += value if piece.color == chess.WHITE else -value
    if board.is_checkmate():
        return -MATE_SCORE if board.turn == chess.WHITE else MATE_SCORE
    return score


def _engine_evaluate(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    *,
    time_limit: float,
    depth: int,
) -> PositionEvaluation:
    info = engine.analyse(board, chess.engine.Limit(time=time_limit, depth=depth))
    score = info.get("score")
    pv = info.get("pv") or []
    centipawns = score.white().score(mate_score=MATE_SCORE) if score else None
    best_move = pv[0].uci() if pv else None
    return PositionEvaluation(centipawns=centipawns, best_move=best_move)


def _fallback_evaluate(board: chess.Board) -> PositionEvaluation:
    return PositionEvaluation(centipawns=_material_evaluation(board), best_move=None)


def _score_for_color(white_score: int | None, color: str) -> int | None:
    if white_score is None:
        return None
    return white_score if color == "white" else -white_score


def _bounded_loss(before_for_player: int | None, after_for_player: int | None) -> int | None:
    if before_for_player is None or after_for_player is None:
        return None
    if abs(before_for_player) >= MATE_SCORE or abs(after_for_player) >= MATE_SCORE:
        return max(0, min(MATE_SCORE, before_for_player - after_for_player))
    return max(0, before_for_player - after_for_player)


def _classification(loss: int | None, move_uci: str, best_move: str | None, *, engine_used: bool) -> str:
    if loss is None:
        return "unknown"
    if engine_used and best_move and move_uci == best_move:
        return "best"
    if loss <= 10:
        return "best" if engine_used else "good"
    if loss <= 25:
        return "excellent"
    if loss <= 60:
        return "good"
    if loss <= 120:
        return "inaccuracy"
    if loss <= 250:
        return "mistake"
    return "blunder"


def _comment(classification: str, best_move_san: str | None, *, engine_used: bool) -> str:
    if not engine_used:
        return "Stockfish is not configured; this is a material-only fallback review."
    if classification == "best":
        return "Best engine move."
    if classification == "excellent":
        return "Excellent move with a very small evaluation loss."
    if classification == "good":
        return "Good move; the position stays close to the engine recommendation."
    if classification == "inaccuracy":
        return f"Inaccuracy. Better was {best_move_san}." if best_move_san else "Inaccuracy."
    if classification == "mistake":
        return f"Mistake. Better was {best_move_san}." if best_move_san else "Mistake."
    if classification == "blunder":
        return f"Blunder. Better was {best_move_san}." if best_move_san else "Blunder."
    return "No evaluation is available for this move."


def _best_move_san(board: chess.Board, best_move: str | None) -> str | None:
    if not best_move:
        return None
    try:
        move = chess.Move.from_uci(best_move)
    except ValueError:
        return None
    if move not in board.legal_moves:
        return None
    try:
        return board.san(move)
    except Exception:
        return None


def _accuracy(average_loss: float | None) -> float | None:
    if average_loss is None:
        return None
    value = 103.1668 * math.exp(-0.04354 * average_loss) - 3.1669
    return round(max(0.0, min(100.0, value)), 1)


def _average(values: list[int]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _empty_counts() -> dict[str, int]:
    return {classification: 0 for classification in CLASSIFICATIONS}


def _sorted_moves(game: Game) -> list[Move]:
    return sorted(game.moves, key=lambda item: item.move_number)


def _evaluate_positions_with_engine(moves: list[Move], stockfish: StockfishService) -> tuple[list[dict], int | None, bool]:
    settings = get_settings()
    analysis: list[dict] = []
    final_evaluation: int | None = None
    if not stockfish.available or not stockfish.path:
        return analysis, final_evaluation, False

    try:
        with chess.engine.SimpleEngine.popen_uci(stockfish.path) as engine:
            for move in moves:
                board_before = chess.Board(move.fen_before)
                board_after = chess.Board(move.fen_after)
                before = _engine_evaluate(
                    engine,
                    board_before,
                    time_limit=settings.game_review_analysis_time_seconds,
                    depth=settings.game_review_analysis_depth,
                )
                after = _engine_evaluate(
                    engine,
                    board_after,
                    time_limit=settings.game_review_analysis_time_seconds,
                    depth=settings.game_review_analysis_depth,
                )
                final_evaluation = after.centipawns
                analysis.append({"move": move, "before": before, "after": after})
    except Exception as exc:
        logger.warning("Stockfish game review failed; using fallback review: %s", exc)
        return [], None, False

    return analysis, final_evaluation, True


def _evaluate_positions_with_fallback(moves: list[Move]) -> tuple[list[dict], int | None]:
    analysis: list[dict] = []
    final_evaluation: int | None = None
    for move in moves:
        board_before = chess.Board(move.fen_before)
        board_after = chess.Board(move.fen_after)
        before = _fallback_evaluate(board_before)
        after = _fallback_evaluate(board_after)
        final_evaluation = after.centipawns
        analysis.append({"move": move, "before": before, "after": after})
    return analysis, final_evaluation


def review_game(game: Game) -> dict:
    moves = _sorted_moves(game)
    stockfish = StockfishService()
    analysis, final_evaluation, engine_used = _evaluate_positions_with_engine(moves, stockfish)
    if not analysis:
        analysis, final_evaluation = _evaluate_positions_with_fallback(moves)

    counts = {
        "white": _empty_counts(),
        "black": _empty_counts(),
    }
    losses = {
        "white": [],
        "black": [],
    }
    reviewed_moves: list[dict] = []

    for item in analysis:
        move: Move = item["move"]
        before: PositionEvaluation = item["before"]
        after: PositionEvaluation = item["after"]
        board_before = chess.Board(move.fen_before)
        color = move.color
        before_for_player = _score_for_color(before.centipawns, color)
        after_for_player = _score_for_color(after.centipawns, color)
        loss = _bounded_loss(before_for_player, after_for_player)
        classification = _classification(loss, move.uci, before.best_move, engine_used=engine_used)
        best_move_san = _best_move_san(board_before, before.best_move)
        if classification in counts[color]:
            counts[color][classification] += 1
        if loss is not None:
            losses[color].append(min(loss, 1000))

        reviewed_moves.append(
            {
                "moveId": move.id,
                "moveNumber": move.move_number,
                "ply": move.move_number,
                "color": color,
                "san": move.san,
                "uci": move.uci,
                "fenBefore": move.fen_before,
                "fenAfter": move.fen_after,
                "evalBefore": before.centipawns,
                "evalAfter": after.centipawns,
                "evalBeforeForPlayer": before_for_player,
                "evalAfterForPlayer": after_for_player,
                "bestMove": before.best_move,
                "bestMoveSan": best_move_san,
                "centipawnLoss": loss,
                "classification": classification,
                "comment": _comment(classification, best_move_san, engine_used=engine_used),
            }
        )

    average_white = _average(losses["white"])
    average_black = _average(losses["black"])
    return {
        "gameId": game.id,
        "stockfishAvailable": stockfish.available,
        "engineUsed": engine_used,
        "analysisDepth": get_settings().game_review_analysis_depth if engine_used else None,
        "finalEvaluation": final_evaluation,
        "summary": {
            "totalMoves": len(reviewed_moves),
            "accuracyWhite": _accuracy(average_white),
            "accuracyBlack": _accuracy(average_black),
            "averageCentipawnLossWhite": average_white,
            "averageCentipawnLossBlack": average_black,
            "countsWhite": counts["white"],
            "countsBlack": counts["black"],
        },
        "moves": reviewed_moves,
    }
