import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePhotoUrl } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { isCurrentPlayer, isPlayable, type Game } from "@/lib/api";
import { Bot, User, Clock } from "lucide-react";

interface GameStatusHeaderProps {
  game: Game;
  turn: "w" | "b";
  /** Authoritative photoUrl for the currently authenticated user (overrides snapshot in `game`). */
  myPhotoUrl?: string | null;
}

export function GameStatusHeader({ game, turn, myPhotoUrl }: GameStatusHeaderProps) {
  const { t } = useTranslation();
  const statusLabel =
    isPlayable(game.status)
      ? turn === "w" ? t("play.whiteToMove") : t("play.blackToMove")
      : game.status === "checkmate"
        ? `${t("play.checkmate")} · ${game.result}`
        : game.status === "stalemate"
          ? t("play.stalemate")
          : game.status === "draw"
            ? t("play.drawStatus")
            : game.status === "resigned"
              ? t("play.resigned")
              : game.status;

  const modeLabel =
    game.mode === "ai" ? t("play.vsAi") : game.mode === "friend" ? t("play.friendMatch") : t("play.ranked");

  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <PlayerChip player={game.white} active={turn === "w" && isPlayable(game.status)} side="white" myPhotoUrl={myPhotoUrl} />
      <div className="flex flex-col items-center gap-1 text-center">
        <Badge variant={isPlayable(game.status) ? "default" : "secondary"}>
          {statusLabel}
        </Badge>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {modeLabel}
        </span>
      </div>
      <PlayerChip player={game.black} active={turn === "b" && isPlayable(game.status)} side="black" myPhotoUrl={myPhotoUrl} />
    </Card>
  );
}

function PlayerChip({
  player,
  active,
  side,
  myPhotoUrl,
}: {
  player: Game["white"];
  active: boolean;
  side: "white" | "black";
  myPhotoUrl?: string | null;
}) {
  const { t } = useTranslation();
  // For the authenticated user, prefer the live photoUrl from auth context
  // (it always reflects the latest cache-busted ?v= URL after re-upload).
  const photoSource = !player.isAi
    ? (isCurrentPlayer(player) ? (myPhotoUrl ?? player.avatarUrl) : player.avatarUrl)
    : null;
  const src = resolvePhotoUrl(photoSource);
  return (
    <div className={`flex items-center gap-3 ${side === "black" ? "flex-row-reverse text-right" : ""}`}>
      <Avatar className={`h-10 w-10 ring-2 transition-all ${active ? "ring-primary shadow-glow" : "ring-transparent"}`}>
        {src && <AvatarImage key={src} src={src} alt={player.name} />}
        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
          {player.isAi ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold leading-tight">{player.name}</p>
        <p className="text-xs text-muted-foreground">{player.rating} {t("play.elo")}</p>
      </div>
    </div>
  );
}
