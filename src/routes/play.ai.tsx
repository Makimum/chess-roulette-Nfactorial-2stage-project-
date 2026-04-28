import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bot, RotateCcw, Flag, Handshake, Pencil, Eraser, Settings as SettingsIcon, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ChessBoardRC, type BoardArrow } from "@/components/chess/chess-board-rc";
import { MoveHistory } from "@/components/chess/move-history";
import { AiCoachPanel } from "@/components/chess/ai-coach-panel";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { GameStatusHeader } from "@/components/chess/game-status-header";
import { CapturedPieces } from "@/components/chess/captured-pieces";
import { PromotionDialog } from "@/components/chess/promotion-dialog";
import { GameResultModal } from "@/components/chess/game-result-modal";
import { FlipBoardButton } from "@/components/chess/board-controls";
import { SoundControls } from "@/components/sound-controls";
import { AIGameSettingsModal } from "@/components/chess/ai-game-settings-modal";
import { AIPreGamePanel } from "@/components/chess/ai-pre-game-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BOARD_THEME_TOKENS,
  animationToMs,
  boardSizeToMaxWidth,
  methodToFlags,
  useAIGameSettings,
  type AIGameSettings,
} from "@/hooks/use-ai-game-settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useChessGame } from "@/hooks/use-chess-game";
import { getActiveMatch, isPlayable, type TimeControl } from "@/lib/api";
import { ClockBadge } from "@/components/chess/clock-badge";
import { Chess } from "chess.js";
import { toast } from "sonner";

export const Route = createFileRoute("/play/ai")({
  head: () => ({
    meta: [
      { title: "Play vs AI — Chess Roulette" },
      { name: "description", content: "Challenge the Mentor AI across 20 levels of difficulty." },
    ],
  }),
  component: PlayAi,
});

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function resolveOrientation(
  mode: AIGameSettings["orientationMode"],
  resolvedColor: "white" | "black",
): "white" | "black" {
  if (mode === "white") return "white";
  if (mode === "black") return "black";
  return resolvedColor;
}

type Phase = "setup" | "playing";

function PlayAi() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [level, setLevel] = useState(5);
  const [phase, setPhase] = useState<Phase>("setup");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeControl, setTimeControl] = useState<TimeControl | null>({
    initialSeconds: 300,
    incrementSeconds: 2,
  });

  const { settings, saveSettings, resolvedPlayerColor, rerollResolvedColor } =
    useAIGameSettings();

  const handleStart = async () => {
    // One-active-match rule: if user already has an active match, redirect.
    const active = await getActiveMatch();
    if (active.hasActiveMatch) {
      if (active.roomCode) {
        toast.message(t("play.activeMatchRedirect", "Resuming your active match"));
        void navigate({ to: "/play/friend", search: { code: active.roomCode } });
        return;
      }
      // AI active match — just enter playing phase; createGame on backend will
      // return the existing game via activeMatchRedirect.
    }
    if (settings.playerColor === "random") rerollResolvedColor();
    setPhase("playing");
  };

  const handleBackToSetup = () => setPhase("setup");

  const handleSettingsSave = (next: AIGameSettings, colorChanged: boolean) => {
    saveSettings(next);
    if (colorChanged) rerollResolvedColor();
  };

  const themeTokens = BOARD_THEME_TOKENS[settings.boardTheme];
  const boardMaxWidth = useMemo(
    () => boardSizeToMaxWidth(settings.boardSize),
    [settings.boardSize],
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {t("play.casual")}
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">{t("play.aiTitle")}</h1>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SoundControls />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            title={t("play.settingsButton")}
          >
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("play.settingsButton")}</span>
          </Button>
          {phase === "playing" && (
            <Button variant="outline" size="sm" onClick={handleBackToSetup}>
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">{t("play.newGame")}</span>
            </Button>
          )}
        </div>
      </div>

      {phase === "setup" ? (
        <SetupView
          level={level}
          onLevelChange={setLevel}
          settings={settings}
          onSettingsChange={saveSettings}
          onOpenFullSettings={() => setSettingsOpen(true)}
          onStart={handleStart}
          themeTokens={themeTokens}
          boardMaxWidth={boardMaxWidth}
          orientation={resolveOrientation(settings.orientationMode, resolvedPlayerColor)}
          timeControl={timeControl}
          onTimeControlChange={setTimeControl}
        />
      ) : (
        <PlayingView
          level={level}
          settings={settings}
          resolvedPlayerColor={resolvedPlayerColor}
          rerollResolvedColor={rerollResolvedColor}
          onBackToSetup={handleBackToSetup}
          timeControl={timeControl}
        />
      )}

      <AIGameSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={handleSettingsSave}
      />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Setup phase — board preview + pre-game panel                       */
/* ------------------------------------------------------------------ */
interface SetupViewProps {
  level: number;
  onLevelChange: (n: number) => void;
  settings: AIGameSettings;
  onSettingsChange: (s: AIGameSettings) => void;
  onOpenFullSettings: () => void;
  onStart: () => void;
  themeTokens: { light: string; dark: string };
  boardMaxWidth: string;
  orientation: "white" | "black";
  timeControl: TimeControl | null;
  onTimeControlChange: (next: TimeControl | null) => void;
}

function SetupView({
  level,
  onLevelChange,
  settings,
  onSettingsChange,
  onOpenFullSettings,
  onStart,
  themeTokens,
  boardMaxWidth,
  orientation,
  timeControl,
  onTimeControlChange,
}: SetupViewProps) {
  const { t } = useTranslation();
  const showCoords = settings.coordinates !== "off";

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start lg:h-[calc(100dvh-180px)]">
      {/* Board preview — sticky on mobile, centered on desktop */}
      <div className="order-1 lg:sticky lg:top-4 min-w-0">
        <div className="relative">
          <div className="flex justify-center -mx-4 sm:mx-0">
            <div className="relative w-full" style={{ maxWidth: boardMaxWidth }}>
              <ChessBoardRC
                fen={STARTING_FEN}
                orientation={orientation}
                disabled
                allowDrag={false}
                allowClick={false}
                showCoordinates={showCoords}
                animationDurationMs={0}
                boardTheme={themeTokens}
                maxWidth={boardMaxWidth}
              />
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="glass-panel-strong rounded-2xl px-5 py-4 text-center max-w-[80%] pointer-events-auto">
                  <p className="font-display font-bold text-base sm:text-lg mb-1">
                    {t("play.previewOverlayTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("play.previewOverlayDesc")}
                  </p>
                  <Button onClick={onStart} variant="glass" size="sm" className="w-full">
                    <Play className="h-3.5 w-3.5" />
                    {t("play.startGame")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup panel */}
      <div className="order-2 lg:overflow-y-auto lg:max-h-[calc(100dvh-180px)] lg:pr-1">
        <AIPreGamePanel
          level={level}
          onLevelChange={onLevelChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onOpenFullSettings={onOpenFullSettings}
          onStart={onStart}
          timeControl={timeControl}
          onTimeControlChange={onTimeControlChange}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Playing phase — full game UI                                       */
/* ------------------------------------------------------------------ */
interface PlayingViewProps {
  level: number;
  settings: AIGameSettings;
  resolvedPlayerColor: "white" | "black";
  rerollResolvedColor: () => "white" | "black";
  onBackToSetup: () => void;
  timeControl: TimeControl | null;
}

function PlayingView({
  level,
  settings,
  resolvedPlayerColor,
  onBackToSetup,
  timeControl,
}: PlayingViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [flipped, setFlipped] = useState(false);

  const {
    game,
    moves,
    selected,
    legalTargets,
    onSquareClick,
    onPieceDrop,
    lastMove,
    thinking,
    turn,
    pendingPromotion,
    confirmPromotion,
    cancelPromotion,
    resign,
    offerDraw,
    userColor: activeUserColor,
    clocks,
  } = useChessGame({ mode: "ai", aiLevel: level, color: resolvedPlayerColor, timeControl });

  useEffect(() => {
    setFlipped(false);
  }, [game?.id, resolvedPlayerColor]);

  const baseOrientation = resolveOrientation(settings.orientationMode, resolvedPlayerColor);
  const orientation: "white" | "black" = flipped
    ? baseOrientation === "white" ? "black" : "white"
    : baseOrientation;

  const handleFlip = () => setFlipped((f) => !f);

  const [resultOpen, setResultOpen] = useState(false);
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const [arrowsMode, setArrowsMode] = useState(false);
  useEffect(() => {
    if (game && !isPlayable(game.status)) setResultOpen(true);
  }, [game?.status, game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const evalCp = moves.length
    ? Math.round(Math.sin(moves.length / 2) * 80 + (turn === "w" ? -10 : 10))
    : 0;

  const userTurnNow =
    game?.status === "active" && (turn === "w") === (activeUserColor === "white");
  const canDragColor: "w" | "b" | null = userTurnNow
    ? activeUserColor === "white" ? "w" : "b"
    : null;

  const { allowDrag, allowClick } = methodToFlags(settings.moveMethod);
  const boardMaxWidth = useMemo(
    () => boardSizeToMaxWidth(settings.boardSize),
    [settings.boardSize],
  );
  const animMs = animationToMs(settings.pieceAnimation);
  const themeTokens = BOARD_THEME_TOKENS[settings.boardTheme];
  const showCoords = settings.coordinates !== "off";
  const effectiveLegalTargets = settings.showLegalMoves ? legalTargets : [];
  const effectiveLastMove = settings.highlightLastMove ? lastMove : null;

  if (!game) {
    return <Card className="p-12 text-center text-muted-foreground">{t("play.settingUp")}</Card>;
  }

  return (
    <>
      {/* In-game action bar */}
      <div className="flex items-center justify-end gap-1.5 flex-wrap mb-3">
        <div
          className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-2"
          title={activeUserColor === "white" ? t("play.playAsWhite") : t("play.playAsBlack")}
        >
          <span
            className="h-3 w-3 rounded-full ring-1 ring-border"
            style={{ background: activeUserColor === "white" ? "#fff" : "#1a1a1a" }}
          />
          <span>{activeUserColor === "white" ? t("play.white") : t("play.black")}</span>
        </div>
        <FlipBoardButton onFlip={handleFlip} />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!isPlayable(game.status)}>
              <Handshake className="h-4 w-4" />
              <span className="hidden sm:inline">{t("play.draw")}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("play.offerDrawTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("play.offerDrawDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={offerDraw}>{t("play.offerDraw")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!isPlayable(game.status)}>
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">{t("play.resign")}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("play.resignTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("play.resignDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("play.keepPlaying")}</AlertDialogCancel>
              <AlertDialogAction onClick={resign}>{t("play.resign")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Layout — board pinned, side panels scroll */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 lg:items-start lg:h-[calc(100dvh-200px)]">
        {/* CENTER — board (sticky on mobile, height-locked on desktop) */}
        <div className="order-1 min-w-0 space-y-3 lg:sticky lg:top-2 lg:self-start">
          <GameStatusHeader game={game} turn={turn} myPhotoUrl={user?.photoUrl} />

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <CapturedPieces
                fen={game.fen}
                side={activeUserColor === "white" ? "black" : "white"}
              />
              <ClockBadge
                side={activeUserColor === "white" ? "black" : "white"}
                sideToMove={game.sideToMove ?? (new Chess(game.fen).turn() === "w" ? "white" : "black")}
                clocks={clocks}
              />
            </div>
            {thinking && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {t("play.aiThinkingShort")}
              </span>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <EvaluationBar evalCp={evalCp} orientation={orientation} />
            </div>
            <div className="flex-1 min-w-0 flex justify-center -mx-4 sm:mx-0">
              <ChessBoardRC
                fen={game.fen}
                orientation={orientation}
                selected={selected}
                legalTargets={effectiveLegalTargets}
                lastMove={effectiveLastMove}
                onSquareClick={onSquareClick}
                onPieceDrop={onPieceDrop}
                disabled={!isPlayable(game.status) || thinking || !!pendingPromotion}
                canDragColor={canDragColor}
                arrows={arrows}
                onArrowsChange={setArrows}
                arrowsMode={arrowsMode}
                maxWidth={boardMaxWidth}
                showCoordinates={showCoords}
                animationDurationMs={animMs}
                allowDrag={allowDrag}
                allowClick={allowClick}
                boardTheme={themeTokens}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <CapturedPieces fen={game.fen} side={activeUserColor} />
            <ClockBadge
              side={activeUserColor}
              sideToMove={game.sideToMove ?? (new Chess(game.fen).turn() === "w" ? "white" : "black")}
              clocks={clocks}
            />
          </div>

          {/* Arrows */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
            <Button
              variant={arrowsMode ? "default" : "outline"}
              size="sm"
              className="min-h-11 shrink-0"
              onClick={() => setArrowsMode((v) => !v)}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">
                {arrowsMode ? t("play.arrowsOn") : t("play.arrowsOff")}
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
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto px-2">
              <Bot className="h-3 w-3" />
              {t("play.aiLevelShort", { level })} · {t("play.eloShort", { elo: 800 + level * 100 })}
            </span>
          </div>

          {/* Mobile-only tabs: Hints / History */}
          <Tabs defaultValue="hints" className="lg:hidden">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="hints" className="min-h-11">{t("review.coachTitle")}</TabsTrigger>
              <TabsTrigger value="history" className="min-h-11">{t("review.moveHistory")}</TabsTrigger>
            </TabsList>
            <TabsContent value="hints" className="mt-3">
              <AiCoachPanel
                hint={
                  moves.length === 0
                    ? t("play.coachOpening")
                    : moves.length < 4
                      ? t("play.coachEarly")
                      : t("play.coachMid")
                }
              />
            </TabsContent>
            <TabsContent value="history" className="mt-3">
              <MoveHistory moves={moves} currentPly={moves.length} />
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT — coach + history (desktop only, scrollable) */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4 lg:overflow-y-auto lg:max-h-[calc(100dvh-200px)] lg:pr-1 order-2 min-w-0">
          <AiCoachPanel
            hint={
              moves.length === 0
                ? t("play.coachOpening")
                : moves.length < 4
                  ? t("play.coachEarly")
                  : t("play.coachMid")
            }
          />
          <MoveHistory moves={moves} currentPly={moves.length} />
        </div>
      </div>

      <PromotionDialog
        open={!!pendingPromotion}
        color={pendingPromotion?.color ?? "w"}
        onSelect={confirmPromotion}
        onCancel={cancelPromotion}
      />

      <GameResultModal
        game={game}
        userColor={activeUserColor}
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        onNewGame={() => {
          setResultOpen(false);
          onBackToSetup();
        }}
        onReview={() => {
          setResultOpen(false);
          navigate({ to: "/review" });
        }}
      />
    </>
  );
}
