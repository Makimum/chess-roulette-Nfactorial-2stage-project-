// API service layer — connects the Lovable frontend to the FastAPI backend.
//
// Contract: docs/lovable-backend-integration.md (current revision: guest-less,
// bearer-only authentication, numeric ids for game/move/offer/event).
// Base URL: import.meta.env.VITE_API_BASE_URL
//
// Backend is the source of truth for chess legality. The frontend may use
// chess.js for optimistic UX only (legal target hints, drag preview), never
// for authoritative rules.

// ---- Public types ---------------------------------------------------------

export type Color = "white" | "black";
export type GameMode = "ai" | "friend" | "ranked" | "local";
export type GameStatus =
  | "active"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned"
  | "abandoned"
  | "timeout";

export interface TimeControl {
  initialSeconds: number;
  incrementSeconds: number;
}

export interface GameClock {
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  turnStartedAt: string | null;
  serverNow: string;
  isRunning: boolean;
}

export interface PlayerRef {
  id: string; // UUID for human players, "ai_white" / "ai_black" for AI
  name: string;
  username: string;
  rating: number;
  avatarUrl?: string;
  isAi?: boolean;
  city?: string | null;
  countryCode?: string | null;
  wins?: number;
  losses?: number;
  draws?: number;
}

export type GameId = number;
export type MoveId = number;
export type OfferId = number;
export type EventId = number;
export type RoomCode = string;

export interface Game {
  id: GameId;
  mode: GameMode;
  status: GameStatus;
  fen: string;
  pgn: string;
  white: PlayerRef;
  black: PlayerRef;
  result?: "1-0" | "0-1" | "1/2-1/2";
  createdAt: string;
  endedAt?: string;
  ratingChange?: number;
  aiLevel?: number;
  winnerPlayerId?: string | null;
  /** Inline move history when backend embeds it (e.g. /games/:id, /move). */
  moveHistory?: Move[];
  /** Time control configured for this game (absent = no clock). */
  timeControl?: TimeControl | null;
  /** Latest server clock snapshot. */
  clocks?: GameClock | null;
  /** Set by backend when POST /api/games returned an existing active match. */
  activeMatchRedirect?: boolean;
  /** Side whose turn it is per backend ("white" | "black"). */
  sideToMove?: Color;
}

export interface Move {
  id?: MoveId;
  ply: number;
  moveNumber?: number;
  color?: string;
  san: string;
  uci: string;
  fenBefore?: string;
  fenAfter: string;
  evalCp?: number;
  classification?: "best" | "great" | "good" | "inaccuracy" | "mistake" | "blunder";
  timeMs?: number;
  createdAt?: string;
}

export type MoveClassification =
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "unknown";

export interface GameReviewMove {
  moveId: number;
  moveNumber: number;
  ply: number;
  color: "white" | "black";
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number | null;
  evalAfter: number | null;
  evalBeforeForPlayer: number | null;
  evalAfterForPlayer: number | null;
  bestMove: string | null;
  bestMoveSan: string | null;
  centipawnLoss: number | null;
  classification: MoveClassification;
  comment: string;
}

export type ClassificationCounts = Record<
  Exclude<MoveClassification, "unknown">,
  number
>;

export interface GameReviewSummary {
  totalMoves: number;
  accuracyWhite: number | null;
  accuracyBlack: number | null;
  averageCentipawnLossWhite: number | null;
  averageCentipawnLossBlack: number | null;
  countsWhite: ClassificationCounts;
  countsBlack: ClassificationCounts;
}

export interface GameReview {
  gameId: GameId;
  stockfishAvailable: boolean;
  engineUsed: boolean;
  analysisDepth: number | null;
  finalEvaluation: number | null;
  summary: GameReviewSummary;
  moves: GameReviewMove[];
}

export type PlayerSide = "white" | "black" | "spectator";

export interface FriendRoom {
  code: RoomCode;
  gameId?: GameId;
  createdAt: string;
  status: "waiting" | "active" | "finished" | "cancelled";
  whiteUserId: string | null;
  blackUserId: string | null;
  currentUserId: string | null;
  playerSide: PlayerSide;
  whitePlayer: PlayerRef | null;
  blackPlayer: PlayerRef | null;
  invitePath?: string;
  inviteExpiresAt?: string | null;
  timeControl?: TimeControl | null;
  clocks?: GameClock | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  rating: number;
  city: string;
  countryCode: string | null;
  wins: number;
  losses?: number;
  draws?: number;
  avatarUrl?: string;
  isDemo?: boolean;
}

// ---- Config & local storage helpers --------------------------------------

import { getAuthToken, refreshAccessToken, clearAuthSession } from "./auth";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

const LAST_GAME_KEY = "cma_last_game_id";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getLastGameId(): GameId | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(LAST_GAME_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastGameId(gameId: GameId): void {
  if (!isBrowser()) return;
  localStorage.setItem(LAST_GAME_KEY, String(gameId));
}

// ---- HTTP helpers ---------------------------------------------------------

export type ApiErrorBucket =
  | "auth_required"
  | "validation"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "temporarily_unavailable"
  | "server_error"
  | "network"
  | "bad_request"
  | "unknown";

export class ApiError extends Error {
  status: number;
  bucket: ApiErrorBucket;
  /** Per-field validation errors derived from a FastAPI 422 detail array. */
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.name = "ApiError";
    this.bucket = bucketForStatus(status);
    this.fieldErrors = fieldErrors;
  }
}

function bucketForStatus(status: number): ApiErrorBucket {
  if (status === 0) return "network";
  if (status === 401) return "auth_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status === 400) return "bad_request";
  if (status === 503) return "temporarily_unavailable";
  if (status >= 500) return "server_error";
  return "unknown";
}

/** Normalize FastAPI / generic error payloads into a plain message. */
export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unexpected error";
}

export function getApiErrorBucket(err: unknown): ApiErrorBucket {
  if (err instanceof ApiError) return err.bucket;
  return "unknown";
}

type ValidationIssue = {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
};

function parseDetail(
  body: unknown,
  fallback: string,
): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return { message: d, fieldErrors };
    if (Array.isArray(d)) {
      const msgs: string[] = [];
      for (const it of d as ValidationIssue[]) {
        const msg = it?.msg ?? "Validation error";
        msgs.push(msg);
        const loc = it?.loc;
        if (Array.isArray(loc) && loc.length) {
          const key = String(loc[loc.length - 1]);
          if (key && !fieldErrors[key]) fieldErrors[key] = msg;
        }
      }
      return { message: msgs.join("; "), fieldErrors };
    }
    if (d != null) return { message: String(d), fieldErrors };
  }
  if (typeof body === "string" && body) return { message: body, fieldErrors };
  return { message: fallback, fieldErrors };
}

interface ApiFetchOptions extends RequestInit {
  /** Whether to attach a Bearer token when available. Default: true. */
  auth?: boolean;
  /** Internal: prevent recursive refresh loops. */
  retryOnUnauthorized?: boolean;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not set. Configure the backend URL.", 0);
  }
  const { auth = true, retryOnUnauthorized = true, headers, ...init } = options;

  const doFetch = async (token: string | null): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      Accept: "application/json",
      ...((headers as Record<string, string>) ?? {}),
    };
    if (init.body && !finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }
    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;
    return fetch(`${BASE_URL}${path}`, { ...init, headers: finalHeaders });
  };

  let res: Response;
  try {
    res = await doFetch(getAuthToken());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new ApiError(`Cannot reach backend: ${msg}`, 0);
  }

  if (res.status === 401 && auth && retryOnUnauthorized) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      try {
        res = await doFetch(newToken);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        throw new ApiError(`Cannot reach backend: ${msg}`, 0);
      }
    } else {
      clearAuthSession();
    }
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const { message, fieldErrors } = parseDetail(body, `Request failed (${res.status})`);
    throw new ApiError(message, res.status, fieldErrors);
  }
  if (res.status === 204) return undefined as T;
  return body as T;
}

// ---- Normalizers ----------------------------------------------------------

interface BackendPlayer {
  id?: string;
  name?: string;
  username?: string;
  city?: string | null;
  countryCode?: string | null;
  rating?: number;
  isAi?: boolean;
  avatarUrl?: string;
  photoUrl?: string | null;
  wins?: number;
  losses?: number;
  draws?: number;
}

interface BackendMove {
  id?: number;
  moveNumber?: number;
  ply?: number;
  color?: string;
  uci?: string;
  san?: string;
  fenBefore?: string;
  fenAfter?: string;
  classification?: Move["classification"] | null;
  evalBeforeCp?: number | null;
  evalAfterCp?: number | null;
  evalCp?: number | null;
  createdAt?: string;
}

interface BackendGame {
  gameId?: number;
  id?: number;
  mode?: string;
  status?: string;
  result?: string | null;
  currentFen?: string;
  fen?: string;
  pgn?: string;
  sideToMove?: string;
  moveHistory?: BackendMove[];
  whitePlayer?: BackendPlayer;
  blackPlayer?: BackendPlayer;
  white?: BackendPlayer;
  black?: BackendPlayer;
  winnerPlayerId?: string | null;
  isTerminal?: boolean;
  createdAt?: string;
  updatedAt?: string;
  endedAt?: string;
  ratingChange?: number;
  aiLevel?: number;
  timeControl?: TimeControl | null;
  clocks?: GameClock | null;
  activeMatchRedirect?: boolean;
}

function normalizePlayer(p: BackendPlayer | undefined, fallbackName: string): PlayerRef {
  return {
    id: p?.id ?? fallbackName,
    name: p?.name ?? p?.username ?? fallbackName,
    username: p?.username ?? p?.name ?? fallbackName,
    rating: p?.rating ?? 1200,
    isAi: !!p?.isAi,
    city: p?.city ?? null,
    countryCode: p?.countryCode ?? null,
    wins: p?.wins,
    losses: p?.losses,
    draws: p?.draws,
    avatarUrl: p?.avatarUrl ?? p?.photoUrl ?? undefined,
  };
}

function normalizeClocks(c: GameClock | null | undefined): GameClock | null {
  if (!c) return null;
  return {
    whiteTimeMs: c.whiteTimeMs ?? null,
    blackTimeMs: c.blackTimeMs ?? null,
    turnStartedAt: c.turnStartedAt ?? null,
    serverNow: c.serverNow ?? new Date().toISOString(),
    isRunning: !!c.isRunning,
  };
}

export function normalizeGame(raw: BackendGame): Game {
  const id = (raw.gameId ?? raw.id ?? 0) as GameId;
  const fen = raw.currentFen ?? raw.fen ?? "";
  const white = (raw.whitePlayer && Object.keys(raw.whitePlayer).length ? raw.whitePlayer : raw.white) ?? undefined;
  const black = (raw.blackPlayer && Object.keys(raw.blackPlayer).length ? raw.blackPlayer : raw.black) ?? undefined;
  const status = (raw.status ?? "active") as GameStatus;
  const result = (raw.result ?? undefined) as Game["result"];
  const sideToMove = raw.sideToMove === "black" ? "black" : raw.sideToMove === "white" ? "white" : undefined;
  return {
    id,
    mode: (raw.mode ?? "ai") as GameMode,
    status,
    fen,
    pgn: raw.pgn ?? "",
    white: normalizePlayer(white, "White"),
    black: normalizePlayer(black, "Black"),
    result,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    endedAt: raw.endedAt,
    ratingChange: raw.ratingChange,
    aiLevel: raw.aiLevel,
    winnerPlayerId: raw.winnerPlayerId ?? null,
    moveHistory: Array.isArray(raw.moveHistory)
      ? raw.moveHistory.map(normalizeMove)
      : undefined,
    timeControl: raw.timeControl ?? null,
    clocks: normalizeClocks(raw.clocks),
    activeMatchRedirect: !!raw.activeMatchRedirect,
    sideToMove,
  };
}

/** Extract move list from a Game, preferring embedded history. */
export function extractMoves(game: Game | null | undefined): Move[] {
  return game?.moveHistory ?? [];
}

function normalizeMove(raw: BackendMove): Move {
  const ply = raw.ply ?? raw.moveNumber ?? 0;
  const evalCp = raw.evalCp ?? raw.evalAfterCp ?? raw.evalBeforeCp ?? undefined;
  return {
    id: raw.id,
    ply,
    moveNumber: raw.moveNumber,
    color: raw.color,
    san: raw.san ?? "",
    uci: raw.uci ?? "",
    fenBefore: raw.fenBefore,
    fenAfter: raw.fenAfter ?? "",
    classification: raw.classification ?? undefined,
    evalCp: evalCp == null ? undefined : Number(evalCp),
    createdAt: raw.createdAt,
  };
}

// ---- Current player identity ---------------------------------------------

/**
 * Returns the current authenticated user's UUID, if any. With the new
 * guest-less backend this is the only valid identifier for "you" in any
 * game/room/offer record.
 */
export function getCurrentUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("cma_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string };
    return u?.id ?? null;
  } catch {
    return null;
  }
}

export function isCurrentPlayer(player: PlayerRef): boolean {
  if (player.isAi) return false;
  const me = getCurrentUserId();
  return !!me && !!player.id && player.id === me;
}

// ---- Game endpoints -------------------------------------------------------

export async function createGame(opts: {
  mode: GameMode;
  color?: Color;
  aiLevel?: number;
  timeControl?: TimeControl | null;
}): Promise<Game> {
  const mode = opts.mode === "ranked" ? "ai" : opts.mode;
  const body: Record<string, unknown> = {
    mode,
    side: opts.color ?? "white",
  };
  if (opts.timeControl) body.timeControl = opts.timeControl;
  const raw = await apiFetch<BackendGame>("/api/games", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const game = normalizeGame(raw);
  if (opts.aiLevel != null) game.aiLevel = opts.aiLevel;
  setLastGameId(game.id);
  return game;
}

/** Returns current user's active match if any. */
export interface ActiveMatchResponse {
  hasActiveMatch: boolean;
  gameId: GameId | null;
  roomCode: RoomCode | null;
  game: Game | null;
}

export async function getActiveMatch(): Promise<ActiveMatchResponse> {
  if (!getAuthToken()) {
    return { hasActiveMatch: false, gameId: null, roomCode: null, game: null };
  }
  try {
    const raw = await apiFetch<{
      hasActiveMatch?: boolean;
      gameId?: GameId | null;
      roomCode?: RoomCode | null;
      game?: BackendGame | null;
    }>("/api/games/active");
    return {
      hasActiveMatch: !!raw.hasActiveMatch,
      gameId: raw.gameId ?? null,
      roomCode: raw.roomCode ?? null,
      game: raw.game ? normalizeGame(raw.game) : null,
    };
  } catch {
    return { hasActiveMatch: false, gameId: null, roomCode: null, game: null };
  }
}

export async function getGame(gameId: GameId): Promise<Game | null> {
  try {
    const raw = await apiFetch<BackendGame>(`/api/games/${gameId}`);
    return normalizeGame(raw);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function makeMove(
  gameId: GameId,
  move: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" },
): Promise<{ game: Game; move: Move } | { error: string }> {
  try {
    const raw = await apiFetch<{ game: BackendGame; move: BackendMove }>(`/api/games/${gameId}/move`, {
      method: "POST",
      body: JSON.stringify({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? null,
      }),
    });
    return { game: normalizeGame(raw.game), move: normalizeMove(raw.move) };
  } catch (e) {
    return { error: getApiErrorMessage(e) };
  }
}

export async function getGameMoves(gameId: GameId): Promise<Move[]> {
  try {
    const raw = await apiFetch<BackendMove[] | { moves: BackendMove[] }>(`/api/games/${gameId}/moves`);
    const list = Array.isArray(raw) ? raw : (raw.moves ?? []);
    return list.map(normalizeMove);
  } catch {
    return [];
  }
}

export interface GamePosition {
  ply: number;
  fen: string;
  san?: string;
  uci?: string;
  evalCp?: number;
}

export async function getGamePositions(gameId: GameId): Promise<GamePosition[]> {
  try {
    const raw = await apiFetch<GamePosition[] | { positions: GamePosition[] | string[]; gameId?: number }>(
      `/api/games/${gameId}/positions`,
    );
    if (Array.isArray(raw)) {
      return raw.map((p) => ({
        ply: Number(p.ply ?? 0),
        fen: String(p.fen ?? ""),
        san: p.san,
        uci: p.uci,
        evalCp: typeof p.evalCp === "number" ? p.evalCp : undefined,
      }));
    }
    const list = raw.positions ?? [];
    // Backend may return an array of FEN strings.
    if (list.length && typeof list[0] === "string") {
      return (list as string[]).map((fen, i) => ({ ply: i, fen }));
    }
    return (list as GamePosition[]).map((p) => ({
      ply: Number(p.ply ?? 0),
      fen: String(p.fen ?? ""),
      san: p.san,
      uci: p.uci,
      evalCp: typeof p.evalCp === "number" ? p.evalCp : undefined,
    }));
  } catch {
    return [];
  }
}

export async function requestAiMove(gameId: GameId): Promise<{ game: Game; move: Move } | { error: string }> {
  try {
    const raw = await apiFetch<{ game: BackendGame; move: BackendMove }>(`/api/games/${gameId}/ai-move`, {
      method: "POST",
    });
    return { game: normalizeGame(raw.game), move: normalizeMove(raw.move) };
  } catch (e) {
    return { error: getApiErrorMessage(e) };
  }
}

export async function resignGame(gameId: GameId, reason?: string): Promise<Game | { error: string }> {
  try {
    const raw = await apiFetch<BackendGame>(`/api/games/${gameId}/resign`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
    return normalizeGame(raw);
  } catch (e) {
    return { error: getApiErrorMessage(e) };
  }
}

// ---- Game review ----------------------------------------------------------

const EMPTY_COUNTS: ClassificationCounts = {
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
};

function normalizeReview(raw: Partial<GameReview>, gameId: GameId): GameReview {
  const summary = raw.summary ?? ({} as Partial<GameReviewSummary>);
  return {
    gameId: (raw.gameId ?? gameId) as GameId,
    stockfishAvailable: !!raw.stockfishAvailable,
    engineUsed: !!raw.engineUsed,
    analysisDepth: raw.analysisDepth ?? null,
    finalEvaluation: raw.finalEvaluation ?? null,
    summary: {
      totalMoves: summary.totalMoves ?? 0,
      accuracyWhite: summary.accuracyWhite ?? null,
      accuracyBlack: summary.accuracyBlack ?? null,
      averageCentipawnLossWhite: summary.averageCentipawnLossWhite ?? null,
      averageCentipawnLossBlack: summary.averageCentipawnLossBlack ?? null,
      countsWhite: { ...EMPTY_COUNTS, ...(summary.countsWhite ?? {}) },
      countsBlack: { ...EMPTY_COUNTS, ...(summary.countsBlack ?? {}) },
    },
    moves: (raw.moves ?? []).map((m) => ({
      moveId: m.moveId,
      moveNumber: m.moveNumber,
      ply: m.ply,
      color: m.color,
      san: m.san,
      uci: m.uci,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      evalBefore: m.evalBefore ?? null,
      evalAfter: m.evalAfter ?? null,
      evalBeforeForPlayer: m.evalBeforeForPlayer ?? null,
      evalAfterForPlayer: m.evalAfterForPlayer ?? null,
      bestMove: m.bestMove ?? null,
      bestMoveSan: m.bestMoveSan ?? null,
      centipawnLoss: m.centipawnLoss ?? null,
      classification: (m.classification ?? "unknown") as MoveClassification,
      comment: m.comment ?? "",
    })),
  };
}

export async function getGameReview(gameId: GameId): Promise<GameReview> {
  const raw = await apiFetch<Partial<GameReview>>(`/api/games/${gameId}/review`);
  return normalizeReview(raw, gameId);
}

export async function requestGameReview(gameId: GameId): Promise<GameReview> {
  const raw = await apiFetch<Partial<GameReview>>(`/api/games/${gameId}/review`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return normalizeReview(raw, gameId);
}

// ---- Friend rooms ---------------------------------------------------------

interface BackendRoomParticipant {
  userId?: string;
  username?: string;
  role?: string;
  seatPreference?: string;
  resolvedSide?: Color | null;
  joinedAt?: string;
  lastSeenAt?: string;
}

interface BackendRoom {
  roomCode?: string;
  code?: string;
  gameId?: number;
  whiteUserId?: string | null;
  blackUserId?: string | null;
  currentUserId?: string | null;
  playerSide?: PlayerSide;
  whitePlayer?: BackendPlayer | null;
  blackPlayer?: BackendPlayer | null;
  participants?: BackendRoomParticipant[];
  status?: string;
  invitePath?: string;
  inviteExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  timeControl?: TimeControl | null;
  clocks?: GameClock | null;
}

function normalizeRoom(raw: BackendRoom): FriendRoom {
  const me = getCurrentUserId();
  const whiteUserId = raw.whiteUserId ?? null;
  const blackUserId = raw.blackUserId ?? null;
  let playerSide: PlayerSide = raw.playerSide ?? "spectator";
  if (!raw.playerSide && me) {
    if (whiteUserId === me) playerSide = "white";
    else if (blackUserId === me) playerSide = "black";
  }
  return {
    code: (raw.roomCode ?? raw.code ?? "").toUpperCase(),
    gameId: raw.gameId,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    status: (raw.status as FriendRoom["status"]) ?? "waiting",
    whiteUserId,
    blackUserId,
    currentUserId: raw.currentUserId ?? me,
    playerSide,
    whitePlayer: raw.whitePlayer ? normalizePlayer(raw.whitePlayer, "White") : null,
    blackPlayer: raw.blackPlayer ? normalizePlayer(raw.blackPlayer, "Black") : null,
    invitePath: raw.invitePath,
    inviteExpiresAt: raw.inviteExpiresAt ?? null,
    timeControl: raw.timeControl ?? null,
    clocks: normalizeClocks(raw.clocks),
  };
}

export type SidePreference = "white" | "black" | "random";

export interface ActiveMatchConflict {
  error: string;
  bucket: ApiErrorBucket;
  activeMatch: { activeGameId: GameId | null; roomCode: RoomCode | null };
}

function parseActiveMatchConflict(err: unknown): ActiveMatchConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  // Backend may surface { message, activeGameId, roomCode } either as `detail` object
  // or stringified inside the message. Try JSON-in-message first.
  const tryParse = (s: string): { activeGameId?: number; roomCode?: string } | null => {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object" && ("activeGameId" in o || "roomCode" in o)) return o;
    } catch { /* noop */ }
    return null;
  };
  const parsed = tryParse(err.message);
  if (!parsed) return null;
  return {
    error: "Active match already exists",
    bucket: err.bucket,
    activeMatch: {
      activeGameId: (parsed.activeGameId ?? null) as GameId | null,
      roomCode: parsed.roomCode ?? null,
    },
  };
}

export async function createFriendRoom(opts?: {
  sidePreference?: SidePreference;
  timeControl?: TimeControl | null;
}): Promise<FriendRoom | ActiveMatchConflict> {
  const body: Record<string, unknown> = {
    sidePreference: opts?.sidePreference ?? "white",
  };
  if (opts?.timeControl) body.timeControl = opts.timeControl;
  try {
    const raw = await apiFetch<BackendRoom>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const room = normalizeRoom(raw);
    if (room.gameId) setLastGameId(room.gameId);
    return room;
  } catch (e) {
    const conflict = parseActiveMatchConflict(e);
    if (conflict) return conflict;
    throw e;
  }
}

export async function getFriendRoom(code: string): Promise<FriendRoom | { error: string; bucket: ApiErrorBucket }> {
  try {
    const raw = await apiFetch<BackendRoom>(`/api/rooms/${code.toUpperCase()}`);
    return normalizeRoom(raw);
  } catch (e) {
    return { error: getApiErrorMessage(e), bucket: getApiErrorBucket(e) };
  }
}

export async function joinFriendRoom(
  code: string,
  opts?: { sidePreference?: SidePreference },
): Promise<FriendRoom | { error: string; bucket: ApiErrorBucket } | ActiveMatchConflict> {
  try {
    const raw = await apiFetch<BackendRoom>(`/api/rooms/${code.toUpperCase()}/join`, {
      method: "POST",
      body: JSON.stringify({
        sidePreference: opts?.sidePreference ?? "random",
      }),
    });
    const room = normalizeRoom(raw);
    if (room.gameId) setLastGameId(room.gameId);
    return room;
  } catch (e) {
    const conflict = parseActiveMatchConflict(e);
    if (conflict) return conflict;
    return { error: getApiErrorMessage(e), bucket: getApiErrorBucket(e) };
  }
}

export async function cancelFriendRoom(
  code: string,
  reason?: string,
): Promise<{ ok: true } | { error: string; bucket: ApiErrorBucket }> {
  try {
    await apiFetch<unknown>(`/api/rooms/${code.toUpperCase()}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
    return { ok: true };
  } catch (e) {
    return { error: getApiErrorMessage(e), bucket: getApiErrorBucket(e) };
  }
}

// ---- Leaderboard & history -----------------------------------------------

interface BackendLeaderboardEntry {
  rank?: number;
  userId?: string;
  id?: string;
  name?: string;
  username?: string;
  rating?: number;
  city?: string | null;
  countryCode?: string | null;
  wins?: number;
  losses?: number;
  draws?: number;
  avatarUrl?: string;
  photoUrl?: string | null;
  isDemo?: boolean;
}

export async function getLeaderboard(opts?: { countryCode?: string; city?: string }): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams();
  if (opts?.countryCode) params.set("countryCode", opts.countryCode);
  else if (opts?.city && opts.city !== "Global") params.set("city", opts.city);
  const qs = params.toString() ? `?${params.toString()}` : "";
  try {
    const raw = await apiFetch<BackendLeaderboardEntry[] | { entries: BackendLeaderboardEntry[] }>(
      `/api/leaderboard${qs}`,
      { auth: false },
    );
    const list = Array.isArray(raw) ? raw : (raw.entries ?? []);
    return list.map((e, i) => ({
      rank: e.rank ?? i + 1,
      userId: e.userId ?? e.id ?? `u_${i}`,
      name: e.name ?? e.username ?? "Player",
      username: e.username ?? e.name ?? "Player",
      rating: e.rating ?? 1200,
      city: e.city ?? opts?.city ?? "",
      countryCode: e.countryCode ?? null,
      wins: e.wins ?? 0,
      losses: e.losses,
      draws: e.draws,
      avatarUrl: e.avatarUrl ?? e.photoUrl ?? undefined,
      isDemo: e.isDemo,
    }));
  } catch {
    return [];
  }
}

/**
 * History of the currently-authenticated user. With the new backend there is
 * no public per-user history endpoint — only `/api/users/me/games`.
 */
export async function getUserGames(): Promise<Game[]> {
  if (!getAuthToken()) return [];
  try {
    const raw = await apiFetch<BackendGame[] | { games: BackendGame[] }>(`/api/users/me/games`);
    const list = Array.isArray(raw) ? raw : (raw.games ?? []);
    return list.map(normalizeGame);
  } catch {
    return [];
  }
}

// ---- Public user profile --------------------------------------------------

export interface PublicProfileUser {
  id: string;
  username: string;
  photoUrl: string | null;
  countryCode: string | null;
  rating: number;
  createdAt: string;
  registeredAt: string | null;
}

export interface PublicProfileModeStats {
  games: number;
  completed: number;
  active: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PublicProfileStats {
  leaderboardRank: number | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  completedGames: number;
  activeGames: number;
  winRate: number;
  lossRate: number;
  drawRate: number;
  gamesAsWhite: number;
  gamesAsBlack: number;
  gamesAsBoth: number;
  gamesByMode: { ai: number; friend: number; local: number };
  resultsByMode: {
    ai: PublicProfileModeStats;
    friend: PublicProfileModeStats;
    local: PublicProfileModeStats;
  };
  currentStreak: { type: "win" | "loss" | "draw" | "none"; count: number } | null;
  lastGameAt: string | null;
}

export interface PublicProfileRecentGame {
  gameId: GameId;
  mode: GameMode;
  status: GameStatus;
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  resultForUser: string;
  playedAs: Color;
  opponent: {
    id: string | null;
    username: string;
    photoUrl: string | null;
    rating: number | null;
    isAi: boolean;
  };
  createdAt: string;
  updatedAt: string | null;
}

export interface PublicProfile {
  user: PublicProfileUser;
  stats: PublicProfileStats;
  recentGames: PublicProfileRecentGame[];
}

export async function getPublicProfile(
  userId: string,
  recentLimit = 10,
): Promise<PublicProfile | null> {
  const path = `/api/users/${encodeURIComponent(userId)}/profile?recentLimit=${recentLimit}`;
  try {
    return await apiFetch<PublicProfile>(path, { auth: false });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to fetch ${path}: ${msg}`);
  }
}

export async function getPublicProfileByUsername(
  username: string,
  recentLimit = 10,
): Promise<PublicProfile | null> {
  try {
    return await apiFetch<PublicProfile>(
      `/api/users/by-username/${encodeURIComponent(username)}/profile?recentLimit=${recentLimit}`,
      { auth: false },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// ---- Status helpers -------------------------------------------------------

export function isPlayable(status: GameStatus | undefined | null): boolean {
  return status === "active" || status === "check";
}

// ---- Offers ---------------------------------------------------------------

export type OfferType = "draw" | "undo" | "rematch";
export type OfferStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";
export type OfferAction = "accept" | "decline" | "cancel";

export interface GameOffer {
  id: OfferId;
  gameId: GameId;
  roomId?: number | null;
  offerType: OfferType;
  status: OfferStatus;
  requestedByUserId: string | null;
  targetUserId?: string | null;
  payload?: Record<string, unknown>;
  expiresAt?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

export async function createGameOffer(
  gameId: GameId,
  offerType: OfferType,
  opts?: { targetUserId?: string | null; payload?: Record<string, unknown> },
): Promise<GameOffer | { error: string }> {
  try {
    return await apiFetch<GameOffer>(`/api/games/${gameId}/offers`, {
      method: "POST",
      body: JSON.stringify({
        offerType,
        targetUserId: opts?.targetUserId ?? null,
        payload: opts?.payload ?? {},
      }),
    });
  } catch (e) {
    return { error: getApiErrorMessage(e) };
  }
}

export async function getGameOffers(gameId: GameId): Promise<GameOffer[]> {
  try {
    const raw = await apiFetch<GameOffer[] | { offers: GameOffer[] }>(`/api/games/${gameId}/offers`);
    return Array.isArray(raw) ? raw : (raw.offers ?? []);
  } catch {
    return [];
  }
}

export async function respondToGameOffer(
  gameId: GameId,
  offerId: OfferId,
  action: OfferAction,
): Promise<GameOffer | { error: string }> {
  try {
    return await apiFetch<GameOffer>(`/api/games/${gameId}/offers/${offerId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  } catch (e) {
    return { error: getApiErrorMessage(e) };
  }
}

// ---- Game events feed -----------------------------------------------------

export interface GameEvent {
  id: EventId;
  gameId: GameId;
  roomId?: number | null;
  seq: number;
  eventType: string;
  actorUserId: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export async function getGameEvents(gameId: GameId, afterSeq?: number): Promise<GameEvent[]> {
  const qs = afterSeq != null ? `?afterSeq=${afterSeq}` : "";
  try {
    const raw = await apiFetch<GameEvent[] | { events: GameEvent[] }>(`/api/games/${gameId}/events${qs}`);
    return Array.isArray(raw) ? raw : (raw.events ?? []);
  } catch {
    return [];
  }
}

// ---- Agora audio/video ----------------------------------------------------

export interface AgoraConfig {
  appId: string;
  tokenExpireSeconds: number;
}

export interface AgoraRtcToken {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  role: "publisher" | "subscriber";
  tokenType: "rtc";
  expireSeconds: number;
  expiresAt: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export async function getAgoraConfig(): Promise<AgoraConfig | { error: string; bucket: ApiErrorBucket }> {
  try {
    return await apiFetch<AgoraConfig>("/api/agora/config", { auth: false });
  } catch (e) {
    return { error: getApiErrorMessage(e), bucket: getApiErrorBucket(e) };
  }
}

/**
 * Stable per-tab identifier for Agora sessions. Lives in sessionStorage so two
 * tabs of the same user get distinct ids (avoids UID_CONFLICT and self-echo
 * caused by the backend reusing the same UID).
 */
function getOrCreateClientInstanceId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "agora.clientInstanceId";
  try {
    let v = sessionStorage.getItem(KEY);
    if (!v) {
      v =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getAgoraClientInstanceId(): string {
  return getOrCreateClientInstanceId();
}

export async function getAgoraRtcToken(opts: {
  roomCode?: string;
  gameId?: GameId;
  channelName?: string;
  role?: "publisher" | "subscriber";
}): Promise<AgoraRtcToken | { error: string; bucket: ApiErrorBucket }> {
  try {
    const body: Record<string, unknown> = {
      role: opts.role ?? "publisher",
      clientInstanceId: getOrCreateClientInstanceId(),
    };
    if (opts.roomCode) body.roomCode = opts.roomCode;
    if (opts.gameId != null) body.gameId = opts.gameId;
    if (opts.channelName) body.channelName = opts.channelName;
    return await apiFetch<AgoraRtcToken>("/api/agora/rtc-token", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: getApiErrorMessage(e), bucket: getApiErrorBucket(e) };
  }
}
