import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePhotoUrl } from "@/lib/auth";
import { MapPin, Trophy } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CityLeaderboardCard({
  city,
  entries,
}: {
  city: string;
  entries: LeaderboardEntry[];
}) {
  const { t } = useTranslation();
  const cityLabel = t(`leaderboard.cities.${city}` as const, { defaultValue: city });
  return (
    <Card className="p-0 overflow-hidden">
      <header className="flex items-center justify-between p-4 bg-gradient-subtle border-b border-border">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {t("leaderboard.city")}
          </p>
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> {cityLabel}
          </h3>
        </div>
        <Trophy className="h-8 w-8 text-warning" />
      </header>

      <ul className="divide-y divide-border">
        {entries.slice(0, 5).map((e) => (
          <li key={e.userId}>
            <Link
              to="/profile/$userId"
              params={{ userId: e.userId }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
            >
              <span
                className={cn(
                  "w-7 text-center font-display font-bold text-sm",
                  e.rank === 1 && "text-warning",
                  e.rank === 2 && "text-muted-foreground",
                  e.rank === 3 && "text-orange-500",
                )}
              >
                {e.rank}
              </span>
              <Avatar className="h-8 w-8">
                {resolvePhotoUrl(e.avatarUrl) && (
                  <AvatarImage key={resolvePhotoUrl(e.avatarUrl)!} src={resolvePhotoUrl(e.avatarUrl)!} alt={e.name} />
                )}
                <AvatarFallback className="text-xs bg-accent">
                  {e.name.split(" ").map((p) => p[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.name}</p>
                <p className="text-xs text-muted-foreground">{e.wins} {t("leaderboard.wins").toLowerCase()}</p>
              </div>
              <span className="font-mono text-sm font-semibold">{e.rating}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
