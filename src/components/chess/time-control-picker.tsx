import { Clock, Infinity as InfinityIcon, Zap, Timer, Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import type { TimeControl } from "@/lib/api";

export interface TimeControlPreset {
  id: string;
  label: string;
  value: TimeControl | null;
  category: "bullet" | "blitz" | "rapid" | "casual";
}

export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
  { id: "none", label: "—", value: null, category: "casual" },
  { id: "1+0", label: "1+0", value: { initialSeconds: 60, incrementSeconds: 0 }, category: "bullet" },
  { id: "3+0", label: "3+0", value: { initialSeconds: 180, incrementSeconds: 0 }, category: "blitz" },
  { id: "3+2", label: "3+2", value: { initialSeconds: 180, incrementSeconds: 2 }, category: "blitz" },
  { id: "5+0", label: "5+0", value: { initialSeconds: 300, incrementSeconds: 0 }, category: "blitz" },
  { id: "10+0", label: "10+0", value: { initialSeconds: 600, incrementSeconds: 0 }, category: "rapid" },
  { id: "15+10", label: "15+10", value: { initialSeconds: 900, incrementSeconds: 10 }, category: "rapid" },
];

export function presetIdForTimeControl(tc: TimeControl | null | undefined): string {
  if (!tc) return "none";
  const found = TIME_CONTROL_PRESETS.find(
    (p) =>
      p.value &&
      p.value.initialSeconds === tc.initialSeconds &&
      p.value.incrementSeconds === tc.incrementSeconds,
  );
  return found?.id ?? "5+0";
}

interface TimeControlPickerProps {
  value: TimeControl | null;
  onChange: (next: TimeControl | null) => void;
  className?: string;
  hideLabel?: boolean;
}

const CATEGORY_ICON = {
  bullet: Zap,
  blitz: Timer,
  rapid: Hourglass,
  casual: Clock,
} as const;

export function TimeControlPicker({ value, onChange, className, hideLabel }: TimeControlPickerProps) {
  const { t } = useTranslation();
  const activeId = presetIdForTimeControl(value);

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {!hideLabel && (
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> {t("timeControl.title")}
          </Label>
          <p className="text-xs text-muted-foreground/80">{t("timeControl.subtitle")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIME_CONTROL_PRESETS.map((p) => {
          const active = p.id === activeId;
          const Icon = p.id === "none" ? InfinityIcon : CATEGORY_ICON[p.category];

          const isNone = p.id === "none";
          const minutes = p.value ? Math.round(p.value.initialSeconds / 60) : 0;
          const increment = p.value?.incrementSeconds ?? 0;

          const title = isNone
            ? t("timeControl.noClock")
            : `${minutes} ${t("timeControl.minutesShort")}${increment > 0 ? ` · +${increment}s` : ""}`;

          const subtitle = isNone
            ? t("timeControl.noClockDesc")
            : t(`timeControl.presets.${p.id}` as const, { defaultValue: t(`timeControl.categories.${p.category}` as const) });

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.value)}
              aria-pressed={active}
              className={`group relative flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                {!isNone && (
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground/70"}`}>
                    {t(`timeControl.categories.${p.category}` as const)}
                  </span>
                )}
              </div>
              <div className="font-display text-sm font-semibold leading-tight tabular-nums text-foreground">
                {title}
              </div>
              <div className="text-[11px] leading-tight text-muted-foreground line-clamp-1">
                {subtitle}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
