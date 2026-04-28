import { useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { cn } from "@/lib/utils";

interface ChessBoardProps {
  fen: string;
  orientation?: "white" | "black";
  selected?: Square | null;
  legalTargets?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  onSquareClick?: (square: Square) => void;
  disabled?: boolean;
}

const PIECE_GLYPH: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function ChessBoard({
  fen,
  orientation = "white",
  selected,
  legalTargets = [],
  lastMove,
  onSquareClick,
  disabled,
}: ChessBoardProps) {
  // Single source of truth: a Chess instance derived from fen.
  // Use chess.get(square) for piece lookup so orientation only controls
  // visual ordering — never the piece-to-square mapping.
  const { chess, checkSquare } = useMemo(() => {
    const c = new Chess(fen);
    let check: Square | null = null;
    if (c.inCheck()) {
      const turn = c.turn();
      const b = c.board();
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const p = b[r][f];
          if (p && p.type === "k" && p.color === turn) {
            check = (FILES[f] + (8 - r)) as Square;
          }
        }
      }
    }
    return { chess: c, checkSquare: check };
  }, [fen]);

  // Visual ordering only.
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

  return (
    <div className="relative w-full max-w-[640px] mx-auto aspect-square rounded-xl overflow-hidden shadow-elegant ring-1 ring-border bg-card">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank, rIdx) =>
          files.map((file, fIdx) => {
            const square = `${file}${rank}` as Square;
            const isLight = (rIdx + fIdx) % 2 === 0;
            const piece = chess.get(square);
            const isSelected = selected === square;
            const isTarget = legalTargets.includes(square);
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = checkSquare === square;
            return (
              <button
                key={square}
                disabled={disabled}
                onClick={() => onSquareClick?.(square)}
                className={cn(
                  "relative flex items-center justify-center select-none transition-colors",
                  isLight ? "bg-board-light" : "bg-board-dark",
                  isSelected && "ring-2 ring-inset ring-primary",
                  isLast && "bg-board-move",
                  isCheck && "bg-board-check",
                  disabled && "cursor-default",
                )}
              >
                {fIdx === 0 && (
                  <span
                    className={cn(
                      "absolute left-1 top-0.5 text-[10px] font-medium opacity-70",
                      isLight ? "text-board-dark" : "text-board-light",
                    )}
                  >
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span
                    className={cn(
                      "absolute right-1 bottom-0.5 text-[10px] font-medium opacity-70",
                      isLight ? "text-board-dark" : "text-board-light",
                    )}
                  >
                    {file}
                  </span>
                )}
                {isTarget && !piece && (
                  <span className="absolute w-1/3 h-1/3 rounded-full bg-board-move" />
                )}
                {isTarget && piece && (
                  <span className="absolute inset-1 rounded-full ring-4 ring-board-move" />
                )}
                {piece && (
                  <span
                    className={cn(
                      "relative text-[clamp(1.8rem,6.5vw,3.4rem)] leading-none drop-shadow-sm",
                      piece.color === "w" ? "text-white" : "text-neutral-900",
                    )}
                    style={{ textShadow: piece.color === "w" ? "0 1px 2px rgba(0,0,0,.45)" : "0 1px 2px rgba(255,255,255,.25)" }}
                  >
                    {PIECE_GLYPH[`${piece.color}${piece.type.toUpperCase()}`]}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
