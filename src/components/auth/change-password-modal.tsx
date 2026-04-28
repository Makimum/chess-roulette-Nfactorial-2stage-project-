import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { changePassword } from "@/lib/auth";
import { mapCodeError } from "./map-code-error";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrorMsg(null);
      setFieldErr({});
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErr({});
    if (next.length < 8) {
      setFieldErr({ newPassword: t("auth.passwordTooShort") });
      return;
    }
    if (next !== confirm) {
      setFieldErr({ confirm: t("auth.forgot.passwordsMismatch") });
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.success(t("auth.changePassword.success"));
      onOpenChange(false);
    } catch (err) {
      const m = mapCodeError(err, t);
      if (m.fieldErrors.currentPassword) {
        setFieldErr({ currentPassword: t("auth.changePassword.wrongPassword") });
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
          <DialogTitle>{t("auth.changePassword.title")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.changePassword.current")}
            </Label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              maxLength={128}
              autoComplete="current-password"
              aria-invalid={!!fieldErr.currentPassword}
            />
            {fieldErr.currentPassword && <p className="text-xs text-destructive">{fieldErr.currentPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.changePassword.new")}
            </Label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              aria-invalid={!!fieldErr.newPassword}
            />
            {fieldErr.newPassword && <p className="text-xs text-destructive">{fieldErr.newPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("auth.changePassword.confirm")}
            </Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              aria-invalid={!!fieldErr.confirm}
            />
            {fieldErr.confirm && <p className="text-xs text-destructive">{fieldErr.confirm}</p>}
          </div>
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary text-primary-foreground">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? t("auth.verifying") : t("auth.changePassword.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
