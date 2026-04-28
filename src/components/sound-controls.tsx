import { Volume2, VolumeX, Music, Music2, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSoundSettings } from "@/hooks/use-sound-settings";
import { cn } from "@/lib/utils";

interface SoundControlsProps {
  className?: string;
}

export function SoundControls({ className }: SoundControlsProps) {
  const { t } = useTranslation();
  const {
    muted,
    sfxMuted,
    musicMuted,
    sfxVolume,
    musicVolume,
    toggleMute,
    toggleSfxMute,
    toggleMusicMute,
    setSfxMuted,
    setMusicMuted,
    setSfxVolume,
    setMusicVolume,
  } = useSoundSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={muted ? t("sound.triggerMuted") : t("sound.triggerOpen")}
          className={cn("h-10 w-10 min-w-10", className)}
          onDoubleClick={() => toggleMute()}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        {/* SFX section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sfx-mute" className="text-sm font-medium flex items-center gap-2">
              <Swords className="h-4 w-4 text-muted-foreground" />
              {t("sound.sfxLabel")}
            </Label>
            <Switch
              id="sfx-mute"
              checked={!sfxMuted}
              onCheckedChange={(v) => setSfxMuted(!v)}
              aria-label={t("sound.sfxToggleAria")}
            />
          </div>
          <div className="flex items-center gap-3 pl-6">
            <Slider
              value={[sfxVolume * 100]}
              min={0}
              max={100}
              step={5}
              disabled={sfxMuted}
              onValueChange={(v) => setSfxVolume((v[0] ?? 0) / 100)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {Math.round(sfxVolume * 100)}%
            </span>
          </div>
        </div>

        <Separator />

        {/* Music section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="music-mute" className="text-sm font-medium flex items-center gap-2">
              {musicMuted ? (
                <Music2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Music className="h-4 w-4 text-muted-foreground" />
              )}
              {t("sound.musicLabel")}
            </Label>
            <Switch
              id="music-mute"
              checked={!musicMuted}
              onCheckedChange={(v) => setMusicMuted(!v)}
              aria-label={t("sound.musicToggleAria")}
            />
          </div>
          <div className="flex items-center gap-3 pl-6">
            <Slider
              value={[musicVolume * 100]}
              min={0}
              max={100}
              step={5}
              disabled={musicMuted}
              onValueChange={(v) => setMusicVolume((v[0] ?? 0) / 100)}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {Math.round(musicVolume * 100)}%
            </span>
          </div>
        </div>

        <Separator />

        <button
          type="button"
          onClick={toggleMute}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          {muted ? t("sound.unmuteAll") : t("sound.muteAll")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
