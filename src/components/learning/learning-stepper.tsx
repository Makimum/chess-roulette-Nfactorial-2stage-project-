import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface LearningStepperProps {
  stepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}

export function LearningStepper({
  stepIndex,
  totalSteps,
  onPrev,
  onNext,
  onReset,
}: LearningStepperProps) {
  const { t } = useTranslation();
  const atStart = stepIndex <= 0;
  const atEnd = stepIndex >= totalSteps - 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={atStart}
        className="rounded-xl gap-1.5"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("learn.controls.prev")}
      </Button>
      <Button
        size="sm"
        onClick={onNext}
        disabled={atEnd}
        className="rounded-xl gap-1.5"
      >
        {t("learn.controls.next")}
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={atStart}
        className="rounded-xl gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t("learn.controls.reset")}
      </Button>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {t("learn.stepProgress", { current: stepIndex + 1, total: totalSteps })}
      </span>
    </div>
  );
}
