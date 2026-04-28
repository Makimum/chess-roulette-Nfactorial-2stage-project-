import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { confirmEmailChange, sendEmailChangeCode } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { CodeInput } from "./code-input";
import { mapCodeError } from "./map-code-error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "verify";

export function ChangeEmailModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [codeError, setCodeError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setNewEmail("");
      setCurrentPassword("");
      setCode("");
      setErrorMsg(null);
      setFieldErr({});
      setCodeError(null);
      setExpired(false);
      setResendAvailableAt(null);
      setExpiresAt(null);
    }
  }, [open]);

  async function send(initial: boolean) {
    setErrorMsg(null);
    setFieldErr({});
    setCodeError(null);
    setExpired(false);
    setSending(true);
    try {
      const res = await sendEmailChangeCode({ newEmail, currentPassword });
      setResendAvailableAt(Date.now() + res.resendAfter * 1000);
      setExpiresAt(Date.now() + res.expiresIn * 1000);
      if (initial) setStep("verify");
    } catch (e) {
      const m = mapCodeError(e, t);
      setErrorMsg(m.message);
      setFieldErr(m.fieldErrors);
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (code.length !== 6) {
      setCodeError(t("auth.code.invalid"));
      return;
    }
    setSubmitting(true);
    setCodeError(null);
    try {
      await confirmEmailChange({ newEmail, code });
      await refreshUser();
      toast.success(t("auth.changeEmail.success"));
      onOpenChange(false);
    } catch (e) {
      const m = mapCodeError(e, t);
      if (m.expired) {
        setExpired(true);
        setCodeError(m.message);
      } else {
        setCode("");
        setCodeError(m.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("auth.changeEmail.title")}</DialogTitle>
          {step === "verify" && (
            <DialogDescription>
              {t("auth.changeEmail.sent", { email: newEmail })}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "form" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(true); }}>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("auth.changeEmail.newEmail")}
              </Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                maxLength={254}
                aria-invalid={!!fieldErr.newEmail}
              />
              {fieldErr.newEmail && <p className="text-xs text-destructive">{fieldErr.newEmail}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("auth.changeEmail.currentPassword")}
              </Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                maxLength={128}
                autoComplete="current-password"
                aria-invalid={!!fieldErr.currentPassword}
              />
              {fieldErr.currentPassword && <p className="text-xs text-destructive">{fieldErr.currentPassword}</p>}
            </div>
            {errorMsg && !Object.keys(fieldErr).length && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
            <Button type="submit" disabled={sending} className="w-full bg-gradient-primary text-primary-foreground">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {sending ? t("auth.sendingCode") : t("auth.sendCode")}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <CodeInput
              value={code}
              onChange={setCode}
              resendAvailableAt={resendAvailableAt}
              expiresAt={expiresAt}
              onResend={() => void send(false)}
              resending={sending}
              expired={expired}
              errorMessage={codeError}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={submitting}>
                {t("auth.back")}
              </Button>
              <Button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="flex-1 bg-gradient-primary text-primary-foreground"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("auth.verifying") : t("auth.changeEmail.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
