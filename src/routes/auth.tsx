import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { KnightLogo } from "@/components/knight-logo";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthError } from "@/lib/auth";
import { CodeInput } from "@/components/auth/code-input";
import { mapCodeError } from "@/components/auth/map-code-error";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";



export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Chess Roulette" },
      { name: "description", content: "Sign in or create an account to play and track your progress." },
    ],
  }),
  component: AuthPage,
});

type SignupStep = "form" | "verify";

function AuthPage() {
  const navigate = useNavigate();
  const { login, sendSignupCode, confirmSignup } = useAuth();
  const { t } = useTranslation();

  function mapAuthError(e: unknown, mode: "login" | "signup"): string {
    if (e instanceof AuthError) {
      if (e.status === 0) return t("auth.backendUnavailable");
      if (e.status === 409) return t("auth.emailExists");
      if (e.status === 401) return t("auth.invalidCreds");
      if (e.status === 422 || /password/i.test(e.message)) {
        return mode === "signup" ? t("auth.passwordTooShort") : t("auth.invalidCreds");
      }
      return e.message;
    }
    return t("auth.somethingWrong");
  }

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  

  // Signup state
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupErr, setSignupErr] = useState<string | null>(null);
  const [signupCodeErr, setSignupCodeErr] = useState<string | null>(null);
  const [signupExpired, setSignupExpired] = useState(false);
  const [signupResendAt, setSignupResendAt] = useState<number | null>(null);
  const [signupExpiresAt, setSignupExpiresAt] = useState<number | null>(null);
  const [signupFieldErr, setSignupFieldErr] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});
  const [signupSending, setSignupSending] = useState(false);
  const [signupVerifying, setSignupVerifying] = useState(false);

  const signupSchema = z.object({
    username: z
      .string()
      .trim()
      .min(2, { message: t("auth.usernameTooShort") })
      .max(16, { message: t("auth.usernameTooLong") }),
    email: z
      .string()
      .trim()
      .min(3, { message: t("auth.emailTooShort") })
      .max(254, { message: t("auth.emailTooLong") })
      .email({ message: t("auth.emailInvalid") }),
    password: z
      .string()
      .min(8, { message: t("auth.passwordTooShort") })
      .max(128, { message: t("auth.passwordTooLong") }),
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    if (!loginIdentifier.trim()) {
      setLoginErr(t("auth.identifierRequired"));
      return;
    }
    setLoginLoading(true);
    try {
      const u = await login({ identifier: loginIdentifier.trim(), password: loginPassword });
      toast.success(t("auth.welcomeBack", { name: u.username }));
      navigate({ to: "/dashboard" });
    } catch (err) {
      setLoginErr(mapAuthError(err, "login"));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErr(null);
    setSignupFieldErr({});

    const parsed = signupSchema.safeParse({
      username: signupUsername,
      email: signupEmail,
      password: signupPassword,
    });
    if (!parsed.success) {
      const fieldErrors: typeof signupFieldErr = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof signupFieldErr;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setSignupFieldErr(fieldErrors);
      return;
    }

    setSignupSending(true);
    try {
      const res = await sendSignupCode({
        email: parsed.data.email,
        username: parsed.data.username,
      });
      setSignupResendAt(Date.now() + res.resendAfter * 1000);
      setSignupExpiresAt(Date.now() + res.expiresIn * 1000);
      setSignupExpired(false);
      setSignupCode("");
      setSignupCodeErr(null);
      setSignupStep("verify");
    } catch (err) {
      const m = mapCodeError(err, t);
      if (m.fieldErrors.email) {
        setSignupFieldErr({ email: m.fieldErrors.email });
      } else if (m.fieldErrors.username) {
        setSignupFieldErr({ username: m.fieldErrors.username });
      } else {
        setSignupErr(m.message);
      }
    } finally {
      setSignupSending(false);
    }
  };

  const handleResendSignupCode = async () => {
    setSignupSending(true);
    try {
      const res = await sendSignupCode({
        email: signupEmail.trim(),
        username: signupUsername.trim(),
      });
      setSignupResendAt(Date.now() + res.resendAfter * 1000);
      setSignupExpiresAt(Date.now() + res.expiresIn * 1000);
      setSignupExpired(false);
      setSignupCodeErr(null);
    } catch (err) {
      const m = mapCodeError(err, t);
      setSignupCodeErr(m.message);
    } finally {
      setSignupSending(false);
    }
  };

  const handleConfirmSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupCode.length !== 6) {
      setSignupCodeErr(t("auth.code.invalid"));
      return;
    }
    setSignupVerifying(true);
    setSignupCodeErr(null);
    setSignupErr(null);
    try {
      const u = await confirmSignup({
        email: signupEmail.trim(),
        username: signupUsername.trim(),
        password: signupPassword,
        code: signupCode,
      });
      toast.success(t("auth.welcomeBack", { name: u.username }));
      navigate({ to: "/dashboard" });
    } catch (err) {
      const m = mapCodeError(err, t);
      if (m.expired) {
        setSignupExpired(true);
        setSignupCodeErr(m.message);
      } else if (m.fieldErrors.email || m.fieldErrors.username) {
        // Conflict with email/username - go back to form
        setSignupFieldErr(m.fieldErrors);
        setSignupStep("form");
      } else if (m.message === t("auth.code.invalid")) {
        setSignupCode("");
        setSignupCodeErr(m.message);
      } else {
        setSignupErr(m.message);
      }
    } finally {
      setSignupVerifying(false);
    }
  };

  // Reset signup verify state when switching tabs / closing
  useEffect(() => {
    if (signupStep === "form") {
      setSignupCode("");
      setSignupCodeErr(null);
    }
  }, [signupStep]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
        <Link to="/" className="flex items-center gap-2 relative">
          <div className="grid place-items-center h-10 w-10 rounded-lg bg-white/15 backdrop-blur">
            <KnightLogo className="text-xl" />
          </div>
          <div>
            <p className="font-display font-bold">Chess Roulette</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-3">{t("auth.todaysLesson")}</p>
          <blockquote className="font-display text-3xl font-semibold leading-snug">
            {t("auth.quote")}
          </blockquote>
          <p className="mt-3 text-sm opacity-80">— Bobby Fischer</p>
        </div>

        <div />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="lg:hidden flex items-center gap-2">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-primary text-primary-foreground">
                <KnightLogo className="text-xl" />
              </div>
              <span className="font-display font-bold">Chess Roulette</span>
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>

          <h1 className="font-display font-bold text-3xl mb-2">{t("auth.welcome")}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t("auth.subtitle")}
          </p>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">{t("auth.signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.createAccount")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="p-6 mt-4">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <Field label={t("auth.emailOrUsername")} icon={Mail}>
                    <Input
                      type="text"
                      required
                      placeholder={t("auth.emailOrUsernamePlaceholder")}
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </Field>
                  <Field label={t("auth.password")} icon={Lock}>
                    <Input
                      type="password"
                      required
                      placeholder={t("auth.passwordPlaceholder")}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                  {loginErr && (
                    <p className="text-sm text-destructive">{loginErr}</p>
                  )}
                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-gradient-primary text-primary-foreground"
                  >
                    {loginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loginLoading ? t("auth.signingIn") : t("auth.signIn")}
                  </Button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setForgotOpen(true)}
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="p-6 mt-4">
                {signupStep === "form" ? (
                  <form className="space-y-4" onSubmit={handleSendSignupCode} noValidate>
                    <Field label={t("auth.displayName")} icon={UserIcon} error={signupFieldErr.username}>
                      <Input
                        placeholder={t("auth.namePlaceholder")}
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        maxLength={16}
                        autoComplete="username"
                        aria-invalid={!!signupFieldErr.username}
                      />
                    </Field>
                    <Field label={t("auth.email")} icon={Mail} error={signupFieldErr.email}>
                      <Input
                        type="email"
                        placeholder={t("auth.emailPlaceholder")}
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        maxLength={254}
                        autoComplete="email"
                        aria-invalid={!!signupFieldErr.email}
                      />
                    </Field>
                    <Field label={t("auth.password")} icon={Lock} error={signupFieldErr.password}>
                      <Input
                        type="password"
                        placeholder={t("auth.passwordSignupPlaceholder")}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        maxLength={128}
                        autoComplete="new-password"
                        aria-invalid={!!signupFieldErr.password}
                      />
                    </Field>
                    {signupErr && (
                      <p className="text-sm text-destructive">{signupErr}</p>
                    )}
                    <Button
                      type="submit"
                      disabled={signupSending}
                      className="w-full bg-gradient-primary text-primary-foreground"
                    >
                      {signupSending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {signupSending ? t("auth.sendingCode") : t("auth.sendCode")}
                    </Button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleConfirmSignup}>
                    <p className="text-sm text-muted-foreground">
                      {t("auth.codeSentTo", { email: signupEmail })}
                    </p>
                    <CodeInput
                      value={signupCode}
                      onChange={setSignupCode}
                      resendAvailableAt={signupResendAt}
                      expiresAt={signupExpiresAt}
                      onResend={handleResendSignupCode}
                      resending={signupSending}
                      expired={signupExpired}
                      errorMessage={signupCodeErr}
                      autoFocus
                    />
                    {signupErr && (
                      <p className="text-sm text-destructive">{signupErr}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSignupStep("form")}
                        disabled={signupVerifying}
                      >
                        {t("auth.back")}
                      </Button>
                      <Button
                        type="submit"
                        disabled={signupVerifying || signupCode.length !== 6}
                        className="flex-1 bg-gradient-primary text-primary-foreground"
                      >
                        {signupVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                        {signupVerifying ? t("auth.verifying") : t("auth.verifyAndCreate")}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        initialIdentifier={loginIdentifier}
      />
      
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  error,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <div className="[&_input]:pl-9">{children}</div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
