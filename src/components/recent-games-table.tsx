import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User, ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react";
import type { Game } from "@/lib/api";
import { isCurrentPlayer } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/auth";
import { CountryFlag } from "@/components/country-flag";
import { profileLinkFor } from "@/lib/utils";

export function RecentGamesTable({ games }: { games: Game[] }) {
  const { t } = useTranslation();
  const visibleGames = games.slice(0, 10);
  return (
    <Card className="p-0 overflow-hidden rounded-3xl glass-gloss">
      <header className="flex items-center justify-between p-4 border-b border-white/5 relative z-10">
        <h3 className="font-display font-semibold text-lg">{t("dashboard.recentGames")}</h3>
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link to="/profile">{t("dashboard.viewAll")}</Link>
        </Button>
      </header>
      {visibleGames.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t("dashboard.noGamesYet")}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="sm:hidden divide-y divide-border">
            {visibleGames.map((g) => {
              const youWhite = isCurrentPlayer(g.white);
              const opp = youWhite ? g.black : g.white;
              const youWon =
                (youWhite && g.result === "1-0") || (!youWhite && g.result === "0-1");
              const draw = g.result === "1/2-1/2";
              const delta = g.ratingChange ?? 0;
              const oppLink = profileLinkFor(opp);
              return (
                <li key={g.id} className="flex items-center gap-3 p-3 active:bg-accent/40 transition-colors">
                  {oppLink ? (
                    <Link {...oppLink} className="shrink-0">
                      <Avatar className="h-10 w-10">
                        {!opp.isAi && resolvePhotoUrl(opp.avatarUrl) && (
                          <AvatarImage key={resolvePhotoUrl(opp.avatarUrl)!} src={resolvePhotoUrl(opp.avatarUrl)!} alt={opp.name} />
                        )}
                        <AvatarFallback className="bg-accent">
                          {opp.isAi ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-accent">
                        {opp.isAi ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!opp.isAi && <CountryFlag code={opp.countryCode} className="text-sm" />}
                      {oppLink ? (
                        <Link {...oppLink} className="font-medium text-sm truncate hover:underline">{opp.name}</Link>
                      ) : (
                        <span className="font-medium text-sm truncate">{opp.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{g.mode}</Badge>
                      <Badge
                        variant={youWon ? "default" : draw ? "secondary" : "destructive"}
                        className={`text-[10px] px-1.5 py-0 ${youWon ? "bg-success text-success-foreground" : ""}`}
                      >
                        {youWon ? t("dashboard.win") : draw ? t("dashboard.draw") : t("dashboard.loss")}
                      </Badge>
                      <span
                        className={`text-[11px] font-mono inline-flex items-center gap-0.5 ${
                          delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/review"
                    search={{ gameId: String(g.id) }}
                    className="shrink-0 grid place-items-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    aria-label={t("review.title")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Tablet+: original table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("dashboard.opponent")}</th>
                  <th className="px-4 py-2 font-medium">{t("dashboard.mode")}</th>
                  <th className="px-4 py-2 font-medium">{t("dashboard.result")}</th>
                  <th className="px-4 py-2 font-medium">{t("dashboard.delta")}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleGames.map((g) => {
                  const youWhite = isCurrentPlayer(g.white);
                  const opp = youWhite ? g.black : g.white;
                  const youWon =
                    (youWhite && g.result === "1-0") || (!youWhite && g.result === "0-1");
                  const draw = g.result === "1/2-1/2";
                  const oppLink = profileLinkFor(opp);
                  return (
                    <tr key={g.id} className="border-t border-border hover:bg-accent/30">
                      <td className="px-4 py-3">
                        {oppLink ? (
                          <Link {...oppLink} className="flex items-center gap-2 hover:underline">
                            <Avatar className="h-7 w-7 shrink-0">
                              {resolvePhotoUrl(opp.avatarUrl) && (
                                <AvatarImage key={resolvePhotoUrl(opp.avatarUrl)!} src={resolvePhotoUrl(opp.avatarUrl)!} alt={opp.name} />
                              )}
                              <AvatarFallback className="bg-accent text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                              </AvatarFallback>
                            </Avatar>
                            <CountryFlag code={opp.countryCode} className="text-base" />
                            <span className="font-medium">{opp.name}</span>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="bg-accent text-muted-foreground">
                                <Bot className="h-3.5 w-3.5" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{opp.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">{g.mode}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={youWon ? "default" : draw ? "secondary" : "destructive"}
                          className={youWon ? "bg-success text-success-foreground" : ""}
                        >
                          {youWon ? t("dashboard.win") : draw ? t("dashboard.draw") : t("dashboard.loss")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span
                          className={
                            (g.ratingChange ?? 0) > 0
                              ? "text-success flex items-center gap-1"
                              : (g.ratingChange ?? 0) < 0
                                ? "text-destructive flex items-center gap-1"
                                : "text-muted-foreground flex items-center gap-1"
                          }
                        >
                          {(g.ratingChange ?? 0) > 0 ? <ArrowUpRight className="h-3 w-3" /> :
                            (g.ratingChange ?? 0) < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {g.ratingChange! > 0 ? "+" : ""}{g.ratingChange}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/review" search={{ gameId: String(g.id) }}>{t("review.title")}</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
