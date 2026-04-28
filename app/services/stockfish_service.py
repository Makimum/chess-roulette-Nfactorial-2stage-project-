from __future__ import annotations

import os
import random

import chess
import chess.engine

from app.core.config import get_settings


class StockfishService:
    def __init__(self) -> None:
        self.path = get_settings().stockfish_path

    @property
    def available(self) -> bool:
        return bool(self.path and os.path.exists(self.path))

    def choose_move(self, board: chess.Board) -> chess.Move | None:
        legal_moves = list(board.legal_moves)
        if not legal_moves:
            return None
        if not self.available:
            return random.choice(legal_moves)

        try:
            with chess.engine.SimpleEngine.popen_uci(self.path) as engine:
                result = engine.play(board, chess.engine.Limit(time=0.2, depth=10))
                return result.move if result.move in legal_moves else random.choice(legal_moves)
        except Exception:
            return random.choice(legal_moves)

    def evaluate(self, board: chess.Board, time_limit: float = 0.08) -> tuple[int | None, str | None]:
        if not self.available:
            return None, None
        try:
            with chess.engine.SimpleEngine.popen_uci(self.path) as engine:
                info = engine.analyse(board, chess.engine.Limit(time=time_limit, depth=8))
                score = info.get("score")
                pv = info.get("pv") or []
                cp = score.white().score(mate_score=100000) if score else None
                best_move = pv[0].uci() if pv else None
                return cp, best_move
        except Exception:
            return None, None

