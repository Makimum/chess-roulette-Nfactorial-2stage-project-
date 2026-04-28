import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import type { Move } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MoveHistoryProps {
  moves: Move[];
  currentPly?: number;
  onSelect?: (ply: number) => void;
}

const CLASS_DOT: Record<string, string> = {
  best: "bg-success",
  great: "bg-success/70",
  good: "bg-muted-foreground/40",
  inaccuracy: "bg-warning",
  mistake: "bg-orange-500",
  blunder: "bg-destructive",
};

export function MoveHistory({ moves, currentPly, onSelect }: MoveHistoryProps) {
  const { t } = useTranslation();
  const pairs: Array<{ n: number; w?: Move; b?: Move }> = [];
  moves.forEach((m, i) => {
    const n = Math.floor(i / 2) + 1;
    if (i % 2 === 0) pairs.push({ n, w: m });
    else pairs[pairs.length - 1].b = m;
  });

  return (
    <Card className="flex flex-col h-full p-0 overflow-hidden">
      <header className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {t("review.moveHistory")}
        </h3>
      </header>
      <ScrollArea className="flex-1 max-h-[420px]">
        <div className="p-2 font-mono text-sm">
          {pairs.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("review.noMoves")}
            </p>
          )}
          {pairs.map((p) => (
            <div
              key={p.n}
              className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 px-2 py-1 rounded hover:bg-accent/40"
            >
              <span className="text-muted-foreground text-xs">{p.n}.</span>
              <MoveCell move={p.w} active={currentPly === p.w?.ply} onSelect={onSelect} />
              <MoveCell move={p.b} active={currentPly === p.b?.ply} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function MoveCell({
  move,
  active,
  onSelect,
}: {
  move?: Move;
  active?: boolean;
  onSelect?: (ply: number) => void;
}) {
  if (!move) return <span />;
  return (
    <button
      onClick={() => onSelect?.(move.ply)}
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded text-left transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {move.classification && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", CLASS_DOT[move.classification])} />
      )}
      <span>{move.san}</span>
    </button>
  );
}
