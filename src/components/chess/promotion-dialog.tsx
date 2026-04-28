import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PromotionDialogProps {
  open: boolean;
  color: "w" | "b";
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const GLYPH: Record<string, string> = {
  wq: "♕", wr: "♖", wb: "♗", wn: "♘",
  bq: "♛", br: "♜", bb: "♝", bn: "♞",
};

export function PromotionDialog({ open, color, onSelect, onCancel }: PromotionDialogProps) {
  const { t } = useTranslation();
  const PIECES: Array<{ key: "q" | "r" | "b" | "n"; label: string }> = [
    { key: "q", label: t("promotion.queen") },
    { key: "r", label: t("promotion.rook") },
    { key: "b", label: t("promotion.bishop") },
    { key: "n", label: t("promotion.knight") },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("promotion.title")}</DialogTitle>
          <DialogDescription>{t("promotion.desc")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {PIECES.map((p) => (
            <button
              key={p.key}
              onClick={() => onSelect(p.key)}
              className={cn(
                "aspect-square rounded-lg border border-border bg-card hover:bg-accent transition-all",
                "flex flex-col items-center justify-center gap-1 hover:scale-105 hover:shadow-md",
              )}
            >
              <span
                className={cn("text-4xl leading-none", color === "w" ? "text-white" : "text-neutral-900")}
                style={{ textShadow: color === "w" ? "0 1px 2px rgba(0,0,0,.5)" : "0 1px 2px rgba(255,255,255,.3)" }}
              >
                {GLYPH[`${color}${p.key}`]}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
