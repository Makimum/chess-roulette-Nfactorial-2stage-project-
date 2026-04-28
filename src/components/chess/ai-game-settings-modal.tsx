import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BoardPreview } from "@/components/chess/board-preview";
import {
  BOARD_THEME_TOKENS,
  type AIGameSettings,
  type BoardTheme,
  type Coordinates,
  type MoveMethod,
  type OrientationMode,
  type PieceAnimation,
  type PlayerColorPref,
} from "@/hooks/use-ai-game-settings";

interface AIGameSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AIGameSettings;
  onSave: (next: AIGameSettings, colorChanged: boolean) => void;
}

function shallowEq(a: AIGameSettings, b: AIGameSettings): boolean {
  return (Object.keys(a) as (keyof AIGameSettings)[]).every((k) => a[k] === b[k]);
}

export function AIGameSettingsModal({
  open,
  onOpenChange,
  settings,
  onSave,
}: AIGameSettingsModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AIGameSettings>(settings);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Re-seed draft each time modal opens.
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const dirty = !shallowEq(draft, settings);
  const colorChanged = draft.playerColor !== settings.playerColor;

  const handleSaveClick = () => {
    if (!dirty) {
      onOpenChange(false);
      return;
    }
    if (colorChanged) {
      setConfirmOpen(true);
      return;
    }
    onSave(draft, false);
    onOpenChange(false);
  };

  const handleConfirmColor = () => {
    setConfirmOpen(false);
    onSave(draft, true);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraft(settings);
    onOpenChange(false);
  };

  const set = <K extends keyof AIGameSettings>(key: K, value: AIGameSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleCancel())}>
        <DialogContent className="p-0 sm:max-w-3xl max-h-[100dvh] sm:max-h-[90dvh] flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              {t("play.settings.title")}
            </DialogTitle>
            <DialogDescription>{t("play.settings.subtitle")}</DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Preview */}
            <div className="rounded-lg bg-muted/40 p-4">
              <BoardPreview
                boardTheme={draft.boardTheme}
                coordinates={draft.coordinates}
                orientationMode={draft.orientationMode}
                playerColor={draft.playerColor}
              />
            </div>

            {/* Section: Board */}
            <Section title={t("play.settings.sectionBoard")}>
              {/* Size */}
              <Row label={t("play.settings.boardSize")}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Slider
                    value={[draft.boardSize]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => set("boardSize", v[0])}
                    className="w-full sm:w-48"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {draft.boardSize}%
                  </span>
                </div>
              </Row>

              {/* Theme */}
              <Row label={t("play.settings.boardTheme")}>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(BOARD_THEME_TOKENS) as BoardTheme[]).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => set("boardTheme", theme)}
                      className={`flex flex-col items-center gap-1 rounded-md border-2 p-1.5 transition ${
                        draft.boardTheme === theme
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                      }`}
                      aria-label={t(`play.settings.theme_${theme}`)}
                    >
                      <div className="grid grid-cols-2 grid-rows-2 w-10 h-10 rounded overflow-hidden ring-1 ring-border">
                        <div style={{ background: BOARD_THEME_TOKENS[theme].light }} />
                        <div style={{ background: BOARD_THEME_TOKENS[theme].dark }} />
                        <div style={{ background: BOARD_THEME_TOKENS[theme].dark }} />
                        <div style={{ background: BOARD_THEME_TOKENS[theme].light }} />
                      </div>
                      <span className="text-[10px] capitalize text-muted-foreground">
                        {t(`play.settings.theme_${theme}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </Row>

              {/* Piece theme — disabled */}
              <Row label={t("play.settings.pieceTheme")}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("play.settings.pieceTheme_default")}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 py-0.5 rounded bg-muted">
                    {t("play.settings.pieceThemeHint")}
                  </span>
                </div>
              </Row>

              {/* Coordinates */}
              <Row label={t("play.settings.coordinates")}>
                <Segmented<Coordinates>
                  value={draft.coordinates}
                  options={[
                    { value: "off", label: t("play.settings.coords_off") },
                    { value: "inside", label: t("play.settings.coords_inside") },
                  ]}
                  onChange={(v) => set("coordinates", v)}
                />
              </Row>

              {/* Orientation */}
              <Row label={t("play.settings.orientation")}>
                <Segmented<OrientationMode>
                  value={draft.orientationMode}
                  options={[
                    { value: "follow", label: t("play.settings.orient_follow") },
                    { value: "white", label: t("play.settings.orient_white") },
                    { value: "black", label: t("play.settings.orient_black") },
                  ]}
                  onChange={(v) => set("orientationMode", v)}
                />
              </Row>
            </Section>

            {/* Section: Gameplay */}
            <Section title={t("play.settings.sectionGameplay")}>
              <Row
                label={t("play.settings.playerColor")}
                hint={t("play.settings.playerColorHint")}
              >
                <Segmented<PlayerColorPref>
                  value={draft.playerColor}
                  options={[
                    { value: "white", label: t("play.white") },
                    { value: "black", label: t("play.black") },
                    { value: "random", label: t("play.randomColor") },
                  ]}
                  onChange={(v) => set("playerColor", v)}
                />
              </Row>

              <Row label={t("play.settings.showLegalMoves")}>
                <Switch
                  checked={draft.showLegalMoves}
                  onCheckedChange={(c) => set("showLegalMoves", c)}
                />
              </Row>

              <Row label={t("play.settings.highlightMoves")}>
                <Switch
                  checked={draft.highlightLastMove}
                  onCheckedChange={(c) => set("highlightLastMove", c)}
                />
              </Row>

              <Row label={t("play.settings.moveMethod")}>
                <Segmented<MoveMethod>
                  value={draft.moveMethod}
                  options={[
                    { value: "drag", label: t("play.settings.move_drag") },
                    { value: "click", label: t("play.settings.move_click") },
                    { value: "both", label: t("play.settings.move_both") },
                  ]}
                  onChange={(v) => set("moveMethod", v)}
                />
              </Row>

              <Row label={t("play.settings.pieceAnimation")}>
                <Segmented<PieceAnimation>
                  value={draft.pieceAnimation}
                  options={[
                    { value: "off", label: t("play.settings.anim_off") },
                    { value: "fast", label: t("play.settings.anim_fast") },
                    { value: "medium", label: t("play.settings.anim_medium") },
                    { value: "slow", label: t("play.settings.anim_slow") },
                  ]}
                  onChange={(v) => set("pieceAnimation", v)}
                />
              </Row>
            </Section>

            {/* Section: Sound */}
            <Section title={t("play.settings.sectionSound")}>
              <Row label={t("play.settings.playSounds")}>
                <Switch
                  checked={draft.playSounds}
                  onCheckedChange={(c) => set("playSounds", c)}
                />
              </Row>
            </Section>
          </div>

          {/* Footer */}
          <div className="border-t bg-background px-5 py-3 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveClick} disabled={!dirty}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("play.settings.changeColorConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("play.settings.changeColorConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmColor}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3 rounded-lg border bg-card/30 divide-y">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 first:pt-3 last:pb-3">
      <div className="flex flex-col">
        <Label className="text-sm">{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="sm:max-w-[60%]">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md bg-muted p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
            value === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
