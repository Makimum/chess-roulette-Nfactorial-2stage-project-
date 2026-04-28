import { Bot, Play, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BOARD_THEME_TOKENS,
  type AIGameSettings,
  type BoardTheme,
  type MoveMethod,
  type PlayerColorPref,
} from "@/hooks/use-ai-game-settings";
import { TimeControlPicker } from "@/components/chess/time-control-picker";
import type { TimeControl } from "@/lib/api";

interface AIPreGamePanelProps {
  level: number;
  onLevelChange: (lvl: number) => void;
  settings: AIGameSettings;
  onSettingsChange: (next: AIGameSettings) => void;
  onOpenFullSettings: () => void;
  onStart: () => void;
  timeControl?: TimeControl | null;
  onTimeControlChange?: (next: TimeControl | null) => void;
  className?: string;
}

function difficultyTierKey(level: number): string {
  if (level <= 4) return "play.difficultyTier_beginner";
  if (level <= 8) return "play.difficultyTier_amateur";
  if (level <= 12) return "play.difficultyTier_club";
  if (level <= 16) return "play.difficultyTier_master";
  return "play.difficultyTier_grandmaster";
}

export function AIPreGamePanel({
  level,
  onLevelChange,
  settings,
  onSettingsChange,
  onOpenFullSettings,
  onStart,
  timeControl,
  onTimeControlChange,
  className,
}: AIPreGamePanelProps) {
  const { t } = useTranslation();
  const set = <K extends keyof AIGameSettings>(key: K, value: AIGameSettings[K]) =>
    onSettingsChange({ ...settings, [key]: value });

  const colorOptions: { value: PlayerColorPref; label: string; swatch: string }[] = [
    { value: "white", label: t("play.white"), swatch: "#fff" },
    { value: "black", label: t("play.black"), swatch: "#1a1a1a" },
    { value: "random", label: t("play.randomColor"), swatch: "" },
  ];

  const methodOptions: { value: MoveMethod; label: string }[] = [
    { value: "drag", label: t("play.settings.move_drag") },
    { value: "click", label: t("play.settings.move_click") },
    { value: "both", label: t("play.settings.move_both") },
  ];

  return (
    <Card className={`p-4 sm:p-5 space-y-5 ${className ?? ""}`}>
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> {t("play.quickSettings")}
        </p>
        <h2 className="font-display text-lg sm:text-xl font-bold">{t("play.setupTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("play.setupSubtitle")}</p>
      </div>

      {/* Difficulty */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-3 w-3" /> {t("play.aiDifficulty")}
        </Label>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold leading-none">{level}</span>
            <span className="text-xs text-muted-foreground">/ 20</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-primary font-semibold">
            {t(difficultyTierKey(level))}
          </span>
        </div>
        <Slider
          value={[level]}
          min={1}
          max={20}
          step={1}
          onValueChange={(v) => onLevelChange(v[0])}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("play.approxElo", { elo: 800 + level * 100 })}
        </p>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("play.settings.playerColor")}
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
          {colorOptions.map((opt) => {
            const active = settings.playerColor === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("playerColor", opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {opt.value === "random" ? (
                  <div className="h-5 w-5 rounded-full ring-1 ring-border bg-gradient-to-br from-white via-muted to-black" />
                ) : (
                  <div
                    className="h-5 w-5 rounded-full ring-1 ring-border"
                    style={{ background: opt.swatch }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Move method */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("play.settings.moveMethod")}
        </Label>
        <div className="inline-flex w-full rounded-xl bg-muted p-0.5 gap-0.5">
          {methodOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set("moveMethod", o.value)}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                settings.moveMethod === o.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2.5 rounded-xl border border-border/50 bg-background/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">{t("play.settings.showLegalMoves")}</Label>
          <Switch
            checked={settings.showLegalMoves}
            onCheckedChange={(c) => set("showLegalMoves", c)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm">{t("play.settings.highlightMoves")}</Label>
          <Switch
            checked={settings.highlightLastMove}
            onCheckedChange={(c) => set("highlightLastMove", c)}
          />
        </div>
      </div>

      {/* Board theme */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("play.settings.boardTheme")}
        </Label>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(BOARD_THEME_TOKENS) as BoardTheme[]).map((theme) => {
            const active = settings.boardTheme === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => set("boardTheme", theme)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition ${
                  active
                    ? "border-primary"
                    : "border-transparent hover:border-border"
                }`}
                aria-label={t(`play.settings.theme_${theme}`)}
              >
                <div className="grid grid-cols-2 grid-rows-2 w-full aspect-square rounded-md overflow-hidden ring-1 ring-border">
                  <div style={{ background: BOARD_THEME_TOKENS[theme].light }} />
                  <div style={{ background: BOARD_THEME_TOKENS[theme].dark }} />
                  <div style={{ background: BOARD_THEME_TOKENS[theme].dark }} />
                  <div style={{ background: BOARD_THEME_TOKENS[theme].light }} />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {t(`play.settings.theme_${theme}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time control */}
      {onTimeControlChange && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("play.timeControl", "Time control")}
          </Label>
          <TimeControlPicker value={timeControl ?? null} onChange={onTimeControlChange} />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <Button onClick={onStart} variant="glass" size="lg" className="w-full">
          <Play className="h-4 w-4" />
          {t("play.startGame")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFullSettings}
          className="w-full text-xs text-muted-foreground"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          {t("play.allSettings")} →
        </Button>
      </div>
    </Card>
  );
}
