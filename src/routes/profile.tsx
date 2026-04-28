import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Settings, Bell, Palette, LogOut, Trophy, Crown, Languages, Mail, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProfilePhotoUploader } from "@/components/auth/profile-photo-uploader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RecentGamesTable } from "@/components/recent-games-table";
import { ProUpgradeCard } from "@/components/pro-upgrade-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelectInline } from "@/components/language-switcher";
import { getUserGames, type Game } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { ChangeEmailModal } from "@/components/auth/change-email-modal";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";

import { CountryFlag } from "@/components/country-flag";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Chess Roulette" },
      { name: "description", content: "Manage your account, preferences, and view your full game history." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [games, setGames] = useState<Game[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  useEffect(() => { getUserGames().then(setGames); }, [user?.id]);

  if (location.pathname !== "/profile") {
    return <Outlet />;
  }

  const displayName = user?.username ?? t("profile.guest");
  const initial = (displayName[0] ?? "G").toUpperCase();
  const email = user?.email ?? null;
  const rating = user?.rating ?? 1200;
  const wins = user?.wins ?? 0;
  const losses = user?.losses ?? 0;
  const draws = user?.draws ?? 0;

  const handleLogout = async () => {
    await logout();
    toast.success(t("auth.signedOut"));
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <Card className="p-6 mb-6 bg-gradient-subtle">
        <div className="flex flex-wrap items-center gap-5">
          <ProfilePhotoUploader initial={initial} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <CountryFlag code={user?.countryCode} className="text-2xl" />
              <h1 className="font-display font-bold text-2xl">{displayName}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {email ?? t("profile.anonymousGuest")}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <Stat label={t("profile.rating")} value={String(rating)} />
              <Stat label={t("profile.wins")} value={String(wins)} />
              <Stat label={t("profile.losses")} value={String(losses)} />
              <Stat label={t("profile.draws")} value={String(draws)} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="games">
        <TabsList>
          <TabsTrigger value="games"><Trophy className="h-4 w-4" /> {t("profile.games")}</TabsTrigger>
          <TabsTrigger value="account"><User className="h-4 w-4" /> {t("profile.account")}</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4" /> {t("profile.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="games" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentGamesTable games={games} />
            </div>
            <ProUpgradeCard />
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          <Card className="p-6 max-w-xl space-y-4">
            <h2 className="font-display font-semibold text-lg">{t("profile.profileDetails")}</h2>
            <Field label={t("profile.displayName")}><Input value={displayName} readOnly /></Field>
            <Field label={t("profile.email")}>
              <div className="flex gap-2">
                <Input type="email" value={email ?? ""} placeholder={t("profile.signupToAddEmail")} readOnly className="flex-1" />
                {isAuthenticated && (
                  <Button variant="outline" type="button" onClick={() => setEmailOpen(true)}>
                    <Mail className="h-4 w-4" /> {t("auth.changeEmailButton")}
                  </Button>
                )}
              </div>
            </Field>

            <div className="flex flex-wrap gap-2 pt-2">
              {isAuthenticated && (
                <Button variant="outline" type="button" onClick={() => setPwOpen(true)}>
                  <KeyRound className="h-4 w-4" /> {t("auth.changePasswordButton")}
                </Button>
              )}
              {isAuthenticated && (
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> {t("profile.signOut")}
                </Button>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="p-6 max-w-xl space-y-5">
            <h2 className="font-display font-semibold text-lg">{t("profile.preferences")}</h2>
            <ToggleRow
              icon={Palette}
              label={t("profile.appearance")}
              description={t("profile.appearanceDesc")}
              control={<ThemeToggle />}
            />
            <ToggleRow
              icon={Languages}
              label={t("profile.language")}
              description={t("profile.languageDesc")}
              control={<LanguageSelectInline />}
            />
            <ToggleRow
              icon={Bell}
              label={t("profile.notifications")}
              description={t("profile.notificationsDesc")}
              control={<Switch defaultChecked />}
            />
            <ToggleRow
              icon={Trophy}
              label={t("profile.digest")}
              description={t("profile.digestDesc")}
              control={<Switch defaultChecked />}
            />
            <ToggleRow
              icon={Crown}
              label={t("profile.coachHints")}
              description={t("profile.coachHintsDesc")}
              control={<Switch />}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <ChangeEmailModal open={emailOpen} onOpenChange={setEmailOpen} />
      <ChangePasswordModal open={pwOpen} onOpenChange={setPwOpen} />
    </AppShell>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, description, control,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="grid place-items-center h-9 w-9 rounded-lg bg-accent">
        <Icon className="h-4 w-4 text-accent-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}
