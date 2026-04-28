import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PlayerSearch } from "@/components/player-search";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/players/search")({
  head: () => ({
    meta: [
      { title: "Find player — Chess Roulette" },
      { name: "description", content: "Search for a chess player by username and view their public profile." },
    ],
  }),
  component: PlayerSearchPage,
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">404</p>
      <Button asChild className="mt-4"><Link to="/dashboard">Home</Link></Button>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AppShell>
        <p className="text-sm text-destructive">{error.message}</p>
        <Button className="mt-4" onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
      </AppShell>
    );
  },
});

function PlayerSearchPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
          {t("publicProfile.search.eyebrow")}
        </p>
        <h1 className="font-display font-bold text-3xl lg:text-4xl flex items-center gap-2">
          <Search className="h-7 w-7 text-primary" />
          {t("publicProfile.search.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t("publicProfile.search.subtitle")}
        </p>
      </div>

      <div className="max-w-2xl">
        <PlayerSearch />
      </div>
    </AppShell>
  );
}
