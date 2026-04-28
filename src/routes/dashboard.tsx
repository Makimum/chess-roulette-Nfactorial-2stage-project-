import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Users, Brain, TrendingUp, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePhotoUrl } from "@/lib/auth";
import { RecentGamesTable } from "@/components/recent-games-table";
import { CountryLeaderboardCard } from "@/components/country-leaderboard-card";
import { ProUpgradeCard } from "@/components/pro-upgrade-card";
import {
  getActiveMatch,
  getUserGames,
  getLeaderboard,
  isCurrentPlayer,
  type Game,
  type LeaderboardEntry,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { CountryFlag } from "@/components/country-flag";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Chess Roulette" },
      { name: "description", content: "Your games, stats, and next training session at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const activeMatchCheckedRef = useRef(false);

  const countryCode = user?.countryCode ?? null;

  // One-active-match rule: on dashboard mount, if backend reports an active
  // match for the current user, redirect into it. Run once per session.
  useEffect(() => {
    if (!user?.id || activeMatchCheckedRef.current) return;
    activeMatchCheckedRef.current = true;
    void getActiveMatch().then((res) => {
      if (!res.hasActiveMatch) return;
      if (res.roomCode) {
        void navigate({ to: "/play/friend", search: { code: res.roomCode } });
      } else if (res.gameId) {
        // AI match — go to AI route; createGame will return the existing game.
        void navigate({ to: "/play/ai" });
      }
    });
  }, [user?.id, navigate]);

  useEffect(() => {
    getUserGames().then(setGames).catch(() => setGames([]));
  }, [user?.id]);

  useEffect(() => {
    getLeaderboard(countryCode ? { countryCode } : undefined)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, [countryCode]);

  const displayName = user?.username ?? t("profile.guest");

  const stats = useMemo(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const g of games) {
      if (!g.result) continue;
      if (g.result === "1/2-1/2") { draws++; continue; }
      const youWhite = isCurrentPlayer(g.white);
      const youWon = (youWhite && g.result === "1-0") || (!youWhite && g.result === "0-1");
      if (youWon) wins++; else losses++;
    }
    const total = wins + losses + draws;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return {
      rating: user?.rating ?? 1200,
      total: games.length,
      winRate,
      wins,
      losses,
      draws,
    };
  }, [games, user?.rating]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-primary/40 shadow-[0_0_18px_-4px_var(--glow-emerald)] shrink-0">
            {resolvePhotoUrl(user?.photoUrl) && (
              <AvatarImage
                key={resolvePhotoUrl(user?.photoUrl)!}
                src={resolvePhotoUrl(user?.photoUrl)!}
                alt={displayName}
              />
            )}
            <AvatarFallback className="bg-gradient-primary text-primary-foreground font-display text-xl">
              {(user?.username?.[0] ?? "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1 inline-flex items-center gap-1.5">
              <CountryFlag code={user?.countryCode} className="text-sm" />
              {t("dashboard.welcomeBack", { name: displayName })}
            </p>
            <h1 className="font-display font-bold text-3xl lg:text-4xl truncate">{t("dashboard.readyTitle")}</h1>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          <Button asChild variant="glass" className="min-h-12 w-full sm:w-auto px-6">
            <Link to="/play/ai"><Bot className="h-4 w-4" /> {t("dashboard.playAi")}</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 w-full sm:w-auto px-6">
            <Link to="/play/friend"><Users className="h-4 w-4" /> {t("dashboard.playFriend")}</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label={t("dashboard.elo")} value={stats.rating.toLocaleString()} icon={TrendingUp} accent />
        <StatCard label={t("dashboard.gamesPlayed")} value={String(stats.total)} icon={Brain} />
        <StatCard label={t("dashboard.winRate")} value={`${stats.winRate}%`} icon={Trophy} />
        <StatCard label={t("profile.wins")} value={`${stats.wins}/${stats.losses}/${stats.draws}`} icon={Trophy} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentGamesTable games={games} />
        </div>

        <div className="space-y-6">
          <CountryLeaderboardCard countryCode={countryCode} entries={leaderboard} />
          <ProUpgradeCard />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  if (accent) {
    return (
      <div className="glass-jade p-5">
        <div className="flex items-center justify-between relative">
          <p className="text-xs uppercase tracking-wider opacity-90 font-semibold">{label}</p>
          <Icon className="h-4 w-4 opacity-80" />
        </div>
        <p className="font-display font-bold text-3xl mt-2 glow-text-emerald relative">{value}</p>
      </div>
    );
  }
  return (
    <Card className="p-5 glass-gloss rounded-3xl">
      <div className="flex items-center justify-between relative z-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="font-display font-bold text-2xl mt-2 relative z-10">{value}</p>
    </Card>
  );
}
