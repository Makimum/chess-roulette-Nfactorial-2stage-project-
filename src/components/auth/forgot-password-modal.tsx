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
import {
  confirmPasswordReset,
  sendPasswordResetCode,
} from "@/lib/auth";
import { CodeInput } from "./code-input";
import { mapCodeError } from "./map-code-error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIdentifier?: string;
}

type Step = "identifier" | "verify";

export function ForgotPasswordModal({ open, onOpenChange, initialIdentifier = "" }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("identifier");
      setIdentifier(initialIdentifier);
      setCode("");
      setNewPassword("");
      setConfirm("");
      setErrorMsg(null);
      setCodeError(null);
      setExpired(false);
      setResendAvailableAt(null);
      setExpiresAt(null);
    }
  }, [open, initialIdentifier]);

  async function send(initial: boolean) {
    if (!identifier.trim()) {
      setErrorMsg(t("auth.identifierRequired"));
      return;
    }
    setErrorMsg(null);
    setCodeError(null);
    setExpired(false);
    setSending(true);
    try {
      const res = await sendPasswordResetCode({ identifier });
      setResendAvailableAt(Date.now() + res.resendAfter * 1000);
      setExpiresAt(Date.now() + res.expiresIn * 1000);
      if (initial) setStep("verify");
    } catch (e) {
      const m = mapCodeError(e, t);
      setErrorMsg(m.message);
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (newPassword.length < 8) {
      setErrorMsg(t("auth.passwordTooShort"));
      return;
    }
    if (newPassword !== confirm) {
      setErrorMsg(t("auth.forgot.passwordsMismatch"));
      return;
    }
    if (code.length !== 6) {
      setCodeError(t("auth.code.invalid"));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setCodeError(null);
    try {
      await confirmPasswordReset({ identifier, code, newPassword });
      toast.success(t("auth.forgot.success"));
      onOpenChange(false);
    } catch (e) {
      const m = mapCodeError(e, t);
      if (m.expired) {
        setExpired(true);
        setCodeError(m.message);
      } else if (m.message === t("auth.code.invalid")) {
        setCode("");
        setCodeError(m.message);
      } else {
        setErrorMsg(m.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("auth.forgot.title")}</DialogTitle>
          <DialogDescription>
            {step === "identifier"
              ? t("auth.forgot.identifierStep")
              : t("auth.codeSentToYourEmail")}
          </DialogDescription>
        </DialogHeader>

        {step === "identifier" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(true);
            }}
          >
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("auth.emailOrUsername")}
              </Label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("auth.emailOrUsernamePlaceholder")}
                autoFocus
              />
            </div>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button type="submit" disabled={sending} className="w-full bg-gradient-primary text-primary-foreground">
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              {sending ? t("auth.sendingCode") : t("auth.sendCode")}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
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
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("auth.forgot.newPassword")}
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("auth.forgot.confirmNewPassword")}
              </Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                maxLength={128}
                autoComplete="new-password"
              />
            </div>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("identifier")}
                disabled={submitting}
              >
                {t("auth.back")}
              </Button>
              <Button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="flex-1 bg-gradient-primary text-primary-foreground"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? t("auth.verifying") : t("auth.forgot.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
