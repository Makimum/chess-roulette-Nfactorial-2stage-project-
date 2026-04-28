import { useCallback, useEffect, useRef, useState } from "react";

export type BoardTheme = "classic" | "green" | "brown" | "blue";
export type PieceTheme = "default";
export type Coordinates = "off" | "inside";
export type OrientationMode = "follow" | "white" | "black";
export type PlayerColorPref = "white" | "black" | "random";
export type MoveMethod = "drag" | "click" | "both";
export type PieceAnimation = "off" | "fast" | "medium" | "slow";

export interface AIGameSettings {
  boardSize: number;
  boardTheme: BoardTheme;
  pieceTheme: PieceTheme;
  coordinates: Coordinates;
  orientationMode: OrientationMode;
  playerColor: PlayerColorPref;
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  moveMethod: MoveMethod;
  pieceAnimation: PieceAnimation;
  playSounds: boolean;
}

const STORAGE_KEY = "cma_ai_settings_v1";
const LEGACY_SIZE = "cma_board_size";
const LEGACY_COLOR = "cma_ai_color";

export const DEFAULT_AI_SETTINGS: AIGameSettings = {
  boardSize: 70,
  boardTheme: "classic",
  pieceTheme: "default",
  coordinates: "inside",
  orientationMode: "follow",
  playerColor: "white",
  showLegalMoves: true,
  highlightLastMove: true,
  moveMethod: "both",
  pieceAnimation: "medium",
  playSounds: true,
};

const BOARD_THEMES: BoardTheme[] = ["classic", "green", "brown", "blue"];
const COORDS: Coordinates[] = ["off", "inside"];
const ORIENT: OrientationMode[] = ["follow", "white", "black"];
const COLORS: PlayerColorPref[] = ["white", "black", "random"];
const METHODS: MoveMethod[] = ["drag", "click", "both"];
const ANIMS: PieceAnimation[] = ["off", "fast", "medium", "slow"];

function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function loadSettings(): AIGameSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  // Try unified storage first.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIGameSettings>;
      return {
        boardSize: clampNumber(parsed.boardSize, 0, 100, DEFAULT_AI_SETTINGS.boardSize),
        boardTheme: pickEnum(parsed.boardTheme, BOARD_THEMES, DEFAULT_AI_SETTINGS.boardTheme),
        pieceTheme: "default",
        coordinates: pickEnum(parsed.coordinates, COORDS, DEFAULT_AI_SETTINGS.coordinates),
        orientationMode: pickEnum(parsed.orientationMode, ORIENT, DEFAULT_AI_SETTINGS.orientationMode),
        playerColor: pickEnum(parsed.playerColor, COLORS, DEFAULT_AI_SETTINGS.playerColor),
        showLegalMoves: pickBool(parsed.showLegalMoves, DEFAULT_AI_SETTINGS.showLegalMoves),
        highlightLastMove: pickBool(parsed.highlightLastMove, DEFAULT_AI_SETTINGS.highlightLastMove),
        moveMethod: pickEnum(parsed.moveMethod, METHODS, DEFAULT_AI_SETTINGS.moveMethod),
        pieceAnimation: pickEnum(parsed.pieceAnimation, ANIMS, DEFAULT_AI_SETTINGS.pieceAnimation),
        playSounds: pickBool(parsed.playSounds, DEFAULT_AI_SETTINGS.playSounds),
      };
    }
  } catch {
    /* fall through to migration */
  }
  // Migrate legacy keys.
  const migrated = { ...DEFAULT_AI_SETTINGS };
  try {
    const legacySize = localStorage.getItem(LEGACY_SIZE);
    if (legacySize !== null) {
      migrated.boardSize = clampNumber(Number(legacySize), 0, 100, DEFAULT_AI_SETTINGS.boardSize);
    }
    const legacyColor = localStorage.getItem(LEGACY_COLOR);
    if (legacyColor === "white" || legacyColor === "black") {
      migrated.playerColor = legacyColor;
    }
  } catch {
    /* ignore */
  }
  return migrated;
}

function rollRandomColor(): "white" | "black" {
  return Math.random() < 0.5 ? "white" : "black";
}

function resolveColor(pref: PlayerColorPref): "white" | "black" {
  return pref === "random" ? rollRandomColor() : pref;
}

export function useAIGameSettings() {
  // SSR-safe initial state: defaults during SSR, real values after mount.
  const [settings, setSettings] = useState<AIGameSettings>(DEFAULT_AI_SETTINGS);
  const [resolvedPlayerColor, setResolvedPlayerColor] = useState<"white" | "black">("white");
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const loaded = loadSettings();
    setSettings(loaded);
    setResolvedPlayerColor(resolveColor(loaded.playerColor));
  }, []);

  const saveSettings = useCallback((next: AIGameSettings) => {
    setSettings(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    }
  }, []);

  const rerollResolvedColor = useCallback((): "white" | "black" => {
    const next = resolveColor(settings.playerColor);
    setResolvedPlayerColor(next);
    return next;
  }, [settings.playerColor]);

  return { settings, saveSettings, resolvedPlayerColor, rerollResolvedColor };
}

/** Map boardSize (0..100) → responsive max-width string for the board container. */
export function boardSizeToMaxWidth(size: number): string {
  const px = 360 + Math.round((Math.max(0, Math.min(100, size)) / 100) * 360); // 360..720
  return `min(100%, min(${px}px, calc(100dvh - 280px)))`;
}

/** Map pieceAnimation → ms duration for react-chessboard. */
export function animationToMs(a: PieceAnimation): number {
  switch (a) {
    case "off": return 0;
    case "fast": return 120;
    case "medium": return 220;
    case "slow": return 400;
  }
}

/** Map moveMethod → drag/click flags. */
export function methodToFlags(m: MoveMethod): { allowDrag: boolean; allowClick: boolean } {
  switch (m) {
    case "drag": return { allowDrag: true, allowClick: false };
    case "click": return { allowDrag: false, allowClick: true };
    case "both": return { allowDrag: true, allowClick: true };
  }
}

export const BOARD_THEME_TOKENS: Record<BoardTheme, { light: string; dark: string }> = {
  classic: { light: "oklch(0.92 0.03 75)", dark: "oklch(0.5 0.06 145)" },
  green:   { light: "oklch(0.93 0.04 130)", dark: "oklch(0.45 0.09 145)" },
  brown:   { light: "oklch(0.88 0.05 70)", dark: "oklch(0.42 0.06 50)" },
  blue:    { light: "oklch(0.92 0.03 230)", dark: "oklch(0.45 0.08 245)" },
};
