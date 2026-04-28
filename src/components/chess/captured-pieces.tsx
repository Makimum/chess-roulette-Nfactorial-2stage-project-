import { useMemo } from "react";
import { Chess } from "chess.js";
import { cn } from "@/lib/utils";

interface CapturedPiecesProps {
  fen: string;
  /** Whose captures to show: white = pieces white captured (i.e. black pieces) */
  side: "white" | "black";
  className?: string;
}

const STARTING: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const GLYPH: Record<string, string> = {
  wP: "♙", wN: "♘", wB: "♗", wR: "♖", wQ: "♕",
  bP: "♟", bN: "♞", bB: "♝", bR: "♜", bQ: "♛",
};
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export function CapturedPieces({ fen, side, className }: CapturedPiecesProps) {
  const { captured, materialDiff } = useMemo(() => {
    const chess = new Chess(fen);
    const board = chess.board();
    const counts: Record<"w" | "b", Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };
    for (const row of board) {
      for (const sq of row) {
        if (sq && sq.type !== "k") counts[sq.color][sq.type] = (counts[sq.color][sq.type] ?? 0) + 1;
      }
    }
    // captured by `side` = missing pieces of opponent color
    const oppColor: "w" | "b" = side === "white" ? "b" : "w";
    const ownColor: "w" | "b" = side === "white" ? "w" : "b";
    const captured: Array<{ key: string; type: string }> = [];
    let oppPoints = 0;
    let ownPoints = 0;
    (Object.keys(STARTING) as Array<keyof typeof STARTING>).forEach((t) => {
      const lost = STARTING[t] - (counts[oppColor][t] ?? 0);
      for (let i = 0; i < lost; i++) {
        captured.push({ key: `${oppColor}${t}${i}`, type: t });
      }
      oppPoints += (STARTING[t] - (counts[oppColor][t] ?? 0)) * VALUE[t];
      ownPoints += (STARTING[t] - (counts[ownColor][t] ?? 0)) * VALUE[t];
    });
    return { captured, materialDiff: oppPoints - ownPoints };
  }, [fen, side]);

  const oppColor: "w" | "b" = side === "white" ? "b" : "w";

  return (
    <div className={cn("flex items-center gap-1 min-h-6 flex-wrap", className)}>
      {captured.map((c) => (
        <span
          key={c.key}
          className={cn(
            "text-lg leading-none",
            oppColor === "w" ? "text-foreground/90" : "text-foreground/70",
          )}
          style={{ textShadow: "0 1px 1px rgba(0,0,0,.25)" }}
        >
          {GLYPH[`${oppColor}${c.type.toUpperCase()}`]}
        </span>
      ))}
      {materialDiff > 0 && (
        <span className="text-xs font-mono text-muted-foreground ml-1">+{materialDiff}</span>
      )}
    </div>
  );
}
