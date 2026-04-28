import { Sparkles, Lightbulb, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameReviewMove, MoveClassification } from "@/lib/api";

interface AiCoachPanelProps {
  moves?: GameReviewMove[];
  loading?: boolean;
  onAnalyze?: () => void;
  onSelectPly?: (ply: number) => void;
  hint?: string;
  /** When true, list every move instead of only mistakes/blunders. */
  showAll?: boolean;
}

const CLASS_STYLES: Record<MoveClassification, { label: string; badge: string }> = {
  best: { label: "Best", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  excellent: { label: "Excellent", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  good: { label: "Good", badge: "bg-muted text-muted-foreground border-border" },
  inaccuracy: { label: "Inaccuracy", badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
  mistake: { label: "Mistake", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  blunder: { label: "Blunder", badge: "bg-destructive/15 text-destructive border-destructive/40" },
  unknown: { label: "Not analyzed", badge: "bg-muted text-muted-foreground border-border" },
};

const NEGATIVE: MoveClassification[] = ["inaccuracy", "mistake", "blunder"];

export function AiCoachPanel({
  moves,
  loading,
  onAnalyze,
  onSelectPly,
  hint,
  showAll = false,
}: AiCoachPanelProps) {
  const { t } = useTranslation();
  const items = (moves ?? []).filter((m) =>
    showAll ? m.classification !== "unknown" : NEGATIVE.includes(m.classification),
  );

  return (
    <Card className="flex flex-col h-full p-0 overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-gradient-subtle">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">{t("review.coachTitle")}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("review.coachPowered")}</p>
          </div>
        </div>
        {onAnalyze && (
          <Button size="sm" variant="outline" onClick={onAnalyze} disabled={loading}>
            {loading ? t("review.analyzing2") : t("review.analyze")}
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1 max-h-[480px]">
        <div className="p-4 space-y-3">
          {hint && (
            <div className="flex gap-3 p-3 rounded-lg bg-accent/40 border border-border/60">
              <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90">{hint}</p>
            </div>
          )}

          {!items.length && !hint && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("review.coachEmpty")}
            </p>
          )}

          {items.map((m) => {
            const style = CLASS_STYLES[m.classification];
            const moveNo = `${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "..."}`;
            return (
              <button
                key={m.moveId}
                type="button"
                onClick={() => onSelectPly?.(m.ply)}
                className="w-full text-left space-y-1.5 p-3 rounded-lg border border-border/60 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={cn("text-[10px] gap-1", style.badge)}>
                      {NEGATIVE.includes(m.classification) && <AlertTriangle className="h-3 w-3" />}
                      {style.label}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{moveNo}</span>
                    <span className="font-mono font-semibold text-sm truncate">{m.san}</span>
                  </div>
                  {m.centipawnLoss != null && m.centipawnLoss > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      −{(m.centipawnLoss / 100).toFixed(2)}
                    </span>
                  )}
                </div>
                {m.comment && (
                  <p className="text-sm text-foreground/90 leading-relaxed">{m.comment}</p>
                )}
                {m.bestMoveSan && m.bestMoveSan !== m.san && (
                  <p className="text-xs text-muted-foreground">
                    {t("review.best")}: <span className="font-mono text-foreground">{m.bestMoveSan}</span>
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
