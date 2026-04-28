import { FlipVertical2, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface FlipBoardButtonProps {
  onFlip: () => void;
  className?: string;
}

export function FlipBoardButton({ onFlip, className }: FlipBoardButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onFlip}
      title={t("play.flip")}
      className={className}
    >
      <FlipVertical2 className="h-4 w-4" />
      <span className="hidden sm:inline">{t("play.flip")}</span>
    </Button>
  );
}

interface BoardSizeControlProps {
  value: number;
  onChange: (value: number) => void;
  variant?: "inline" | "compact";
  className?: string;
}

/**
 * Inline slider + −/+ buttons. Use inside the board column for a chess.com-style
 * size adjuster. Persists via the parent's `useBoardSize` hook.
 */
export function BoardSizeControl({
  value,
  onChange,
  variant = "inline",
  className,
}: BoardSizeControlProps) {
  const { t } = useTranslation();
  const dec = () => onChange(Math.max(0, value - 10));
  const inc = () => onChange(Math.min(100, value + 10));
  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={dec}
          aria-label={t("play.boardSizeDecrease")}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={inc}
          aria-label={t("play.boardSizeIncrease")}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <span className="hidden sm:inline uppercase tracking-wider font-semibold">
        {t("play.boardSize")}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={dec}
        aria-label={t("play.boardSizeDecrease")}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={5}
        onValueChange={(v) => onChange(v[0])}
        className="w-28 sm:w-40"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={inc}
        aria-label={t("play.boardSizeIncrease")}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
