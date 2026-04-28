import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Bot, Users, Trophy, User, Brain, Crown, LogOut, Loader2, PanelLeftClose, PanelLeftOpen, GraduationCap, Search } from "lucide-react";
import { KnightLogo } from "@/components/knight-logo";
import { CountryFlag } from "@/components/country-flag";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { resolvePhotoUrl } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { t } = useTranslation();

  // Sidebar collapse state — persisted in localStorage. Init = false to avoid SSR mismatch.
  const [collapsed, setCollapsed] = useState(false);
  const expanded = !collapsed;

  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar.collapsed") === "1") setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar.collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  // Guard: only authenticated registered users can access app shell pages.
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const NAV = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/play/ai", label: t("nav.playAi"), icon: Bot },
    { to: "/play/friend", label: t("nav.playFriend"), icon: Users },
    { to: "/review", label: t("nav.review"), icon: Brain },
    { to: "/learn", label: t("nav.learn"), icon: GraduationCap },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/players/search", label: t("nav.search"), icon: Search },
    { to: "/profile", label: t("nav.profile"), icon: User },
  ] as const;

  // Mobile bottom-nav: 4 primary destinations only.
  const MOBILE_NAV = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/play/ai", label: t("nav.playAi"), icon: Bot },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/profile", label: t("nav.profile"), icon: User },
  ] as const;

  const handleLogout = async () => {
    await logout();
    toast.success(t("auth.signedOut"));
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden relative isolate">
      {/* Sidebar — floating liquid glass on lg+ (fixed so it stays in place when scrolling) */}
      <aside
        className={cn(
          "hidden lg:block fixed top-0 left-0 h-screen p-4 z-30 transition-[width] duration-300 ease-out",
          collapsed ? "w-24" : "w-64",
        )}
      >
        <div className="glass-panel-strong rounded-3xl p-3 glass-gloss flex flex-col h-full w-full">
        
          {/* Header: logo + collapse toggle */}
          <div className={cn("flex items-center mb-6 relative z-10", expanded ? "justify-between gap-2 px-1" : "justify-center")}>
            <Link
              to="/"
              className={cn("flex items-center gap-2.5 min-w-0", !expanded && "justify-center")}
              title={!expanded ? "Chess Roulette" : undefined}
            >
              <div className="grid place-items-center h-10 w-10 shrink-0 rounded-2xl bg-gradient-primary text-primary-foreground shadow-[0_0_24px_-4px_var(--glow-emerald)]">
                <KnightLogo className="text-xl" />
              </div>
              {expanded && (
                <div className="min-w-0">
                  <p className="font-display font-bold text-base leading-tight truncate">Chess Roulette</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">Liquid Arena</p>
                </div>
              )}
            </Link>
            {expanded && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="grid place-items-center h-8 w-8 shrink-0 rounded-xl text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
                aria-label={t("nav.collapseSidebar", { defaultValue: "Collapse sidebar" })}
                title="Свернуть"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Always-visible toggle when collapsed */}
          {!expanded && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mb-3 mx-auto grid place-items-center h-8 w-8 rounded-xl text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors relative z-10"
              aria-label={t("nav.expandSidebar", { defaultValue: "Expand sidebar" })}
              title="Развернуть"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          <nav className="flex flex-col gap-1.5 relative z-10">
            {NAV.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={!expanded ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-2xl text-sm font-medium transition-all relative",
                    expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                    active
                      ? "glass-button text-emerald-50"
                      : "text-foreground/75 hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 relative z-10" />
                  {expanded && <span className="relative z-10 truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto relative z-10">
            {expanded ? (
              <div className="glass-jade p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4" />
                  <p className="text-sm font-semibold">{t("nav.upgradeToPro")}</p>
                </div>
                <p className="text-xs opacity-90 mb-3">{t("nav.upgradeBlurb")}</p>
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur rounded-xl"
                >
                  <Link to="/pricing">{t("nav.seePlans")}</Link>
                </Button>
              </div>
            ) : (
              <Link
                to="/pricing"
                title={t("nav.upgradeToPro")}
                className="grid place-items-center h-11 w-11 mx-auto rounded-2xl glass-jade text-white shadow-[0_0_18px_-4px_var(--glow-emerald)]"
              >
                <Crown className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className={cn("flex-1 flex flex-col min-w-0", collapsed ? "lg:pl-24" : "lg:pl-64")}>
        {/* Floating glass header */}
        <header
          className={cn(
            "fixed top-0 right-0 left-0 z-30 pt-3 lg:pt-4 pr-3 lg:pr-6 pl-3",
            collapsed ? "lg:pl-[6.5rem]" : "lg:pl-[16.5rem]",
          )}
        >
          <div className="glass-panel-strong rounded-2xl glass-gloss h-14 flex items-center justify-between px-4">
            <div className="lg:hidden flex items-center gap-2 relative z-10">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-primary text-primary-foreground shadow-[0_0_18px_-4px_var(--glow-emerald)]">
                <KnightLogo className="text-base" />
              </div>
              <span className="font-display font-semibold">Chess Roulette</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-1.5 sm:gap-2 relative z-10">
              <LanguageSwitcher />
              <ThemeToggle />
              {user && (
                <>
                  <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex rounded-2xl gap-1.5">
                    <Link to="/profile">
                      <CountryFlag code={user.countryCode} className="text-base" />
                      <span className="max-w-[120px] truncate">{user.username}</span>
                      <Avatar className="h-7 w-7 shadow-[0_0_14px_-2px_var(--glow-emerald)]">
                        {resolvePhotoUrl(user.photoUrl) && (
                          <AvatarImage key={resolvePhotoUrl(user.photoUrl)!} src={resolvePhotoUrl(user.photoUrl)!} alt={user.username} />
                        )}
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
                          {(user.username[0] ?? "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleLogout} className="hidden sm:inline-flex">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("nav.signOut")}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 pt-20 lg:pt-24 pb-32 lg:pb-12 max-w-7xl w-full mx-auto overflow-x-hidden">
          {children}
        </main>

        {/* Floating glass bottom nav (mobile) */}
        <nav
          className="lg:hidden fixed bottom-3 inset-x-3 z-30 pb-[env(safe-area-inset-bottom)]"
          aria-label="Primary mobile navigation"
        >
          <div className="glass-panel-strong glass-gloss rounded-3xl grid grid-cols-4 px-2 py-2">
            {MOBILE_NAV.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 min-h-12 rounded-2xl text-[10px] font-semibold transition-all",
                    active ? "glass-button text-emerald-50" : "text-foreground/65 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5 relative z-10" />
                  <span className="leading-none relative z-10">{item.label.split(" ")[0]}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
