import { useMemo } from "react";
import {
  BOARD_THEME_TOKENS,
  type BoardTheme,
  type Coordinates,
  type OrientationMode,
  type PlayerColorPref,
} from "@/hooks/use-ai-game-settings";

interface BoardPreviewProps {
  boardTheme: BoardTheme;
  coordinates: Coordinates;
  orientationMode: OrientationMode;
  playerColor: PlayerColorPref;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const START_POS: Record<string, string> = {
  a8: "♜", b8: "♞", c8: "♝", d8: "♛", e8: "♚", f8: "♝", g8: "♞", h8: "♜",
  a7: "♟", b7: "♟", c7: "♟", d7: "♟", e7: "♟", f7: "♟", g7: "♟", h7: "♟",
  a2: "♙", b2: "♙", c2: "♙", d2: "♙", e2: "♙", f2: "♙", g2: "♙", h2: "♙",
  a1: "♖", b1: "♘", c1: "♗", d1: "♕", e1: "♔", f1: "♗", g1: "♘", h1: "♖",
};

function resolveOrientation(
  mode: OrientationMode,
  pref: PlayerColorPref,
): "white" | "black" {
  if (mode === "white") return "white";
  if (mode === "black") return "black";
  // follow
  if (pref === "black") return "black";
  return "white"; // random/white → preview as white
}

export function BoardPreview({
  boardTheme,
  coordinates,
  orientationMode,
  playerColor,
}: BoardPreviewProps) {
  const orientation = resolveOrientation(orientationMode, playerColor);
  const theme = BOARD_THEME_TOKENS[boardTheme];
  const showCoords = coordinates === "inside";

  const squares = useMemo(() => {
    const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    const out: { sq: string; light: boolean; piece: string | undefined; file: string; rank: number; isFirstFile: boolean; isLastRank: boolean }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = files[f];
        const rank = ranks[r];
        const sq = `${file}${rank}`;
        const light = (f + r) % 2 === 0;
        out.push({
          sq,
          light,
          piece: START_POS[sq],
          file,
          rank,
          isFirstFile: f === 0,
          isLastRank: r === 7,
        });
      }
    }
    return out;
  }, [orientation]);

  return (
    <div
      className="mx-auto aspect-square w-full max-w-[280px] rounded-lg overflow-hidden ring-1 ring-border shadow-sm grid grid-cols-8 select-none"
      style={
        {
          // local CSS vars override
          ["--preview-light" as string]: theme.light,
          ["--preview-dark" as string]: theme.dark,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {squares.map((s) => (
        <div
          key={s.sq}
          className="relative flex items-center justify-center"
          style={{ background: s.light ? "var(--preview-light)" : "var(--preview-dark)" }}
        >
          {s.piece && (
            <span
              className="text-[clamp(14px,3.2vw,28px)] leading-none"
              style={{
                color: /[♔-♙]/.test(s.piece) ? "#ffffff" : "#1a1a1a",
                textShadow:
                  /[♔-♙]/.test(s.piece)
                    ? "0 1px 1px rgba(0,0,0,0.55)"
                    : "0 1px 1px rgba(255,255,255,0.25)",
              }}
            >
              {s.piece}
            </span>
          )}
          {showCoords && s.isFirstFile && (
            <span
              className="absolute top-0.5 left-0.5 text-[8px] font-semibold"
              style={{ color: s.light ? "var(--preview-dark)" : "var(--preview-light)" }}
            >
              {s.rank}
            </span>
          )}
          {showCoords && s.isLastRank && (
            <span
              className="absolute bottom-0.5 right-0.5 text-[8px] font-semibold"
              style={{ color: s.light ? "var(--preview-dark)" : "var(--preview-light)" }}
            >
              {s.file}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
