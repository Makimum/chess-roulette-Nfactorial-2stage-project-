import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "@/i18n";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { syncLocaleFromStorage } from "@/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-gradient">{t("notFound.title")}</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.heading")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("notFound.desc")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {t("notFound.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Chess Roulette — AI Coach, Play & Analyze" },
      {
        name: "description",
        content:
          "Play chess vs adaptive AI, review games with your personal AI coach, and climb your city leaderboard.",
      },
      {
        name: "google-fonts",
        content: "Space Grotesk, Inter",
      },
      { property: "og:title", content: "Chess Roulette — AI Coach, Play & Analyze" },
      { name: "twitter:title", content: "Chess Roulette — AI Coach, Play & Analyze" },
      { name: "description", content: "Chess Roulette is an AI-powered web app for learning and playing chess." },
      { property: "og:description", content: "Chess Roulette is an AI-powered web app for learning and playing chess." },
      { name: "twitter:description", content: "Chess Roulette is an AI-powered web app for learning and playing chess." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/db87b619-9d4d-43ff-a149-dfffc3e8f2d6/id-preview-d78099e7--df851c9b-33ee-4ab5-a826-a3cdd7d53b8d.lovable.app-1777148402136.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/db87b619-9d4d-43ff-a149-dfffc3e8f2d6/id-preview-d78099e7--df851c9b-33ee-4ab5-a826-a3cdd7d53b8d.lovable.app-1777148402136.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Apply user's stored locale only after hydration to avoid SSR mismatch.
  useEffect(() => {
    syncLocaleFromStorage();
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
