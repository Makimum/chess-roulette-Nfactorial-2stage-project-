import { useTranslation } from "react-i18next";
import { Crown, Shuffle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Color } from "@/lib/api";

interface ColorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (color: Color) => void;
}

export function ColorPickerDialog({
  open,
  onOpenChange,
  onPick,
}: ColorPickerDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("play.chooseColorTitle")}</DialogTitle>
          <DialogDescription>{t("play.chooseColorDesc")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            onClick={() => onPick("white")}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:border-primary hover:bg-accent/50 transition"
          >
            <div className="grid place-items-center h-14 w-14 rounded-full bg-white text-neutral-900 shadow-sm ring-1 ring-border">
              <Crown className="h-7 w-7" />
            </div>
            <span className="font-display font-semibold">{t("play.white")}</span>
          </button>
          <button
            onClick={() => onPick("black")}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:border-primary hover:bg-accent/50 transition"
          >
            <div className="grid place-items-center h-14 w-14 rounded-full bg-neutral-900 text-white shadow-sm ring-1 ring-border">
              <Crown className="h-7 w-7" />
            </div>
            <span className="font-display font-semibold">{t("play.black")}</span>
          </button>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onPick(Math.random() < 0.5 ? "white" : "black")
            }
          >
            <Shuffle className="h-4 w-4" />
            {t("play.randomColor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
