import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Trophy,
  User as UserIcon,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { resolvePhotoUrl } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { getPublicProfile, type PublicProfile, type PublicProfileRecentGame } from "@/lib/api";
import { profileLinkFor } from "@/lib/utils";

export const Route = createFileRoute("/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Player profile — Chess Roulette" },
      { name: "description", content: "Public chess player profile, stats and recent games." },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const { t } = useTranslation();

  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = !!user?.id && user.id === userId;

  // If looking at own profile — redirect to /profile (settings & history).
  useEffect(() => {
    if (isOwnProfile) {
      navigate({ to: "/profile", replace: true });
    }
  }, [isOwnProfile, navigate]);

  useEffect(() => {
    if (isOwnProfile) return; // avoid wasted fetch right before redirect
    const ac = new AbortController();
    setLoading(true);
    setNotFound(false);
    setError(null);
    // eslint-disable-next-line no-console
    console.debug("[profile] fetching", userId);
    getPublicProfile(userId, 10)
      .then((p) => {
        if (ac.signal.aborted) return;
        // eslint-disable-next-line no-console
        console.debug("[profile] result", userId, p ? "ok" : "not-found");
        if (!p) setNotFound(true);
        else setData(p);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        // eslint-disable-next-line no-console
        console.error("[profile] failed", userId, e);
        setError(e instanceof Error ? e.message : "Failed to load profile");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => {
      ac.abort();
    };
  }, [userId, isOwnProfile]);

  return (
    <AppShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {t("publicProfile.back")}
        </Button>
      </div>

      {loading && (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && notFound && (
        <Card className="p-10 text-center">
          <h1 className="font-display font-bold text-2xl mb-2">{t("publicProfile.notFoundTitle")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("publicProfile.notFoundDesc")}</p>
          <Button asChild>
            <Link to="/players/search">{t("publicProfile.search.tryAgain")}</Link>
          </Button>
        </Card>
      )}

      {!loading && error && !notFound && (
        <Card className="p-10 text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button onClick={() => router.invalidate()}>{t("publicProfile.retry")}</Button>
        </Card>
      )}

      {!loading && data && <ProfileContent data={data} />}
    </AppShell>
  );
}

function ProfileContent({ data }: { data: PublicProfile }) {
  const { t } = useTranslation();
  const { user, stats, recentGames } = data;
  const photo = resolvePhotoUrl(user.photoUrl);
  const initial = (user.username[0] ?? "?").toUpperCase();

  return (
    <>
      {/* Hero card — matches /profile visual */}
      <Card className="p-6 mb-6 bg-gradient-subtle">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="h-20 w-20 shadow-[0_0_24px_-4px_var(--glow-emerald)]">
            {photo && <AvatarImage key={photo} src={photo} alt={user.username} />}
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl font-display font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <CountryFlag code={user.countryCode} className="text-2xl" />
              <h1 className="font-display font-bold text-2xl truncate">{user.username}</h1>
              {stats.leaderboardRank != null && (
                <Badge variant="outline" className="gap-1">
                  <Trophy className="h-3 w-3" /> #{stats.leaderboardRank}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Stat label={t("publicProfile.rating")} value={String(stats.rating)} />
              <Stat label={t("publicProfile.wins")} value={String(stats.wins)} />
              <Stat label={t("publicProfile.losses")} value={String(stats.losses)} />
              <Stat label={t("publicProfile.draws")} value={String(stats.draws)} />
              <Stat label={t("publicProfile.winRate")} value={`${stats.winRate.toFixed(1)}%`} />
            </div>
          </div>
        </div>
      </Card>

      {/* Games + side stats — same layout as /profile games tab */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PublicRecentGamesTable games={recentGames} />
        </div>
        <ModeBreakdownCard stats={stats} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className="font-display font-bold text-lg">{value}</p>
    </div>
  );
}

function ModeBreakdownCard({ stats }: { stats: PublicProfile["stats"] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card className="p-5 rounded-3xl">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5" /> {t("publicProfile.currentStreak")}
        </p>
        <StreakDisplay streak={stats.currentStreak} />
      </Card>

      <Card className="p-5 rounded-3xl">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          {t("publicProfile.byMode")}
        </p>
        <div className="space-y-2">
          <ModeRow label={t("publicProfile.modeAi")} stats={stats.resultsByMode.ai} />
          <ModeRow label={t("publicProfile.modeFriend")} stats={stats.resultsByMode.friend} />
          <ModeRow label={t("publicProfile.modeLocal")} stats={stats.resultsByMode.local} />
        </div>
      </Card>

      <Card className="p-5 rounded-3xl">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
          {t("publicProfile.asWhite")} / {t("publicProfile.asBlack")}
        </p>
        <div className="space-y-3">
          <SideBar label={t("publicProfile.asWhite")} value={stats.gamesAsWhite} total={stats.totalGames} />
          <SideBar label={t("publicProfile.asBlack")} value={stats.gamesAsBlack} total={stats.totalGames} />
        </div>
      </Card>
    </div>
  );
}

function StreakDisplay({ streak }: { streak: PublicProfile["stats"]["currentStreak"] }) {
  const { t } = useTranslation();
  if (!streak || streak.type === "none" || streak.count === 0) {
    return <p className="text-sm text-muted-foreground">{t("publicProfile.noStreak")}</p>;
  }
  const key =
    streak.type === "win" ? "publicProfile.streakWin" :
    streak.type === "loss" ? "publicProfile.streakLoss" :
    "publicProfile.streakDraw";
  const color =
    streak.type === "win" ? "text-success" :
    streak.type === "loss" ? "text-destructive" :
    "text-muted-foreground";
  return (
    <p className={`font-display font-bold text-2xl ${color}`}>
      {t(key, { count: streak.count })}
    </p>
  );
}

function ModeRow({ label, stats }: { label: string; stats: PublicProfile["stats"]["resultsByMode"]["ai"] }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">
        <span className="text-success">{stats.wins}</span>
        {" / "}
        <span className="text-destructive">{stats.losses}</span>
        {" / "}
        <span className="text-muted-foreground">{stats.draws}</span>
      </span>
    </div>
  );
}

function SideBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value} ({pct}%)</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Mirrors RecentGamesTable styling but reads `resultForUser` from public profile shape. */
function PublicRecentGamesTable({ games }: { games: PublicProfileRecentGame[] }) {
  const { t } = useTranslation();
  return (
    <Card className="p-0 overflow-hidden rounded-3xl glass-gloss">
      <header className="flex items-center justify-between p-4 border-b border-white/5 relative z-10">
        <h3 className="font-display font-semibold text-lg">{t("publicProfile.recentGamesTitle")}</h3>
      </header>
      {games.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t("publicProfile.recentGamesEmpty")}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="sm:hidden divide-y divide-border">
            {games.map((g) => (
              <PublicGameRowMobile key={g.gameId} game={g} />
            ))}
          </ul>

          {/* Tablet+: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("dashboard.opponent")}</th>
                  <th className="px-4 py-2 font-medium">{t("dashboard.mode")}</th>
                  <th className="px-4 py-2 font-medium">{t("dashboard.result")}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <PublicGameRowDesktop key={g.gameId} game={g} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function resultMeta(resultForUser: string) {
  if (resultForUser === "win") return { variant: "default" as const, key: "publicProfile.resultWin", icon: <ArrowUpRight className="h-3 w-3" />, success: true };
  if (resultForUser === "loss") return { variant: "destructive" as const, key: "publicProfile.resultLoss", icon: <ArrowDownRight className="h-3 w-3" />, success: false };
  if (resultForUser === "draw") return { variant: "secondary" as const, key: "publicProfile.resultDraw", icon: <Minus className="h-3 w-3" />, success: false };
  if (resultForUser === "active") return { variant: "outline" as const, key: "publicProfile.resultActive", icon: <Minus className="h-3 w-3" />, success: false };
  return { variant: "outline" as const, key: "publicProfile.resultActive", icon: <Minus className="h-3 w-3" />, success: false };
}

function PublicGameRowMobile({ game }: { game: PublicProfileRecentGame }) {
  const { t } = useTranslation();
  const opp = game.opponent;
  const oppPhoto = resolvePhotoUrl(opp.photoUrl);
  const oppLink = profileLinkFor(opp);
  const meta = resultMeta(game.resultForUser);

  return (
    <li className="flex items-center gap-3 p-3">
      {oppLink ? (
        <Link {...oppLink} className="shrink-0">
          <Avatar className="h-10 w-10">
            {!opp.isAi && oppPhoto && <AvatarImage key={oppPhoto} src={oppPhoto} alt={opp.username} />}
            <AvatarFallback className="bg-accent">
              {opp.isAi ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Link>
      ) : (
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-accent">
            {opp.isAi ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {oppLink ? (
            <Link {...oppLink} className="font-medium text-sm truncate hover:underline">{opp.username}</Link>
          ) : (
            <span className="font-medium text-sm truncate">{opp.username}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{game.mode}</Badge>
          <Badge
            variant={meta.variant}
            className={`text-[10px] px-1.5 py-0 gap-0.5 ${meta.success ? "bg-success text-success-foreground" : ""}`}
          >
            {meta.icon}
            {t(meta.key)}
          </Badge>
        </div>
      </div>
      {game.resultForUser !== "active" && (
        <Link
          to="/review"
          search={{ gameId: String(game.gameId) }}
          className="shrink-0 grid place-items-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
          aria-label={t("review.title")}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </li>
  );
}

function PublicGameRowDesktop({ game }: { game: PublicProfileRecentGame }) {
  const { t } = useTranslation();
  const opp = game.opponent;
  const oppPhoto = resolvePhotoUrl(opp.photoUrl);
  const oppLink = profileLinkFor(opp);
  const meta = resultMeta(game.resultForUser);

  return (
    <tr className="border-t border-border hover:bg-accent/30">
      <td className="px-4 py-3">
        {oppLink ? (
          <Link {...oppLink} className="flex items-center gap-2 hover:underline">
            <Avatar className="h-7 w-7 shrink-0">
              {oppPhoto && <AvatarImage key={oppPhoto} src={oppPhoto} alt={opp.username} />}
              <AvatarFallback className="bg-accent text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{opp.username}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-accent text-muted-foreground">
                {opp.isAi ? <Bot className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{opp.username}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="capitalize">{game.mode}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={meta.variant}
          className={meta.success ? "bg-success text-success-foreground" : ""}
        >
          {t(meta.key)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {game.resultForUser !== "active" && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/review" search={{ gameId: String(game.gameId) }}>{t("review.title")}</Link>
          </Button>
        )}
      </td>
    </tr>
  );
}
