import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Square } from "chess.js";
import { ChessBoard } from "@/components/chess/chess-board";
import { LearningStepper } from "./learning-stepper";
import type { LearningLesson } from "./learning-data";
import { LEARNING_START_FEN } from "./learning-data";

interface LearningBoardPanelProps {
  lesson: LearningLesson | null;
  stepIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}

function parseUciMove(uci: string | undefined): { from: Square; to: Square } | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  return { from, to };
}

export function LearningBoardPanel({
  lesson,
  stepIndex,
  onPrev,
  onNext,
  onReset,
}: LearningBoardPanelProps) {
  const { t } = useTranslation();

  const step = lesson?.steps[stepIndex] ?? null;
  const fen = step?.fen ?? LEARNING_START_FEN;
  const lastMove = useMemo(() => parseUciMove(step?.move), [step?.move]);

  // Дополнительные подсветки из урока — мапим как «легальные цели» (точки/кольца),
  // чтобы переиспользовать имеющуюся механику доски без её модификации.
  const legalTargets = useMemo<Square[]>(() => {
    if (!step?.highlights) return [];
    return step.highlights.map((h) => h.square as Square);
  }, [step?.highlights]);

  if (!lesson || !step) {
    return (
      <div className="glass-panel-strong glass-gloss rounded-3xl p-6 lg:p-8 min-h-[60vh] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="grid place-items-center h-16 w-16 rounded-2xl bg-white/5 text-3xl" aria-hidden>
            ♟
          </div>
          <div className="max-w-sm">
            <h2 className="font-display text-lg font-semibold mb-1">
              {t("learn.empty.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("learn.empty.desc")}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalSteps = lesson.steps.length;
  const showStepper = totalSteps > 1;

  return (
    <div className="glass-panel-strong glass-gloss rounded-3xl p-4 sm:p-6 lg:p-7 space-y-4">
      <header className="space-y-1">
        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
          <h2 className="font-display text-xl font-bold">{lesson.titleRu}</h2>
          {lesson.titleEn && (
            <span className="text-sm text-muted-foreground">{lesson.titleEn}</span>
          )}
        </div>
        {lesson.subtitle && (
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {lesson.subtitle}
          </p>
        )}
      </header>

      <ChessBoard
        fen={fen}
        legalTargets={legalTargets}
        lastMove={lastMove}
        disabled
      />

      <div className="rounded-2xl bg-background/40 border border-border/50 p-4 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{step.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
      </div>

      {showStepper && (
        <LearningStepper
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          onPrev={onPrev}
          onNext={onNext}
          onReset={onReset}
        />
      )}
    </div>
  );
}
