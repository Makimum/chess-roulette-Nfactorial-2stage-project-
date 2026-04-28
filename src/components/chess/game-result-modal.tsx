import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Handshake, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlayable, type Game } from "@/lib/api";

interface GameResultModalProps {
  game: Game | null;
  userColor: "white" | "black";
  open: boolean;
  onClose: () => void;
  onNewGame: () => void;
  onReview: () => void;
}

export function GameResultModal({ game, userColor, open, onClose, onNewGame, onReview }: GameResultModalProps) {
  const { t } = useTranslation();
  if (!game || isPlayable(game.status)) return null;

  const userWon =
    (game.result === "1-0" && userColor === "white") ||
    (game.result === "0-1" && userColor === "black");
  const draw = game.result === "1/2-1/2" || game.status === "draw";

  const tone = draw ? "draw" : userWon ? "win" : "loss";
  const Icon = draw ? Handshake : userWon ? Trophy : Flag;
  const title = draw ? t("result.draw") : userWon ? t("result.victory") : t("result.defeat");
  const subtitle =
    game.status === "checkmate"
      ? t("result.checkmate")
      : game.status === "resigned"
        ? userWon ? t("result.opponentResigned") : t("result.youResigned")
        : draw ? t("result.drawByAgreement") : t("result.gameEnded");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div
            className={cn(
              "h-16 w-16 rounded-full grid place-items-center mb-3",
              tone === "win" && "bg-success/15 text-success",
              tone === "loss" && "bg-destructive/15 text-destructive",
              tone === "draw" && "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-8 w-8" />
          </div>
          <DialogTitle className="text-3xl font-display">{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 my-4 text-sm">
          <Stat label={t("result.result")} value={game.result ?? "—"} />
          <Stat label={t("result.moves")} value={Math.ceil((game.pgn.match(/\s/g)?.length ?? 0) / 2).toString()} />
          <Stat
            label={t("result.rating")}
            value={
              game.ratingChange != null
                ? `${game.ratingChange > 0 ? "+" : ""}${game.ratingChange}`
                : userWon ? "+12" : draw ? "+1" : "−8"
            }
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onReview}>
            {t("result.reviewWithAi")}
          </Button>
          <Button className="w-full sm:w-auto" onClick={onNewGame}>
            {t("result.newGame")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}
