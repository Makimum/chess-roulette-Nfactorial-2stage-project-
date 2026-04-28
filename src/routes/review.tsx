import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Brain, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Chess } from "chess.js";
import { AppShell } from "@/components/app-shell";
import { ChessBoardRC } from "@/components/chess/chess-board-rc";
import { MoveHistory } from "@/components/chess/move-history";
import { AiCoachPanel } from "@/components/chess/ai-coach-panel";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BoardSizeControl, FlipBoardButton } from "@/components/chess/board-controls";
import { useBoardSize } from "@/hooks/use-board-size";
import { Progress } from "@/components/ui/progress";
import {
  getGameReview,
  requestGameReview,
  getLastGameId,
  type GameReview,
  type GameReviewMove,
  type MoveClassification,
  type Move,
} from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const search = z.object({ gameId: z.string().optional() });

export const Route = createFileRoute("/review")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Game Review — Chess Roulette" },
      { name: "description", content: "Replay your games move-by-move with personalized AI coaching." },
    ],
  }),
  component: Review,
});

const CLASS_BADGE: Record<MoveClassification, string> = {
  best: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  excellent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  good: "bg-muted text-muted-foreground border-border",
  inaccuracy: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  mistake: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  blunder: "bg-destructive/15 text-destructive border-destructive/40",
  unknown: "bg-muted text-muted-foreground border-border",
};

const CLASS_LABEL: Record<MoveClassification, string> = {
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  unknown: "Not analyzed",
};

function reviewMoveToMove(m: GameReviewMove): Move {
  // Map the review move into the lightweight Move shape MoveHistory expects.
  const cls = m.classification === "excellent" ? "great" : m.classification;
  const compatCls =
    cls === "best" || cls === "great" || cls === "good" || cls === "inaccuracy" || cls === "mistake" || cls === "blunder"
      ? cls
      : undefined;
  return {
    id: m.moveId,
    gameId: 0 as never,
    moveNumber: m.moveNumber,
    ply: m.ply,
    color: m.color,
    san: m.san,
    uci: m.uci,
    fenBefore: m.fenBefore,
    fenAfter: m.fenAfter,
    evalCp: m.evalAfter ?? undefined,
    classification: compatCls,
  } as Move;
}

function Review() {
  const { t } = useTranslation();
  const { gameId } = Route.useSearch();
  const initialId = (() => {
    if (gameId) {
      const n = Number(gameId);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  })();
  const [resolvedId, setResolvedId] = useState<number | null>(initialId);
  const [review, setReview] = useState<GameReview | null>(null);
  const [ply, setPly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const { size: boardSize, setSize: setBoardSize, maxWidth: boardMaxWidth } = useBoardSize(70);

  useEffect(() => {
    let id: number | null = null;
    if (gameId) {
      const n = Number(gameId);
      if (Number.isFinite(n) && n > 0) id = n;
    }
    if (id == null) id = getLastGameId();
    setResolvedId(id);
    if (!id) setLoading(false);
  }, [gameId]);

  useEffect(() => {
    if (!resolvedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGameReview(resolvedId)
      .then((r) => {
        if (cancelled) return;
        setReview(r);
        setPly(r.moves.length);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t("review.analysisUnavailable");
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedId, t]);

  const moves = review?.moves ?? [];
  const historyMoves = moves.map(reviewMoveToMove);

  const fen =
    ply === 0
      ? new Chess().fen()
      : moves[ply - 1]?.fenAfter ?? new Chess().fen();

  const lastMove =
    ply > 0 && moves[ply - 1]
      ? {
          from: moves[ply - 1].uci.slice(0, 2) as never,
          to: moves[ply - 1].uci.slice(2, 4) as never,
        }
      : null;

  const currentMove = ply > 0 ? moves[ply - 1] : null;
  const evalCp = currentMove?.evalAfter ?? review?.finalEvaluation ?? 0;

  const reanalyze = async () => {
    if (!resolvedId) return;
    setReanalyzing(true);
    try {
      const r = await requestGameReview(resolvedId);
      setReview(r);
      toast.success(t("review.analyze"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("review.analysisUnavailable"));
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t("review.postGame")}</p>
          <h1 className="font-display font-bold text-3xl flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" /> {t("review.title")}
          </h1>
        </div>
      </div>

      {!resolvedId ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{t("review.noGame")}</p>
        </Card>
      ) : error ? (
        <Card className="p-12 text-center border-destructive/40">
          <p className="text-destructive font-medium">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            {t("review.analyzing")}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Stockfish analysis may take a few seconds.
          </p>
          <Progress value={66} className="max-w-xs mx-auto mt-4" />
        </Card>
      ) : review && review.moves.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">{t("review.noMoves")}</p>
        </Card>
      ) : review ? (
        <>
          {!review.engineUsed && (
            <Card className="p-3 mb-4 border-warning/40 bg-warning/5 flex items-start gap-2">
              <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90">
                Engine analysis is unavailable; showing material-based fallback.
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
            <SummaryStat
              label={t("review.accuracyW")}
              value={fmtPct(review.summary.accuracyWhite)}
              accent
            />
            <SummaryStat
              label={t("review.accuracyB")}
              value={fmtPct(review.summary.accuracyBlack)}
            />
            <SummaryStat
              label="Avg CPL W"
              value={fmtCpl(review.summary.averageCentipawnLossWhite)}
            />
            <SummaryStat
              label="Avg CPL B"
              value={fmtCpl(review.summary.averageCentipawnLossBlack)}
            />
            <SummaryStat
              label={t("review.mistakes")}
              value={String(
                (review.summary.countsWhite.mistake ?? 0) +
                  (review.summary.countsBlack.mistake ?? 0),
              )}
            />
            <SummaryStat
              label={t("review.blunders")}
              value={String(
                (review.summary.countsWhite.blunder ?? 0) +
                  (review.summary.countsBlack.blunder ?? 0),
              )}
              danger
            />
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div className="space-y-4">
              <div className="flex gap-2 sm:gap-3">
                <div className="hidden sm:block">
                  <EvaluationBar evalCp={evalCp} orientation={orientation} />
                </div>
                <div className="flex-1 min-w-0 flex justify-center">
                  <ChessBoardRC
                    fen={fen}
                    orientation={orientation}
                    lastMove={lastMove}
                    disabled
                    canDragColor={null}
                    maxWidth={boardMaxWidth}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <FlipBoardButton
                  onFlip={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                />
                <BoardSizeControl value={boardSize} onChange={setBoardSize} />
              </div>

              {currentMove && (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", CLASS_BADGE[currentMove.classification])}
                      >
                        {currentMove.classification === "blunder" && (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        {CLASS_LABEL[currentMove.classification]}
                      </Badge>
                      <span className="font-mono text-sm">
                        {Math.ceil(currentMove.ply / 2)}
                        {currentMove.color === "white" ? "." : "..."} {currentMove.san}
                      </span>
                    </div>
                    {currentMove.centipawnLoss != null && currentMove.centipawnLoss > 0 && (
                      <span className="text-xs text-muted-foreground">
                        CPL: {currentMove.centipawnLoss}
                      </span>
                    )}
                  </div>
                  {currentMove.comment && (
                    <p className="text-sm text-foreground/90">{currentMove.comment}</p>
                  )}
                  {currentMove.bestMoveSan && currentMove.bestMoveSan !== currentMove.san && (
                    <p className="text-xs text-muted-foreground">
                      {t("review.best")}:{" "}
                      <span className="font-mono text-foreground">{currentMove.bestMoveSan}</span>
                    </p>
                  )}
                </Card>
              )}

              <Card className="p-4 flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={() => setPly(0)}>‹‹</Button>
                <Button size="sm" variant="outline" onClick={() => setPly(Math.max(0, ply - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("review.move")}</p>
                  <p className="font-display font-bold text-lg">
                    {ply === 0
                      ? t("review.start")
                      : `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${moves[ply - 1]?.san}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPly(Math.min(moves.length, ply + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPly(moves.length)}>››</Button>
              </Card>
            </div>

            <div className="space-y-4">
              <AiCoachPanel
                moves={moves}
                loading={reanalyzing}
                onAnalyze={reanalyze}
                onSelectPly={setPly}
              />
              <MoveHistory moves={historyMoves} currentPly={ply} onSelect={setPly} />
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtCpl(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(0);
}

function SummaryStat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <Card
      className={`p-4 ${accent ? "bg-gradient-primary text-primary-foreground border-0" : ""} ${
        danger ? "border-destructive/40" : ""
      }`}
    >
      <p
        className={`text-[10px] uppercase tracking-widest font-semibold ${
          accent ? "opacity-80" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="font-display font-bold text-2xl mt-1 flex items-center gap-1">
        {danger && Number(value) > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
        {value}
      </p>
    </Card>
  );
}
