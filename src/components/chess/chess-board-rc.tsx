import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";

export interface BoardArrow {
  from: Square;
  to: Square;
  color?: string;
}

interface ChessBoardRCProps {
  fen: string;
  orientation?: "white" | "black";
  selected?: Square | null;
  legalTargets?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  onSquareClick?: (square: Square) => void;
  onPieceDrop?: (from: Square, to: Square) => boolean;
  disabled?: boolean;
  canDragColor?: "w" | "b" | null;
  /** Controlled arrows. If omitted the board manages its own internal arrows. */
  arrows?: BoardArrow[];
  onArrowsChange?: (arrows: BoardArrow[]) => void;
  /** When true, plain taps draw arrows instead of selecting pieces (mobile). */
  arrowsMode?: boolean;
  /** Called when an arrow attempt is rejected by validation. */
  onArrowRejected?: (from: Square, to: Square) => void;
  /** Optional CSS max-width for the board container (e.g. "min(100%, 560px)"). */
  maxWidth?: string;
  /** Whether to render file/rank notation. Default true. */
  showCoordinates?: boolean;
  /** Animation duration for piece moves (ms). Default 200. */
  animationDurationMs?: number;
  /** Allow drag-and-drop. Default true. */
  allowDrag?: boolean;
  /** Allow click-to-select / click-to-move. Default true. */
  allowClick?: boolean;
  /** Optional board theme override applied as inline CSS variables. */
  boardTheme?: { light: string; dark: string };
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

function squareToXY(square: Square, orientation: "white" | "black") {
  const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = parseInt(square[1], 10);
  // Coordinates in 0..8 grid units (we'll scale to %)
  const x = orientation === "white" ? file + 0.5 : 7 - file + 0.5;
  const y = orientation === "white" ? 8 - rank + 0.5 : rank - 1 + 0.5;
  return { x: (x / 8) * 100, y: (y / 8) * 100 };
}

function ArrowsOverlay({
  arrows,
  orientation,
}: {
  arrows: BoardArrow[];
  orientation: "white" | "black";
}) {
  if (!arrows.length) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full z-10"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {arrows.map((a, i) => (
          <marker
            key={i}
            id={`arrowhead-${i}`}
            markerWidth="3"
            markerHeight="3"
            refX="2.2"
            refY="1.5"
            orient="auto"
          >
            <polygon points="0 0, 3 1.5, 0 3" fill={a.color ?? "var(--primary)"} opacity="0.85" />
          </marker>
        ))}
      </defs>
      {arrows.map((a, i) => {
        const from = squareToXY(a.from, orientation);
        const to = squareToXY(a.to, orientation);
        const color = a.color ?? "var(--primary)";
        return (
          <line
            key={`${a.from}-${a.to}-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.85"
            markerEnd={`url(#arrowhead-${i})`}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 8 }}
          />
        );
      })}
    </svg>
  );
}

export function ChessBoardRC({
  fen,
  orientation = "white",
  selected,
  legalTargets = [],
  lastMove,
  onSquareClick,
  onPieceDrop,
  disabled,
  canDragColor,
  arrows: arrowsProp,
  onArrowsChange,
  arrowsMode = false,
  onArrowRejected,
  maxWidth,
  showCoordinates = true,
  animationDurationMs = 200,
  allowDrag = true,
  allowClick = true,
  boardTheme,
}: ChessBoardRCProps) {
  const [internalArrows, setInternalArrows] = useState<BoardArrow[]>([]);
  const arrows = arrowsProp ?? internalArrows;
  const setArrows = useCallback(
    (next: BoardArrow[]) => {
      if (onArrowsChange) onArrowsChange(next);
      else setInternalArrows(next);
    },
    [onArrowsChange],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Square | null>(null);
  const tapStartRef = useRef<Square | null>(null);

  const checkSquare = useMemo(() => {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          return `${"abcdefgh"[f]}${8 - r}`;
        }
      }
    }
    return null;
  }, [fen]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "color-mix(in oklab, var(--primary) 28%, transparent)" };
      styles[lastMove.to] = { background: "color-mix(in oklab, var(--primary) 38%, transparent)" };
    }
    if (selected) {
      styles[selected] = {
        background: "color-mix(in oklab, var(--primary) 50%, transparent)",
        boxShadow: "inset 0 0 0 3px var(--primary)",
      };
    }
    legalTargets.forEach((sq) => {
      const chess = new Chess(fen);
      const piece = chess.get(sq);
      styles[sq] = piece
        ? {
            ...styles[sq],
            background: "radial-gradient(circle, transparent 56%, color-mix(in oklab, var(--primary) 55%, transparent) 58%)",
          }
        : {
            ...styles[sq],
            background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 50%, transparent) 22%, transparent 24%)",
          };
    });
    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        background: "color-mix(in oklab, var(--destructive) 55%, transparent)",
        boxShadow: "inset 0 0 18px color-mix(in oklab, var(--destructive) 70%, transparent)",
      };
    }
    return styles;
  }, [fen, selected, legalTargets, lastMove, checkSquare]);

  // Map a clientX/Y inside the board to a square.
  const pointToSquare = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      const fileIdx = Math.floor((x / rect.width) * 8);
      const rankIdx = Math.floor((y / rect.height) * 8);
      if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;
      const file = orientation === "white" ? FILES[fileIdx] : FILES[7 - fileIdx];
      const rank = orientation === "white" ? 8 - rankIdx : rankIdx + 1;
      return `${file}${rank}` as Square;
    },
    [orientation],
  );

  const isArrowAllowed = useCallback(
    (from: Square, to: Square): boolean => {
      if (from === to) return false;
      const chess = new Chess(fen);
      const piece = chess.get(from);
      if (!piece) return false; // no arrows from empty squares
      // 1) Strict legal: if it's this piece's color's turn it works directly.
      const legal = chess.moves({ square: from, verbose: true });
      if (legal.some((m) => m.to === to)) return true;
      // 2) Fallback: geometric piece movement (so you can plan opponent moves).
      const ff = FILES.indexOf(from[0] as (typeof FILES)[number]);
      const fr = parseInt(from[1], 10);
      const tf = FILES.indexOf(to[0] as (typeof FILES)[number]);
      const tr = parseInt(to[1], 10);
      const dx = tf - ff;
      const dy = tr - fr;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      switch (piece.type) {
        case "n":
          return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
        case "b":
          return adx === ady && adx > 0;
        case "r":
          return (adx === 0) !== (ady === 0);
        case "q":
          return (adx === ady && adx > 0) || ((adx === 0) !== (ady === 0));
        case "k":
          return adx <= 1 && ady <= 1 && (adx + ady > 0);
        case "p": {
          const dir = piece.color === "w" ? 1 : -1;
          const startRank = piece.color === "w" ? 2 : 7;
          // forward 1
          if (dx === 0 && dy === dir) return true;
          // forward 2 from start rank
          if (dx === 0 && dy === 2 * dir && fr === startRank) return true;
          // diagonal capture (one square)
          if (adx === 1 && dy === dir) return true;
          return false;
        }
        default:
          return false;
      }
    },
    [fen],
  );

  const addArrow = useCallback(
    (from: Square, to: Square) => {
      if (from === to) {
        // tapping the same square clears arrows on it
        setArrows(arrows.filter((a) => a.from !== from || a.to !== to));
        return;
      }
      if (!isArrowAllowed(from, to)) {
        onArrowRejected?.(from, to);
        return;
      }
      // toggle: if exists remove, else add
      const exists = arrows.some((a) => a.from === from && a.to === to);
      if (exists) {
        setArrows(arrows.filter((a) => !(a.from === from && a.to === to)));
      } else {
        setArrows([...arrows, { from, to }]);
      }
    },
    [arrows, setArrows, isArrowAllowed, onArrowRejected],
  );

  // Right-click drag on desktop creates arrows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onContextMenu = (e: MouseEvent) => {
      // prevent context menu inside the board so right-drag works
      e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return; // right button only
      dragStartRef.current = pointToSquare(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (!start) return;
      const end = pointToSquare(e.clientX, e.clientY);
      if (!end) return;
      if (start === end) {
        // Right-click on a square clears all arrows
        setArrows([]);
        return;
      }
      addArrow(start, end);
    };

    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [pointToSquare, addArrow, setArrows]);

  // Clear arrows when a real move lands.
  const lastMoveKey = lastMove ? `${lastMove.from}-${lastMove.to}` : "none";
  useEffect(() => {
    if (lastMove && arrows.length) setArrows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMoveKey]);

  const handleSquareClick = (square: Square) => {
    if (arrowsMode) {
      // Two-tap arrow drawing for touch devices.
      if (!tapStartRef.current) {
        tapStartRef.current = square;
        return;
      }
      const start = tapStartRef.current;
      tapStartRef.current = null;
      addArrow(start, square);
      return;
    }
    if (!allowClick) return;
    onSquareClick?.(square);
  };

  const containerStyle: React.CSSProperties = {
    touchAction: "none",
    maxWidth: maxWidth ?? "min(100%, 640px)",
  };
  if (boardTheme) {
    (containerStyle as Record<string, string>)["--board-light"] = boardTheme.light;
    (containerStyle as Record<string, string>)["--board-dark"] = boardTheme.dark;
  }

  return (
    <div
      ref={containerRef}
      className="chess-glass-board relative w-full mx-auto rounded-3xl overflow-hidden glass-panel-strong glass-gloss p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_60px_-10px_var(--glow-emerald-soft)]"
      style={containerStyle}
    >
      <div className="relative rounded-2xl overflow-hidden">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: !disabled && !arrowsMode && allowDrag,
          animationDurationInMs: animationDurationMs,
          showNotation: showCoordinates,
          squareStyles,
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          dropSquareStyle: {
            boxShadow: "inset 0 0 0 4px color-mix(in oklab, var(--primary) 60%, transparent)",
          },
          canDragPiece: ({ piece }) => {
            if (disabled || arrowsMode || !canDragColor || !allowDrag) return false;
            return piece.pieceType?.[0] === canDragColor;
          },
          onSquareClick: ({ square }) => handleSquareClick(square as Square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onPieceDrop?.(sourceSquare as Square, targetSquare as Square) ?? false;
          },
        }}
      />
      </div>
      <ArrowsOverlay arrows={arrows} orientation={orientation} />
    </div>
  );
}
