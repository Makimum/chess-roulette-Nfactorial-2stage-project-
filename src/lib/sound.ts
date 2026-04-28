/**
 * Lightweight sound manager: short SFX via HTMLAudioElement pool +
 * a procedurally-generated calm ambient pad via WebAudio (no file needed).
 *
 * SSR-safe: all audio is created lazily on first call from the browser.
 */

export type SfxKind =
  | "move"
  | "capture"
  | "castle"
  | "check"
  | "promote"
  | "game-start"
  | "game-end"
  | "illegal";

const SFX_FILES: Record<SfxKind, string> = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  castle: "/sounds/castle.mp3",
  check: "/sounds/check.mp3",
  promote: "/sounds/promote.mp3",
  "game-start": "/sounds/game-start.mp3",
  "game-end": "/sounds/game-end.mp3",
  illegal: "/sounds/illegal.mp3",
};

const POOL_SIZE = 3;
const STORAGE_KEY = "chess-sound-settings";

export interface SoundSettings {
  /** Legacy global mute (kept for backwards compatibility — true if both SFX and music are muted). */
  muted: boolean;
  sfxMuted: boolean;
  musicMuted: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
}

const DEFAULTS: SoundSettings = {
  muted: false,
  sfxMuted: false,
  musicMuted: false,
  sfxVolume: 0.6,
  musicVolume: 0.25,
};

function loadSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    const legacyMuted = !!parsed.muted;
    const sfxMuted = typeof parsed.sfxMuted === "boolean" ? parsed.sfxMuted : legacyMuted;
    const musicMuted = typeof parsed.musicMuted === "boolean" ? parsed.musicMuted : legacyMuted;
    return {
      muted: sfxMuted && musicMuted,
      sfxMuted,
      musicMuted,
      sfxVolume: typeof parsed.sfxVolume === "number" ? parsed.sfxVolume : DEFAULTS.sfxVolume,
      musicVolume:
        typeof parsed.musicVolume === "number" ? parsed.musicVolume : DEFAULTS.musicVolume,
    };
  } catch {
    return DEFAULTS;
  }
}

class SoundManager {
  private settings: SoundSettings = loadSettings();
  private listeners = new Set<() => void>();
  private pools: Partial<Record<SfxKind, HTMLAudioElement[]>> = {};
  private poolIndex: Partial<Record<SfxKind, number>> = {};

  // Ambient background music (HTMLAudioElement)
  private ambientAudio: HTMLAudioElement | null = null;
  private ambientPlaying = false;
  private ambientRequested = false;
  private ambientFadeRaf: number | null = null;
  private persistTimeout: number | null = null;
  private static readonly AMBIENT_SRC = "/sounds/background.mp3";

  getSettings(): SoundSettings {
    return this.settings;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private persist() {
    if (typeof window === "undefined") return;
    if (this.persistTimeout !== null) {
      window.clearTimeout(this.persistTimeout);
    }
    this.persistTimeout = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // ignore quota / private mode
      }
    }, 300);
  }

  private syncLegacyMuted() {
    this.settings.muted = this.settings.sfxMuted && this.settings.musicMuted;
  }

  setMuted(muted: boolean) {
    this.settings = { ...this.settings, sfxMuted: muted, musicMuted: muted, muted };
    this.persist();
    if (muted) {
      this.teardownAmbient();
    } else if (this.ambientRequested) {
      this.startAmbient();
    }
    this.emit();
  }

  toggleMute() {
    this.setMuted(!this.settings.muted);
  }

  setSfxMuted(v: boolean) {
    this.settings = { ...this.settings, sfxMuted: v };
    this.syncLegacyMuted();
    this.persist();
    this.emit();
  }

  toggleSfxMute() {
    this.setSfxMuted(!this.settings.sfxMuted);
  }

  setMusicMuted(v: boolean) {
    this.settings = { ...this.settings, musicMuted: v };
    this.syncLegacyMuted();
    this.persist();
    if (v) {
      this.teardownAmbient();
    } else if (this.ambientRequested) {
      this.startAmbient();
    }
    this.emit();
  }

  toggleMusicMute() {
    this.setMusicMuted(!this.settings.musicMuted);
  }

  setSfxVolume(v: number) {
    this.settings = { ...this.settings, sfxVolume: clamp01(v) };
    this.persist();
    this.emit();
  }

  setMusicVolume(v: number) {
    const musicVolume = clamp01(v);
    const wasSilent = this.settings.musicVolume <= 0;
    this.settings = { ...this.settings, musicVolume };
    this.persist();
    if (musicVolume <= 0) {
      this.teardownAmbient();
    } else if (wasSilent && this.ambientRequested && !this.settings.musicMuted) {
      this.startAmbient();
    } else {
      this.applyAmbientVolume();
    }
    this.emit();
  }

  private getPool(kind: SfxKind): HTMLAudioElement[] {
    if (typeof window === "undefined") return [];
    let pool = this.pools[kind];
    if (!pool) {
      pool = Array.from({ length: POOL_SIZE }, () => {
        const a = new Audio(SFX_FILES[kind]);
        a.preload = "auto";
        return a;
      });
      this.pools[kind] = pool;
      this.poolIndex[kind] = 0;
    }
    return pool;
  }

  play(kind: SfxKind) {
    if (typeof window === "undefined") return;
    if (this.settings.sfxMuted || this.settings.sfxVolume <= 0) return;
    const pool = this.getPool(kind);
    if (pool.length === 0) return;
    const idx = (this.poolIndex[kind] ?? 0) % pool.length;
    this.poolIndex[kind] = idx + 1;
    const audio = pool[idx];
    try {
      audio.currentTime = 0;
      audio.volume = this.settings.sfxVolume;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      // ignore — likely autoplay-block before first user gesture
    }
  }

  /** Start looping background music from /sounds/background.mp3. */
  startAmbient() {
    if (typeof window === "undefined") return;
    this.ambientRequested = true;
    if (this.settings.musicMuted || this.settings.musicVolume <= 0) return;
    if (this.ambientPlaying) return;
    try {
      if (!this.ambientAudio) {
        const audio = new Audio(SoundManager.AMBIENT_SRC);
        audio.loop = true;
        audio.preload = "auto";
        this.ambientAudio = audio;
      }
      const audio = this.ambientAudio;
      this.cancelAmbientFade();
      audio.volume = 0;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      this.ambientPlaying = true;
      this.fadeAmbientTo(this.settings.musicVolume, 1500);
    } catch {
      this.ambientPlaying = false;
    }
  }

  stopAmbient() {
    this.ambientRequested = false;
    this.teardownAmbient();
  }

  /** Stop ambient sound but preserve "wants to play" intent (used for mute). */
  private teardownAmbient() {
    if (!this.ambientPlaying) return;
    const audio = this.ambientAudio;
    if (!audio) {
      this.ambientPlaying = false;
      return;
    }
    this.fadeAmbientTo(0, 400, () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* noop */
      }
      this.ambientPlaying = false;
    });
  }

  private cancelAmbientFade() {
    if (this.ambientFadeRaf !== null) {
      window.cancelAnimationFrame(this.ambientFadeRaf);
      this.ambientFadeRaf = null;
    }
  }

  private fadeAmbientTo(target: number, durationMs: number, onDone?: () => void) {
    const audio = this.ambientAudio;
    if (!audio) {
      onDone?.();
      return;
    }
    this.cancelAmbientFade();
    const start = audio.volume;
    const end = clamp01(target);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / Math.max(1, durationMs));
      try {
        audio.volume = clamp01(start + (end - start) * k);
      } catch {
        /* noop */
      }
      if (k < 1) {
        this.ambientFadeRaf = window.requestAnimationFrame(step);
      } else {
        this.ambientFadeRaf = null;
        onDone?.();
      }
    };
    this.ambientFadeRaf = window.requestAnimationFrame(step);
  }

  private applyAmbientVolume() {
    if (this.settings.musicMuted || this.settings.musicVolume <= 0) {
      this.teardownAmbient();
      return;
    }
    if (!this.ambientPlaying || !this.ambientAudio) return;
    this.cancelAmbientFade();
    try {
      this.ambientAudio.volume = clamp01(this.settings.musicVolume);
    } catch {
      /* noop */
    }
  }
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const sound = new SoundManager();
