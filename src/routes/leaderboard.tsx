import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Globe, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolvePhotoUrl } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/country-flag";
import {
  PINNED_COUNTRIES,
  getOtherCountriesSorted,
  getCountryName,
  isPinned,
} from "@/lib/countries";
import { toast } from "sonner";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboards — Chess Roulette" },
      { name: "description", content: "Country and global leaderboards across the Mentor community." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { t } = useTranslation();
  // null = global
  const [country, setCountry] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    getLeaderboard(country ? { countryCode: country } : undefined)
      .then(setEntries)
      .catch((e) => {
        setEntries([]);
        toast.error(e instanceof Error ? e.message : t("leaderboard.couldNotLoad"));
      });
  }, [country, t]);

  const otherCountries = useMemo(() => getOtherCountriesSorted(t), [t]);
  // If user picks a non-pinned country, surface it as an extra pill.
  const showExtraPill = !!country && !isPinned(country);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{t("leaderboard.rankings")}</p>
          <h1 className="font-display font-bold text-3xl lg:text-4xl flex items-center gap-2">
            <Trophy className="h-8 w-8 text-warning" /> {t("leaderboard.title")}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/players/search">
            <Search className="h-4 w-4" />
            {t("publicProfile.search.title")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 mb-6 sm:grid sm:grid-cols-3 sm:gap-3">
        {entries.slice(0, 3).map((e, i) => (
          <PodiumCard key={e.userId} entry={e} order={i} />
        ))}
      </div>

      {/* Country filter: pinned tabs + "other country" select */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={country === null ? "default" : "outline"}
          onClick={() => setCountry(null)}
          className="min-h-10 gap-1.5"
        >
          <Globe className="h-3.5 w-3.5" /> {t("leaderboard.globalLabel")}
        </Button>
        {PINNED_COUNTRIES.map((c) => {
          const active = country === c.code;
          return (
            <Button
              key={c.code}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => setCountry(c.code)}
              className="min-h-10 gap-1.5"
            >
              <CountryFlag code={c.code} size={12} />
              {getCountryName(c.code, t)}
            </Button>
          );
        })}

        {showExtraPill && (
          <Button
            size="sm"
            variant="default"
            onClick={() => { /* keep selected */ }}
            className="min-h-10 gap-1.5"
          >
            <CountryFlag code={country!} size={12} />
            {getCountryName(country!, t)}
          </Button>
        )}

        <Select
          value={country && !isPinned(country) ? country : ""}
          onValueChange={(v) => setCountry(v || null)}
        >
          <SelectTrigger className="h-10 w-auto min-w-[180px]">
            <SelectValue placeholder={t("leaderboard.otherCountry")} />
          </SelectTrigger>
          <SelectContent>
            {otherCountries.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="inline-flex items-center gap-2">
                  <CountryFlag code={c.code} size={12} />
                  {getCountryName(c.code, t)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-0 overflow-hidden rounded-3xl glass-gloss">
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={150}>
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-3 sm:px-4 py-3 font-medium w-12">{t("leaderboard.rank")}</th>
                  <th className="px-3 sm:px-4 py-3 font-medium">{t("leaderboard.player")}</th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-right hidden sm:table-cell">{t("leaderboard.wins")}</th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">{t("leaderboard.losses")}</th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-right hidden md:table-cell">{t("leaderboard.draws")}</th>
                  <th className="px-3 sm:px-4 py-3 font-medium text-right">{t("leaderboard.rating")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const countryName = e.countryCode ? getCountryName(e.countryCode, t) : null;
                  return (
                    <tr key={e.userId} className="border-t border-border hover:bg-accent/30">
                      <td className="px-3 sm:px-4 py-3">
                        <span
                          className={cn(
                            "font-display font-bold",
                            e.rank === 1 && "text-warning",
                            e.rank === 2 && "text-muted-foreground",
                            e.rank === 3 && "text-orange-500",
                          )}
                        >
                          {e.rank}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <Link
                          to="/profile/$userId"
                          params={{ userId: e.userId }}
                          className="flex items-center gap-2 sm:gap-3 min-w-0 hover:underline"
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            {resolvePhotoUrl(e.avatarUrl) && (
                              <AvatarImage key={resolvePhotoUrl(e.avatarUrl)!} src={resolvePhotoUrl(e.avatarUrl)!} alt={e.name} />
                            )}
                            <AvatarFallback className="text-xs bg-accent">{e.name.split(" ").map((p) => p[0]).join("")}</AvatarFallback>
                          </Avatar>
                          {countryName ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="shrink-0 rounded-sm transition-transform hover:scale-125"
                                  aria-label={countryName}
                                >
                                  <CountryFlag code={e.countryCode} size={14} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <CountryFlag code={e.countryCode} size={12} />
                                  {countryName}
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <CountryFlag code={e.countryCode} size={14} className="shrink-0 opacity-60" />
                          )}
                          <span className="font-medium truncate">{e.name}</span>
                          {e.rank <= 3 && <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{t("leaderboard.top", { rank: e.rank })}</Badge>}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono hidden sm:table-cell text-emerald-400">{e.wins}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono hidden md:table-cell text-rose-400/90">{e.losses ?? 0}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono hidden md:table-cell text-muted-foreground">{e.draws ?? 0}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono font-semibold">{e.rating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </Card>
    </AppShell>
  );
}

function PodiumCard({ entry, order }: { entry: LeaderboardEntry; order: number }) {
  const { t } = useTranslation();
  const isFirst = entry.rank === 1;
  if (isFirst) {
    return (
      <Link
        to="/profile/$userId"
        params={{ userId: entry.userId }}
        className="glass-jade rounded-3xl p-6 text-center sm:-translate-y-2 transition-transform hover:scale-[1.02]"
        style={{ order }}
      >
        <Trophy className="mx-auto mb-2 h-10 w-10 text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
        <Avatar className="mx-auto h-14 w-14 mb-2 ring-2 ring-white/30 shadow-[0_0_20px_-4px_rgba(255,255,255,0.5)]">
          {resolvePhotoUrl(entry.avatarUrl) && (
            <AvatarImage key={resolvePhotoUrl(entry.avatarUrl)!} src={resolvePhotoUrl(entry.avatarUrl)!} alt={entry.name} />
          )}
          <AvatarFallback className="bg-white/15 text-white backdrop-blur">
            {entry.name.split(" ").map((p) => p[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm truncate inline-flex items-center gap-1.5 justify-center">
          <CountryFlag code={entry.countryCode} size={12} />
          {entry.name}
        </p>
        <p className="font-display font-bold text-3xl mt-1 glow-text-emerald">{entry.rating}</p>
        <p className="text-[10px] uppercase tracking-widest opacity-80">{t("leaderboard.rankNum", { rank: entry.rank })}</p>
      </Link>
    );
  }
  return (
    <Link
      to="/profile/$userId"
      params={{ userId: entry.userId }}
      className="block transition-transform hover:scale-[1.02]"
      style={{ order }}
    >
      <Card className={cn("p-5 text-center glass-gloss rounded-3xl")}>
        <Trophy
          className={cn(
            "mx-auto mb-2 relative z-10",
            entry.rank === 2 ? "h-7 w-7 text-slate-300" : "h-7 w-7 text-orange-400",
          )}
        />
        <Avatar className="mx-auto h-12 w-12 mb-2 relative z-10">
          {resolvePhotoUrl(entry.avatarUrl) && (
            <AvatarImage key={resolvePhotoUrl(entry.avatarUrl)!} src={resolvePhotoUrl(entry.avatarUrl)!} alt={entry.name} />
          )}
          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
            {entry.name.split(" ").map((p) => p[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm truncate inline-flex items-center gap-1.5 justify-center relative z-10">
          <CountryFlag code={entry.countryCode} size={12} />
          {entry.name}
        </p>
        <p className="font-display font-bold text-2xl relative z-10">{entry.rating}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground relative z-10">{t("leaderboard.rankNum", { rank: entry.rank })}</p>
      </Card>
    </Link>
  );
}
