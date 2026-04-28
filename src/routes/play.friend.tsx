import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Users, Share2, RotateCcw, Flag, Loader2, Info, Pencil, Eraser, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Chess, type Square } from "chess.js";
import { AppShell } from "@/components/app-shell";
import { ChessBoardRC, type BoardArrow } from "@/components/chess/chess-board-rc";
import { MoveHistory } from "@/components/chess/move-history";
import { GameStatusHeader } from "@/components/chess/game-status-header";
import { GameResultModal } from "@/components/chess/game-result-modal";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { BoardSizeControl, FlipBoardButton } from "@/components/chess/board-controls";
import { SoundControls } from "@/components/sound-controls";
import { sound, type SfxKind } from "@/lib/sound";

function sfxForLastMove(chess: Chess): SfxKind {
  if (chess.isCheckmate()) return "game-end";
  if (chess.isCheck()) return "check";
  const last = chess.history({ verbose: true }).slice(-1)[0];
  const flags = last?.flags ?? "";
  if (flags.includes("p")) return "promote";
  if (flags.includes("k") || flags.includes("q")) return "castle";
  if (flags.includes("c") || flags.includes("e")) return "capture";
  return "move";
}
import { PlayerBar } from "@/components/chess/player-bar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CountryFlag } from "@/components/country-flag";
import { useBoardSize } from "@/hooks/use-board-size";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InviteLinkModal } from "@/components/invite-link-modal";
import { VideoCallPanel } from "@/components/video-call-panel";
import { VideoConsentDialog } from "@/components/video-consent-dialog";
import {
  createFriendRoom,
  joinFriendRoom,
  getFriendRoom,
  cancelFriendRoom,
  getGame,
  getActiveMatch,
  extractMoves,
  isPlayable,
  createGameOffer,
  type FriendRoom,
  type Game,
  type GameOffer,
  type Move,
  type PlayerSide,
  type TimeControl,
} from "@/lib/api";
import { connectGameSocket, type LiveGameSocket } from "@/lib/live-game-socket";
import { TimeControlPicker } from "@/components/chess/time-control-picker";
import { ClockBadge } from "@/components/chess/clock-badge";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

const searchSchema = z.object({
  code: z.string().optional(),
});

export const Route = createFileRoute("/play/friend")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Play a friend — Chess Roulette" },
      { name: "description", content: "Create a private room and invite a friend with a single link." },
    ],
  }),
  component: PlayFriend,
});

const ROOM_POLL_MS = 2500;

const DEFAULT_TC: TimeControl = { initialSeconds: 300, incrementSeconds: 2 };

function PlayFriend() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [room, setRoom] = useState<FriendRoom | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [joinCode, setJoinCode] = useState(search.code ?? "");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const [arrowsMode, setArrowsMode] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);
  const [offers, setOffers] = useState<GameOffer[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [timeControl, setTimeControl] = useState<TimeControl | null>(DEFAULT_TC);
  const { size: boardSize, setSize: setBoardSize, maxWidth: boardMaxWidth } = useBoardSize(70);
  const isMobile = useIsMobile();
  // Live socket for the active game.
  const socketRef = useRef<LiveGameSocket | null>(null);
  // Snapshot for optimistic-revert on server error.
  const moveSnapshotRef = useRef<{ game: Game; moves: Move[] } | null>(null);
  // Video consent: per-room (so a fresh match prompts again).
  const [videoConsent, setVideoConsent] = useState<"granted" | "declined" | null>(null);
  const [videoConsentOpen, setVideoConsentOpen] = useState(false);
  // Track which offer ids we've already shown a toast for (declined/cancelled).
  const seenTerminalOfferRef = useRef<Set<string>>(new Set());
  const lastGameStatusRef = useRef<string | null>(null);
  const autoJoinedRef = useRef(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Auto-join via invite link.
  // If the backend recognizes us as the host (same user), it returns
  // playerSide="white" — we should NOT treat that as a guest join.
  useEffect(() => {
    if (!search.code || autoJoinedRef.current || room) return;
    autoJoinedRef.current = true;
    (async () => {
      // First peek with GET — if we're already the host of this room, just load state.
      const peek = await getFriendRoom(search.code!);
      if (!("error" in peek)) {
        if (peek.status === "cancelled") {
          toast.error(t("play.roomCancelled"));
          void navigate({ to: "/play/friend", search: {} });
          return;
        }
        if (userId && peek.whiteUserId === userId) {
          setRoom(peek);
          return;
        }
      }
      const r = await joinFriendRoom(search.code!);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setRoom(r);
      if (r.playerSide === "white") {
        // Same user as host: backend kept us as white.
      } else if (r.playerSide === "black") {
        toast.success(t("play.joinedAsBlack", { code: r.code }));
      } else {
        toast.message(t("play.watchingAs", { code: r.code }));
      }
    })();
  }, [search.code, room, userId, t, navigate]);

  // Poll room state until active (host needs to know when guest joined).
  // Also keep refreshing playerSide in case it changes server-side.
  useEffect(() => {
    if (!room) return;
    if (room.status === "active" && room.gameId && room.blackUserId) return;
    const id = setInterval(async () => {
      const r = await getFriendRoom(room.code);
      if ("error" in r) return;
      if (r.status === "cancelled") {
        clearInterval(id);
        toast.error(t("play.roomCancelled"));
        setRoom(null);
        setGame(null);
        setMoves([]);
        void navigate({ to: "/play/friend", search: {} });
        return;
      }
      setRoom(r);
    }, ROOM_POLL_MS);
    return () => clearInterval(id);
  }, [room, t, navigate]);

  // When room becomes active with a gameId, load the game once via REST
  // (initial load only) then upgrade to WebSocket for all live updates.
  // Live: moves, offers, resign, game-over arrive through the socket.
  useEffect(() => {
    if (!room || room.status !== "active" || !room.gameId) return;
    if (socketRef.current) return; // already connected
    let cancelled = false;
    const gameId = room.gameId;

    (async () => {
      // Initial REST snapshot — only used to render something before the
      // first WebSocket `game_state` event arrives.
      const g = await getGame(gameId);
      if (cancelled) return;
      if (g) {
        setGame(g);
        const embedded = extractMoves(g);
        if (embedded.length > 0) setMoves(embedded);
      }

      // Open the WebSocket. It will emit `game_state` immediately on connect.
      const sock = connectGameSocket(gameId, {
        onState: (next) => {
          if (cancelled) return;
          setGame(next);
          const m = extractMoves(next);
          if (m.length > 0) setMoves(m);
        },
        onMove: (next) => {
          if (cancelled) return;
          moveSnapshotRef.current = null;
          setGame(next);
          const m = extractMoves(next);
          if (m.length > 0) setMoves(m);
          setSelected(null);
          setLegalTargets([]);
        },
        onGameOver: (next) => {
          if (cancelled) return;
          setGame(next);
          const m = extractMoves(next);
          if (m.length > 0) setMoves(m);
        },
        onOffer: (offer, nextGame) => {
          if (cancelled) return;
          if (nextGame) setGame(nextGame);
          if (!offer) return;
          setOffers((prev) => {
            const idx = prev.findIndex((o) => o.id === offer.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = offer;
              return copy;
            }
            return [...prev, offer];
          });
          // One-time toast for declined/cancelled offers I requested.
          if (
            offer.requestedByUserId === userId &&
            (offer.status === "declined" || offer.status === "cancelled")
          ) {
            const key = String(offer.id);
            if (!seenTerminalOfferRef.current.has(key)) {
              seenTerminalOfferRef.current.add(key);
              toast.message(
                offer.status === "declined"
                  ? t("play.drawDeclinedToast")
                  : t("play.drawCancelledToast"),
              );
            }
          }
        },
        onError: (err) => {
          if (cancelled) return;
          // Revert optimistic move if any.
          if (moveSnapshotRef.current) {
            setGame(moveSnapshotRef.current.game);
            setMoves(moveSnapshotRef.current.moves);
            moveSnapshotRef.current = null;
          }
          sound.play("illegal");
          toast.error(err.detail);
          sock.sync();
        },
      });
      socketRef.current = sock;
    })();

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
    // We intentionally only re-open when the gameId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.gameId, room?.status]);

  // Open result modal when game becomes terminal.
  useEffect(() => {
    if (!game) return;
    const prev = lastGameStatusRef.current;
    lastGameStatusRef.current = game.status;
    if (!isPlayable(game.status) && prev !== game.status) {
      setResultOpen(true);
    }
  }, [game]);

  // Reset video consent whenever we leave the room (so a new room re-prompts).
  useEffect(() => {
    if (!room) {
      setVideoConsent(null);
      setVideoConsentOpen(false);
    }
  }, [room]);

  // Show video consent prompt when both players are connected and game is live.
  useEffect(() => {
    if (!room || !game) return;
    const playerSideLocal: PlayerSide = room.playerSide ?? "spectator";
    if (playerSideLocal === "spectator") return;
    if (room.status !== "active" || !isPlayable(game.status)) return;
    if (videoConsent !== null) return;
    setVideoConsentOpen(true);
  }, [room, game, videoConsent]);

  // Ambient music: play while a friend match is active. Cleanup on unmount.
  const ambientStartedRef = useRef(false);
  useEffect(() => {
    if (!game) return;
    if (isPlayable(game.status) && !ambientStartedRef.current) {
      sound.play("game-start");
      sound.startAmbient();
      ambientStartedRef.current = true;
    }
    if (!isPlayable(game.status) && ambientStartedRef.current) {
      sound.stopAmbient();
      ambientStartedRef.current = false;
    }
  }, [game]);
  useEffect(() => () => {
    sound.stopAmbient();
  }, []);

  // playerSide comes only from the backend room. Never guess locally.
  const [viewFlipped, setViewFlipped] = useState(false);
  const playerSide: PlayerSide = room?.playerSide ?? "spectator";
  const baseOrientation: "white" | "black" = playerSide === "black" ? "black" : "white";
  const orientation: "white" | "black" = viewFlipped
    ? baseOrientation === "white" ? "black" : "white"
    : baseOrientation;
  const sameUserSelfView =
    !!room &&
    !!userId &&
    room.whiteUserId === userId &&
    room.status === "waiting"; // host viewing own room while waiting
  const sameUserSelfJoinAttempted =
    !!room &&
    !!search.code &&
    !!userId &&
    room.whiteUserId === userId &&
    !room.blackUserId;

  const isMyTurn = useCallback(() => {
    if (!game || playerSide === "spectator") return false;
    const turn = new Chess(game.fen).turn();
    return (turn === "w" && playerSide === "white") || (turn === "b" && playerSide === "black");
  }, [game, playerSide]);

  const submitMove = useCallback(
    async (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
      if (!game || !isPlayable(game.status) || busy) return;
      if (playerSide === "spectator") {
        toast.error(t("play.spectatorsCannotMove"));
        return;
      }
      if (!isMyTurn()) {
        toast.error(t("play.notYourTurn"));
        return;
      }

      // Validate + apply locally (optimistic) so the UI feels instant.
      const chess = new Chess(game.fen);
      const piece = chess.get(from);
      const isPromotion =
        !!piece &&
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") ||
          (piece.color === "b" && to[1] === "1"));
      const payload: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" } =
        isPromotion ? { from, to, promotion: promotion ?? "q" } : { from, to };

      // Snapshot for revert on server rejection.
      const snapshot = { game, moves };

      let optimisticOk = false;
      try {
        const applied = chess.move({ from, to, promotion: promotion ?? "q" });
        if (applied) {
          optimisticOk = true;
          const optimisticMove: Move = {
            ply: moves.length + 1,
            san: applied.san,
            uci: `${applied.from}${applied.to}${applied.promotion ?? ""}`,
            fenAfter: chess.fen(),
          };
          const optimisticGame: Game = {
            ...game,
            fen: chess.fen(),
            pgn: chess.pgn(),
            status: chess.isCheckmate()
              ? "checkmate"
              : chess.isDraw()
                ? "draw"
                : "active",
            result: chess.isCheckmate()
              ? chess.turn() === "b" ? "1-0" : "0-1"
              : chess.isDraw() ? "1/2-1/2" : undefined,
          };
          setGame(optimisticGame);
          setMoves([...moves, optimisticMove]);
          setSelected(null);
          setLegalTargets([]);
          // Play SFX immediately for snappy feel.
          sound.play(sfxForLastMove(chess));
        }
      } catch {
        // ignore, fall through to server validation
      }

      // Snapshot for revert on server rejection (consumed in onError).
      moveSnapshotRef.current = optimisticOk ? snapshot : null;

      const sock = socketRef.current;
      if (!sock) {
        if (optimisticOk) {
          setGame(snapshot.game);
          setMoves(snapshot.moves);
        }
        moveSnapshotRef.current = null;
        toast.error(t("play.moveRejected"));
        return;
      }
      setBusy(true);
      sock.sendMove({
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion ?? null,
      });
      // onMove / onGameOver / onError reconcile via WS handlers.
      setTimeout(() => setBusy(false), 50);
    },
    [game, moves, busy, playerSide, isMyTurn, t],
  );

  const onSquareClick = useCallback(
    async (square: Square) => {
      if (!game || !isPlayable(game.status) || busy) return;
      if (playerSide === "spectator" || !isMyTurn()) return;
      const chess = new Chess(game.fen);
      const piece = chess.get(square);

      if (selected) {
        if (square === selected) {
          setSelected(null);
          setLegalTargets([]);
          return;
        }
        if (legalTargets.includes(square)) {
          await submitMove(selected, square);
          return;
        }
      }
      const myColor = playerSide === "white" ? "w" : "b";
      if (piece && piece.color === myColor) {
        setSelected(square);
        setLegalTargets(chess.moves({ square, verbose: true }).map((m) => m.to as Square));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    },
    [game, busy, selected, legalTargets, playerSide, isMyTurn, submitMove],
  );

  const handleResign = useCallback(async () => {
    if (!game) return;
    socketRef.current?.sendResign();
  }, [game]);

  const handleCancelInvite = useCallback(async () => {
    if (!room) return;
    const r = await cancelFriendRoom(room.code);
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    toast.success(t("play.inviteCancelled"));
    setRoom(null);
    setGame(null);
    setMoves([]);
    setOffers([]);
    autoJoinedRef.current = false;
    void navigate({ to: "/play/friend", search: {} });
  }, [room, t, navigate]);

  // Determine the opponent user id for offers.
  const opponentUserId = useMemo<string | null>(() => {
    if (!room) return null;
    if (playerSide === "white") return room.blackUserId ?? null;
    if (playerSide === "black") return room.whiteUserId ?? null;
    return null;
  }, [room, playerSide]);

  // Outgoing pending draw offer requested by me.
  const myPendingDraw = offers.find(
    (o) =>
      o.offerType === "draw" &&
      o.status === "pending" &&
      o.requestedByUserId === userId,
  );
  // Incoming pending draw offer for me.
  const incomingDraw = offers.find(
    (o) =>
      o.offerType === "draw" &&
      o.status === "pending" &&
      o.requestedByUserId !== userId &&
      (!o.targetUserId || o.targetUserId === userId),
  );

  const handleOfferDraw = useCallback(async () => {
    if (!game) return;
    setConfirmDraw(false);
    const r = await createGameOffer(game.id, "draw", {
      targetUserId: opponentUserId,
    });
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setOffers((prev) => [...prev.filter((o) => o.id !== r.id), r]);
    toast.message(t("play.drawWaiting"));
  }, [game, opponentUserId, t]);

  const respondDraw = useCallback(
    (offerId: number, action: "accept" | "decline" | "cancel") => {
      if (!game) return;
      socketRef.current?.respondOffer(offerId, action);
      // onOffer / onGameOver handlers will update state from server events.
    },
    [game],
  );

  const handleCreate = async () => {
    const active = await getActiveMatch();
    if (active.hasActiveMatch && active.roomCode) {
      toast.message(t("play.activeMatchRedirect", "Resuming your active match"));
      void navigate({ to: "/play/friend", search: { code: active.roomCode } });
      return;
    }
    const r = await createFriendRoom({ timeControl });
    if ("error" in r) {
      toast.error(r.error);
      if ("activeMatch" in r && r.activeMatch.roomCode) {
        void navigate({ to: "/play/friend", search: { code: r.activeMatch.roomCode } });
      }
      return;
    }
    setRoom(r);
    setInviteOpen(true);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const active = await getActiveMatch();
    if (active.hasActiveMatch && active.roomCode && active.roomCode !== joinCode.trim().toUpperCase()) {
      toast.message(t("play.activeMatchRedirect", "Resuming your active match"));
      void navigate({ to: "/play/friend", search: { code: active.roomCode } });
      return;
    }
    const r = await joinFriendRoom(joinCode.trim());
    if ("error" in r) {
      toast.error(r.error);
      if ("activeMatch" in r && r.activeMatch.roomCode) {
        void navigate({ to: "/play/friend", search: { code: r.activeMatch.roomCode } });
      }
      return;
    }
    setRoom(r);
    if (r.playerSide === "white" && userId && r.whiteUserId === userId) {
      // Backend says we're still host — do not display as a join.
    } else if (r.playerSide === "black") {
      toast.success(t("play.joinedAsBlack", { code: r.code }));
    }
  };

  const lastMove = moves.length
    ? (() => {
        const m = moves[moves.length - 1];
        return { from: m.uci.slice(0, 2) as Square, to: m.uci.slice(2, 4) as Square };
      })()
    : null;

  const turn: "w" | "b" = game ? new Chess(game.fen).turn() : "w";

  const youLabel =
    playerSide === "white"
      ? t("play.youAreWhite")
      : playerSide === "black"
        ? t("play.youAreBlack")
        : t("play.spectator");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t("play.privateMatch")}</p>
          <h1 className="font-display font-bold text-3xl">{t("play.friendTitle")}</h1>
        </div>
        {room && (
          <div className="flex items-center gap-2">
            <Badge variant={playerSide === "spectator" ? "secondary" : "outline"}>
              {youLabel}
            </Badge>
            <Button onClick={() => setInviteOpen(true)} variant="outline" size="sm">
              <Share2 className="h-4 w-4" /> {t("play.invite")} — {room.code}
            </Button>
          </div>
        )}
      </div>

      {!room ? (
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          <Card className="p-6">
            <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="font-display font-semibold text-xl mb-1">{t("play.createRoom")}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {t("play.createRoomDesc")}
            </p>
            <div className="mb-4">
              <TimeControlPicker value={timeControl} onChange={setTimeControl} />
            </div>
            <Button onClick={handleCreate} className="w-full bg-gradient-primary text-primary-foreground">
              {t("play.createRoomBtn")}
            </Button>
          </Card>

          <Card className="p-6">
            <div className="grid place-items-center h-12 w-12 rounded-xl bg-accent text-accent-foreground mb-4">
              <Share2 className="h-5 w-5" />
            </div>
            <h2 className="font-display font-semibold text-xl mb-1">{t("play.joinRoom")}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {t("play.joinRoomDesc")}
            </p>
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("play.roomCode")}</Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="A1B2C3"
                className="font-mono tracking-widest text-center"
                maxLength={6}
              />
              <Button onClick={handleJoin} variant="outline" className="w-full">{t("play.joinRoomBtn")}</Button>
            </div>
          </Card>
        </div>
      ) : room.status === "waiting" || !game ? (
        <Card className="p-10 max-w-xl mx-auto text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <h2 className="font-display font-semibold text-xl mb-2">{t("play.waitingForOpponent")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("play.shareCode", { code: room.code })}
          </p>
          {(sameUserSelfView || sameUserSelfJoinAttempted) && (
            <div className="text-left text-sm bg-muted/40 border border-border rounded-lg p-3 mb-4 flex gap-2">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>
                {t("play.selfRoomNote")}
              </span>
            </div>
          )}
          <div className="text-xs text-muted-foreground mb-4">
            <span className="inline-flex items-center gap-1.5">
              {t("play.white")}:{" "}
              <CountryFlag code={room.whitePlayer?.countryCode} className="text-sm" />
              {room.whitePlayer?.name ?? "—"}
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5">
              {t("play.black")}:{" "}
              <CountryFlag code={room.blackPlayer?.countryCode} className="text-sm" />
              {room.blackPlayer?.name ?? t("common.waiting")}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setInviteOpen(true)} variant="outline" size="sm">
              <Share2 className="h-4 w-4" /> {t("play.copyInvite")}
            </Button>
            {userId && room.whiteUserId === userId && (
              <Button
                onClick={() => setConfirmCancel(true)}
                variant="destructive"
                size="sm"
              >
                <X className="h-4 w-4" /> {t("play.cancelInvite")}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">
          <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
            <GameStatusHeader game={game} turn={turn} myPhotoUrl={user?.photoUrl} />

            {/* Desktop player names line */}
            <div className="hidden lg:flex text-xs text-muted-foreground flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <strong className="text-foreground">{t("play.white")}:</strong>{" "}
                <CountryFlag code={room.whitePlayer?.countryCode} className="text-sm" />
                {room.whitePlayer?.name ?? "—"}
                {userId && room.whiteUserId === userId && ` (${t("common.you")})`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <strong className="text-foreground">{t("play.black")}:</strong>{" "}
                <CountryFlag code={room.blackPlayer?.countryCode} className="text-sm" />
                {room.blackPlayer?.name ?? "—"}
                {userId && room.blackUserId === userId && ` (${t("common.you")})`}
              </span>
            </div>

            {/* Opponent bar (top) with clock */}
            {(() => {
              const opp = playerSide === "white" ? room.blackPlayer : room.whitePlayer;
              const oppSide: "white" | "black" = playerSide === "white" ? "black" : "white";
              const oppTurn =
                (turn === "w" && playerSide === "black") ||
                (turn === "b" && playerSide === "white");
              const sideToMove = game.sideToMove ?? (turn === "w" ? "white" : "black");
              return (
                <div className="lg:hidden flex items-center gap-2">
                  <PlayerBar
                    className="flex-1 min-w-0"
                    name={opp?.name ?? t("common.waiting")}
                    countryCode={opp?.countryCode}
                    rating={opp?.rating}
                    isAi={opp?.isAi}
                    photoUrl={opp?.avatarUrl}
                    userId={opp?.id ?? null}
                    isTurn={oppTurn && isPlayable(game.status)}
                  />
                  <ClockBadge side={oppSide} sideToMove={sideToMove} clocks={game.clocks ?? null} />
                </div>
              );
            })()}

            <div className="flex gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <EvaluationBar evalCp={0} orientation={orientation} />
              </div>
              <div className="flex-1 min-w-0 flex justify-center -mx-4 sm:mx-0">
                <ChessBoardRC
                  fen={game.fen}
                  orientation={orientation}
                  selected={selected}
                  legalTargets={legalTargets}
                  lastMove={lastMove}
                  onSquareClick={onSquareClick}
                  onPieceDrop={(from, to) => {
                    if (
                      playerSide === "spectator" ||
                      !isPlayable(game.status) ||
                      !isMyTurn()
                    )
                      return false;
                    const chess = new Chess(game.fen);
                    const legal = chess
                      .moves({ square: from, verbose: true })
                      .some((m) => m.to === to);
                    if (!legal) return false;
                    void submitMove(from, to);
                    return true;
                  }}
                  disabled={
                    playerSide === "spectator" ||
                    !isPlayable(game.status) ||
                    !isMyTurn()
                  }
                  canDragColor={
                    playerSide === "white"
                      ? "w"
                      : playerSide === "black"
                        ? "b"
                        : null
                  }
                  arrows={arrows}
                  onArrowsChange={setArrows}
                  arrowsMode={arrowsMode}
                  onArrowRejected={() => toast.message(t("play.arrowInvalid"))}
                  maxWidth={boardMaxWidth}
                />
              </div>
            </div>

            {/* Your bar (bottom) with clock */}
            {(() => {
              if (playerSide === "spectator") return null;
              const me = playerSide === "white" ? room.whitePlayer : room.blackPlayer;
              const mySide: "white" | "black" = playerSide === "white" ? "white" : "black";
              const myTurn = isMyTurn();
              const sideToMove = game.sideToMove ?? (turn === "w" ? "white" : "black");
              return (
                <div className="lg:hidden flex items-center gap-2">
                  <PlayerBar
                    className="flex-1 min-w-0"
                    name={me?.name ?? user?.username ?? t("common.you")}
                    countryCode={me?.countryCode ?? user?.countryCode}
                    rating={me?.rating ?? user?.rating}
                    photoUrl={user?.photoUrl ?? me?.avatarUrl}
                    isYou
                    isTurn={myTurn && isPlayable(game.status)}
                  />
                  <ClockBadge side={mySide} sideToMove={sideToMove} clocks={game.clocks ?? null} />
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FlipBoardButton onFlip={() => setViewFlipped((v) => !v)} />
                <SoundControls />
              </div>
              <BoardSizeControl value={boardSize} onChange={setBoardSize} />
            </div>

            {/* Controls — horizontal scroll on mobile, wrap on desktop */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
              <Button
                variant={arrowsMode ? "default" : "outline"}
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => setArrowsMode((v) => !v)}
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {arrowsMode ? t("play.annotationMode") : t("play.arrowsOff")}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => setArrows([])}
                disabled={arrows.length === 0}
              >
                <Eraser className="h-4 w-4" />
                <span className="hidden sm:inline">{t("play.clearArrows")}</span>
              </Button>
              {myPendingDraw ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0"
                  onClick={() => respondDraw(myPendingDraw.id, "cancel")}
                >
                  <RotateCcw className="h-4 w-4" /> {t("play.cancelDrawOffer")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0"
                  disabled={
                    playerSide === "spectator" ||
                    !isPlayable(game.status) ||
                    !opponentUserId
                  }
                  title={!opponentUserId ? t("play.waitingForOpponentToConnect") : undefined}
                  onClick={() => setConfirmDraw(true)}
                >
                  <RotateCcw className="h-4 w-4" /> {t("play.offerDraw")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => setResignConfirm(true)}
                disabled={playerSide === "spectator" || !isPlayable(game.status)}
              >
                <Flag className="h-4 w-4" /> {t("play.resign")}
              </Button>
            </div>
            {incomingDraw && (
              <Card className="p-4 border-primary/50 bg-primary/5">
                <p className="font-display font-semibold mb-1">{t("play.drawIncoming")}</p>
                <p className="text-sm text-muted-foreground mb-3">{t("play.drawIncomingDesc")}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="min-h-11" onClick={() => respondDraw(incomingDraw.id, "accept")}>
                    {t("play.accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => respondDraw(incomingDraw.id, "decline")}
                  >
                    {t("play.decline")}
                  </Button>
                </div>
              </Card>
            )}

            {/* Mobile-only tabs: Video / History */}
            <Tabs defaultValue="video" className="lg:hidden">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="video" className="min-h-11">{t("call.title")}</TabsTrigger>
                <TabsTrigger value="history" className="min-h-11">{t("review.moveHistory")}</TabsTrigger>
              </TabsList>
              <TabsContent value="video" className="mt-3">
                <VideoCallPanel
                  roomCode={room.code}
                  gameId={game.id}
                  hideWhenUnavailable={false}
                  layout="pip"
                  autoJoin={
                    isMobile &&
                    videoConsent === "granted" &&
                    playerSide !== "spectator" &&
                    room.status === "active" &&
                    isPlayable(game.status)
                  }
                />
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <MoveHistory moves={moves} currentPly={moves.length} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Desktop side-rail: history + video */}
          <div className="hidden lg:block space-y-4">
            <MoveHistory moves={moves} currentPly={moves.length} />
            <VideoCallPanel
              roomCode={room.code}
              gameId={game.id}
              hideWhenUnavailable={false}
              size="large"
              autoJoin={
                !isMobile &&
                videoConsent === "granted" &&
                playerSide !== "spectator" &&
                room.status === "active" &&
                isPlayable(game.status)
              }
            />
          </div>
        </div>
      )}

      {room && (
        <InviteLinkModal open={inviteOpen} onOpenChange={setInviteOpen} code={room.code} />
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("play.cancelInviteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("play.cancelInviteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("play.keepRoom")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelInvite}>
              {t("play.confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDraw} onOpenChange={setConfirmDraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("play.drawOfferTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("play.drawOfferDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleOfferDraw}>
              {t("play.offerDraw")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resignConfirm} onOpenChange={setResignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("play.resignTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("play.resignDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("play.keepPlaying")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResignConfirm(false);
                void handleResign();
              }}
            >
              {t("play.resign")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GameResultModal
        game={game}
        userColor={playerSide === "black" ? "black" : "white"}
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        onNewGame={() => {
          setResultOpen(false);
          setRoom(null);
          setGame(null);
          setMoves([]);
          setOffers([]);
          autoJoinedRef.current = false;
          void navigate({ to: "/play/friend", search: {} });
        }}
        onReview={() => {
          setResultOpen(false);
          if (game) void navigate({ to: "/review", search: { gameId: String(game.id) } });
        }}
      />
      <VideoConsentDialog
        open={videoConsentOpen}
        onOpenChange={(o) => {
          setVideoConsentOpen(o);
          if (!o && videoConsent === null) setVideoConsent("declined");
        }}
        onAllow={() => {
          setVideoConsent("granted");
          setVideoConsentOpen(false);
        }}
        onDecline={() => {
          setVideoConsent("declined");
          setVideoConsentOpen(false);
        }}
      />
    </AppShell>
  );
}
