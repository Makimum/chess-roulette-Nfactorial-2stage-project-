import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  createGame,
  getGameMoves,
  setLastGameId,
  isPlayable,
  type Game,
  type Move,
  type GameMode,
  type Color,
  type TimeControl,
  type GameClock,
} from "@/lib/api";
import { connectGameSocket, type LiveGameSocket } from "@/lib/live-game-socket";
import { toast } from "sonner";
import { sound, type SfxKind } from "@/lib/sound";

/** Pick the right SFX for the most recent move on `chess`. */
function sfxForLastMove(chess: Chess): SfxKind {
  if (chess.isCheckmate()) return "game-end";
  if (chess.isCheck()) return "check";
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  if (!last) return "move";
  const flags = last.flags ?? "";
  if (flags.includes("p")) return "promote";
  if (flags.includes("k") || flags.includes("q")) return "castle";
  if (flags.includes("c") || flags.includes("e")) return "capture";
  return "move";
}

interface UseChessGameOpts {
  mode: GameMode;
  color?: Color;
  aiLevel?: number;
  autoAiResponse?: boolean;
  timeControl?: TimeControl | null;
}

interface PendingPromotion {
  from: Square;
  to: Square;
  color: "w" | "b";
}

export function useChessGame(opts: UseChessGameOpts) {
  const [game, setGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [thinking, setThinking] = useState(false);
  const [orientation, setOrientation] = useState<Color>(opts.color ?? "white");
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [clocks, setClocks] = useState<GameClock | null>(null);
  const turnRef = useRef<"w" | "b">("w");
  const socketRef = useRef<LiveGameSocket | null>(null);
  // Snapshot for optimistic-revert
  const snapshotRef = useRef<{ game: Game; moves: Move[] } | null>(null);

  const userColor: Color = opts.color ?? "white";

  const applyServerGame = useCallback((next: Game, refreshMovesIfMissing = true) => {
    setGame(next);
    setClocks(next.clocks ?? null);
    turnRef.current = new Chess(next.fen).turn();
    if (next.moveHistory && next.moveHistory.length) {
      setMoves(next.moveHistory);
    } else if (refreshMovesIfMissing) {
      void getGameMoves(next.id).then(setMoves);
    }
  }, []);

  // bootstrap & reset
  useEffect(() => {
    let cancelled = false;
    setGame(null);
    setMoves([]);
    setSelected(null);
    setLegalTargets([]);
    setPendingPromotion(null);
    setThinking(false);
    setClocks(null);
    createGame({
      mode: opts.mode,
      color: userColor,
      aiLevel: opts.aiLevel,
      timeControl: opts.timeControl ?? null,
    })
      .then((g) => {
        if (cancelled) return;
        applyServerGame(g);
        setLastGameId(g.id);
        setOrientation(userColor);
        sound.play("game-start");
        sound.startAmbient();

        // Open WebSocket for live updates / move submission.
        const sock = connectGameSocket(g.id, {
          onState: (next) => {
            if (cancelled) return;
            applyServerGame(next);
          },
          onMove: (next) => {
            if (cancelled) return;
            applyServerGame(next);
            sound.play(sfxForLastMove(new Chess(next.fen)));
            // For AI mode: if it's now AI's turn, ask backend.
            if (
              opts.mode === "ai" &&
              opts.autoAiResponse !== false &&
              isPlayable(next.status) &&
              (new Chess(next.fen).turn() === "w") !== (userColor === "white")
            ) {
              setThinking(true);
              sock.sendAiMove();
            } else {
              setThinking(false);
            }
          },
          onGameOver: (next) => {
            if (cancelled) return;
            applyServerGame(next, false);
            sound.play("game-end");
            sound.stopAmbient();
            setThinking(false);
          },
          onError: (err) => {
            if (cancelled) return;
            // Revert optimistic state, then resync.
            if (snapshotRef.current) {
              setGame(snapshotRef.current.game);
              setMoves(snapshotRef.current.moves);
              turnRef.current = new Chess(snapshotRef.current.game.fen).turn();
              snapshotRef.current = null;
            }
            sound.play("illegal");
            toast.error(err.detail);
            sock.sync();
            setThinking(false);
          },
        });
        socketRef.current = sock;

        // If user is black in AI mode, white (AI) must move first.
        if (
          opts.mode === "ai" &&
          opts.autoAiResponse !== false &&
          userColor === "black" &&
          isPlayable(g.status) &&
          new Chess(g.fen).turn() === "w"
        ) {
          setThinking(true);
          sock.sendAiMove();
        }
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Could not start game");
      });
    return () => {
      cancelled = true;
      sound.stopAmbient();
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.mode, opts.aiLevel, userColor, resetToken, opts.timeControl?.initialSeconds, opts.timeControl?.incrementSeconds]);

  const isUserTurn = useCallback(
    (currentGame: Game) => {
      const chess = new Chess(currentGame.fen);
      return (chess.turn() === "w") === (userColor === "white");
    },
    [userColor],
  );

  /**
   * Optimistic move: validate locally with chess.js, apply UI immediately,
   * then send via WebSocket. On error event from server, snapshotRef revert
   * happens in the onError handler.
   */
  const submitMove = useCallback(
    async (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): Promise<boolean> => {
      if (!game || !isPlayable(game.status) || thinking) return false;
      if (!isUserTurn(game)) return false;
      const sock = socketRef.current;
      if (!sock) return false;

      const chess = new Chess(game.fen);
      const piece = chess.get(from);
      if (!piece) return false;

      const isPawnPromotion =
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
      if (isPawnPromotion && !promotion) {
        const legal = chess.moves({ square: from, verbose: true }).some((m) => m.to === to);
        if (!legal) return false;
        setPendingPromotion({ from, to, color: piece.color });
        return false;
      }

      let optimisticResult;
      try {
        optimisticResult = chess.move({ from, to, promotion: promotion ?? "q" });
      } catch {
        return false;
      }
      if (!optimisticResult) return false;

      snapshotRef.current = { game, moves };

      const optimisticMove: Move = {
        ply: moves.length + 1,
        san: optimisticResult.san,
        uci: `${optimisticResult.from}${optimisticResult.to}${optimisticResult.promotion ?? ""}`,
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
      turnRef.current = chess.turn();

      sound.play(sfxForLastMove(chess));

      // Send via WebSocket — server reply comes through onMove / onGameOver / onError.
      sock.sendMove({ from, to, promotion: promotion ?? "q" });
      return true;
    },
    [game, moves, thinking, isUserTurn],
  );

  const onSquareClick = useCallback(
    async (square: Square) => {
      if (!game || !isPlayable(game.status) || thinking) return;
      if (!isUserTurn(game)) return;
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
      if (piece && ((piece.color === "w") === (userColor === "white"))) {
        setSelected(square);
        setLegalTargets(chess.moves({ square, verbose: true }).map((m) => m.to as Square));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    },
    [game, selected, legalTargets, thinking, isUserTurn, submitMove, userColor],
  );

  const onPieceDrop = useCallback(
    (from: Square, to: Square): boolean => {
      if (!game || !isPlayable(game.status) || thinking) return false;
      if (!isUserTurn(game)) return false;
      const chess = new Chess(game.fen);
      const legal = chess.moves({ square: from, verbose: true }).some((m) => m.to === to);
      if (!legal) return false;
      void submitMove(from, to);
      return true;
    },
    [game, thinking, isUserTurn, submitMove],
  );

  const confirmPromotion = useCallback(
    async (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      await submitMove(from, to, piece);
    },
    [pendingPromotion, submitMove],
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    setSelected(null);
    setLegalTargets([]);
  }, []);

  const resign = useCallback(() => {
    if (!game || !isPlayable(game.status)) return;
    socketRef.current?.sendResign();
  }, [game]);

  const offerDraw = useCallback(() => {
    if (!game || !isPlayable(game.status)) return;
    // Backend handles draw offers via REST /offers in friend mode; for AI mode
    // we just inform the user — backend will not accept a draw offer in AI mode.
    if (opts.mode === "ai") {
      toast.info("Draw offers are not available in AI games");
    } else {
      toast("Draw offer sent");
    }
  }, [game, opts.mode]);

  const flipBoard = useCallback(() => {
    setOrientation((o) => (o === "white" ? "black" : "white"));
  }, []);

  const newGame = useCallback(() => {
    setResetToken((t) => t + 1);
  }, []);

  const lastMove = moves.length
    ? (() => {
        const m = moves[moves.length - 1];
        return { from: m.uci.slice(0, 2) as Square, to: m.uci.slice(2, 4) as Square };
      })()
    : null;

  return {
    game,
    moves,
    selected,
    legalTargets,
    onSquareClick,
    onPieceDrop,
    lastMove,
    thinking,
    turn: turnRef.current,
    setGame,
    orientation,
    flipBoard,
    pendingPromotion,
    confirmPromotion,
    cancelPromotion,
    resign,
    offerDraw,
    newGame,
    userColor,
    clocks,
    timeControl: opts.timeControl ?? game?.timeControl ?? null,
  };
}
