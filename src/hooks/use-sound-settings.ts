import { useSyncExternalStore } from "react";
import { sound } from "@/lib/sound";

const serverSnapshot = {
  muted: false,
  sfxMuted: false,
  musicMuted: false,
  sfxVolume: 0.6,
  musicVolume: 0.25,
};

export function useSoundSettings() {
  const settings = useSyncExternalStore(
    sound.subscribe,
    () => sound.getSettings(),
    () => serverSnapshot,
  );

  return {
    ...settings,
    toggleMute: () => sound.toggleMute(),
    setMuted: (v: boolean) => sound.setMuted(v),
    toggleSfxMute: () => sound.toggleSfxMute(),
    setSfxMuted: (v: boolean) => sound.setSfxMuted(v),
    toggleMusicMute: () => sound.toggleMusicMute(),
    setMusicMuted: (v: boolean) => sound.setMusicMuted(v),
    setSfxVolume: (v: number) => sound.setSfxVolume(v),
    setMusicVolume: (v: number) => sound.setMusicVolume(v),
  };
}
