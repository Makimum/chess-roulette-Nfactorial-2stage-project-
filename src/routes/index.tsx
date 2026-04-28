import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Brain,
  Trophy,
  Users,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { KnightLogo } from "@/components/knight-logo";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChessBoard } from "@/components/chess/chess-board";
import { Chess } from "chess.js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chess Roulette — Learn faster with an AI coach" },
      {
        name: "description",
        content:
          "Play chess vs adaptive AI opponents, review every game with your personal AI coach, and rise on city leaderboards.",
      },
      { property: "og:title", content: "Chess Roulette" },
      {
        property: "og:description",
        content: "AI-powered chess training that meets you at your level.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const chess = new Chess();
  ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"].forEach((m) => chess.move(m));

  const FEATURES = [
    { icon: Bot, title: t("landing.features.ai.title"), desc: t("landing.features.ai.desc") },
    { icon: Brain, title: t("landing.features.coach.title"), desc: t("landing.features.coach.desc") },
    { icon: Users, title: t("landing.features.friend.title"), desc: t("landing.features.friend.desc") },
    { icon: Trophy, title: t("landing.features.city.title"), desc: t("landing.features.city.desc") },
  ];

  const STEPS = [
    { n: "01", t: t("landing.steps.one.t"), d: t("landing.steps.one.d") },
    { n: "02", t: t("landing.steps.two.t"), d: t("landing.steps.two.d") },
    { n: "03", t: t("landing.steps.three.t"), d: t("landing.steps.three.d") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground">
              <KnightLogo className="text-xl" />
            </div>
            <div>
              <p className="font-display font-bold leading-tight">Chess Roulette</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#how" className="hover:text-foreground transition-colors">{t("nav.howItWorks")}</a>
            <Link to="/pricing" className="hover:text-foreground transition-colors">{t("nav.pricing")}</Link>
            <Link to="/leaderboard" className="hover:text-foreground transition-colors">{t("nav.leaderboard")}</Link>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground">
              <Link to="/dashboard">{t("nav.openApp")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.08] dark:opacity-20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <Badge variant="outline" className="mb-5 gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>{t("landing.badge")}</span>
            </Badge>
            <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient">{t("landing.heroTitle2")}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Link to="/auth">
                  {t("landing.startFree")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">{t("nav.signIn")}</Link>
              </Button>
            </div>
          
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary opacity-30 blur-3xl rounded-full" />
            <div className="relative">
              <ChessBoard fen={chess.fen()} disabled lastMove={{ from: "f6" as never, to: "f6" as never }} />
              <Card className="absolute -bottom-6 -left-6 max-w-xs p-4 shadow-elegant hidden md:block">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("landing.coach")}</p>
                    <p className="text-sm mt-0.5">{t("landing.coachHint")}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28 border-t border-border bg-gradient-subtle">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">{t("landing.whyTitle")}</p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight">
              {t("landing.whyHeading")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6 hover:shadow-elegant transition-shadow">
                <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20 lg:py-28">
        <div className="max-w-5xl mx-auto px-4 lg:px-8">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3 text-center">{t("landing.howKicker")}</p>
          <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight text-center mb-14">
            {t("landing.howHeading")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <Card key={s.n} className="p-6 relative overflow-hidden">
                <span className="absolute -top-4 -right-2 font-display font-bold text-7xl text-primary/10">{s.n}</span>
                <h3 className="font-display font-semibold text-xl mb-2 relative">{s.t}</h3>
                <p className="text-sm text-muted-foreground relative leading-relaxed">{s.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 lg:px-8">
          <Card className="p-10 lg:p-14 bg-gradient-hero text-primary-foreground border-0 shadow-elegant text-center relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary-glow/40 blur-3xl" />
            <KnightLogo className="text-5xl mx-auto mb-4 relative block" />
            <h2 className="font-display font-bold text-3xl lg:text-5xl tracking-tight relative">
              {t("landing.ctaHeading")}
            </h2>
            <p className="mt-4 text-lg opacity-90 relative max-w-xl mx-auto">
              {t("landing.ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 relative">
              <Button asChild size="lg" variant="secondary">
                <Link to="/dashboard">{t("landing.openArena")} <ChevronRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground">
                <Link to="/pricing">{t("landing.comparePlans")}</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Chess Roulette. {t("landing.footer")}
      </footer>
    </div>
  );
}
