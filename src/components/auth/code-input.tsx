import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface CodeInputProps {
  value: string;
  onChange: (v: string) => void;
  /** Epoch ms when the resend becomes available again. */
  resendAvailableAt: number | null;
  /** Epoch ms when the current code expires. */
  expiresAt: number | null;
  onResend: () => void;
  resending?: boolean;
  expired?: boolean;
  errorMessage?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function CodeInput({
  value,
  onChange,
  resendAvailableAt,
  expiresAt,
  onResend,
  resending,
  expired,
  errorMessage,
  disabled,
  autoFocus,
}: CodeInputProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooldownLeft = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
    : 0;
  const expiredNow = expired || (expiresAt != null && now >= expiresAt);
  const canResend = !resending && cooldownLeft <= 0;

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {t("auth.codeLabel")}
      </Label>
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        containerClassName="justify-center sm:justify-start"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>

      {errorMessage && (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
      {expiredNow && !errorMessage && (
        <p className="text-xs text-warning">{t("auth.codeExpired")}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={!canResend}
          onClick={onResend}
        >
          {canResend
            ? t("auth.resendCode")
            : t("auth.resendIn", { seconds: cooldownLeft })}
        </Button>
      </div>
    </div>
  );
}
