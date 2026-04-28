// Live game WebSocket client.
//
// Backend contract: ws(s)://<host>/ws/games/{gameId}?token=<accessToken>
// Server is the source of truth for clocks, turn order, timeouts and game over.
// Frontend sends move/aiMove/resign/respondOffer/sync; receives game_state,
// move_made, offer_updated, game_over, error.

import { getAuthToken, refreshAccessToken } from "./auth";
import { normalizeGame, type Game, type GameId, type GameOffer, type Move } from "./api";

const HTTP_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

function wsBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (!HTTP_BASE) return "";
  return HTTP_BASE.replace(/^http/i, (m: string) => (m === "http" ? "ws" : "wss"));
}

export type LiveErrorEvent = { status?: number; detail: string };

export interface LiveGameHandlers {
  onState?: (game: Game) => void;
  onMove?: (game: Game, move: Move | null) => void;
  onGameOver?: (game: Game, move: Move | null) => void;
  onOffer?: (offer: GameOffer | null, game: Game | null) => void;
  onError?: (err: LiveErrorEvent) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onReconnecting?: (attempt: number) => void;
}

export interface LiveGameSocket {
  send(payload: unknown): void;
  sync(): void;
  sendMove(input: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" | null }): void;
  sendAiMove(): void;
  sendResign(): void;
  respondOffer(offerId: number, action: "accept" | "decline" | "cancel"): void;
  close(): void;
  isOpen(): boolean;
}

interface RawServerEvent {
  type: string;
  game?: unknown;
  move?: unknown;
  offer?: unknown;
  status?: number;
  detail?: string;
}

export function connectGameSocket(gameId: GameId, handlers: LiveGameHandlers): LiveGameSocket {
  let ws: WebSocket | null = null;
  let closedByUser = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let didRefreshOnce = false;

  const buildUrl = (token: string | null): string => {
    const base = wsBaseUrl();
    if (!base) throw new Error("VITE_API_BASE_URL is not set");
    const tokenPart = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${base}/ws/games/${gameId}${tokenPart}`;
  };

  const handleEvent = (raw: RawServerEvent): void => {
    const game = raw.game ? normalizeGame(raw.game as Parameters<typeof normalizeGame>[0]) : null;
    const move = (raw.move ?? null) as Move | null;
    switch (raw.type) {
      case "game_state":
        if (game) handlers.onState?.(game);
        break;
      case "move_made":
        if (game) handlers.onMove?.(game, move);
        break;
      case "game_over":
        if (game) handlers.onGameOver?.(game, move);
        break;
      case "offer_updated":
        handlers.onOffer?.((raw.offer ?? null) as GameOffer | null, game);
        break;
      case "error":
        handlers.onError?.({ status: raw.status, detail: raw.detail ?? "Live error" });
        break;
      default:
        // unknown event — ignore but don't crash
        break;
    }
  };

  const open = async (): Promise<void> => {
    if (closedByUser) return;
    let token = getAuthToken();
    try {
      ws = new WebSocket(buildUrl(token));
    } catch (e) {
      handlers.onError?.({ detail: e instanceof Error ? e.message : "WebSocket error" });
      scheduleReconnect();
      return;
    }
    ws.addEventListener("open", () => {
      attempt = 0;
      didRefreshOnce = false;
      handlers.onOpen?.();
      // Always request current state on (re)connect.
      try {
        ws?.send(JSON.stringify({ type: "sync" }));
      } catch { /* noop */ }
    });
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return;
      let parsed: RawServerEvent | null = null;
      try {
        parsed = JSON.parse(ev.data) as RawServerEvent;
      } catch {
        return;
      }
      if (parsed && typeof parsed.type === "string") handleEvent(parsed);
    });
    ws.addEventListener("close", async (ev) => {
      handlers.onClose?.(ev.code, ev.reason);
      if (closedByUser) return;
      // Policy violation (1008) likely means token expired or invalid — try one refresh.
      if (ev.code === 1008 && !didRefreshOnce) {
        didRefreshOnce = true;
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          attempt = 0;
          void open();
          return;
        }
      }
      scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      // close handler will fire and trigger reconnect
    });
    // Keep token referenced for closure — silences lint about unused var.
    void token;
  };

  const scheduleReconnect = (): void => {
    if (closedByUser) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    attempt += 1;
    const delay = Math.min(15_000, 500 * Math.pow(2, Math.min(attempt, 5)));
    handlers.onReconnecting?.(attempt);
    reconnectTimer = setTimeout(() => { void open(); }, delay);
  };

  void open();

  return {
    send(payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(JSON.stringify(payload)); } catch { /* noop */ }
    },
    sync() {
      this.send({ type: "sync" });
    },
    sendMove(input) {
      this.send({
        type: "move",
        payload: {
          from: input.from,
          to: input.to,
          promotion: input.promotion ?? null,
        },
      });
    },
    sendAiMove() {
      this.send({ type: "aiMove" });
    },
    sendResign() {
      this.send({ type: "resign" });
    },
    respondOffer(offerId, action) {
      this.send({ type: "respondOffer", offerId, action });
    },
    close() {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(1000, "client closed"); } catch { /* noop */ }
      }
    },
    isOpen() {
      return !!ws && ws.readyState === WebSocket.OPEN;
    },
  };
}
