/**
 * Audio/haptics service contract (constitution §20: SFX, optional
 * conservative background music, differentiated haptics, global off controls;
 * "Games remain playable muted").
 *
 * Ships with a working no-op implementation so Phase 1 games can call the
 * service end-to-end; a real implementation (expo-audio / expo-haptics)
 * replaces it later behind the same interface.
 */

/** Game-defined sound names (e.g. `'tile-flip'`, `'success'`, `'error'`). */
export type SfxName = string;

/** Differentiated haptic types; engines map these to platform patterns. */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface AudioHapticsSettings {
  sfxEnabled: boolean;
  /** Background music — off by default (conservative BGM). */
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

export const DEFAULT_AUDIO_HAPTICS_SETTINGS: Readonly<AudioHapticsSettings> = Object.freeze({
  sfxEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
});

export interface AudioHapticsService {
  /**
   * Play a named sound effect. Implementations must no-op when
   * `sfxEnabled` is false; callers may call unconditionally.
   */
  playSfx(name: SfxName): void;
  /** Trigger a haptic pattern. Implementations must no-op when `hapticsEnabled` is false. */
  haptic(type: HapticType): void;
  setSfxEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  getSettings(): Readonly<AudioHapticsSettings>;
  /** True when sfx, music, and haptics are all disabled. */
  isGloballyMuted(): boolean;
}

/**
 * Working no-op implementation: updates mute flags, plays nothing.
 * Safe to use in tests and as the Phase 1 default.
 */
export function createNoopAudioHaptics(
  initial: Partial<AudioHapticsSettings> = {},
): AudioHapticsService {
  const settings: AudioHapticsSettings = { ...DEFAULT_AUDIO_HAPTICS_SETTINGS, ...initial };
  return {
    playSfx: () => {
      /* no-op */
    },
    haptic: () => {
      /* no-op */
    },
    setSfxEnabled: (enabled) => {
      settings.sfxEnabled = enabled;
    },
    setMusicEnabled: (enabled) => {
      settings.musicEnabled = enabled;
    },
    setHapticsEnabled: (enabled) => {
      settings.hapticsEnabled = enabled;
    },
    getSettings: () => settings,
    isGloballyMuted: () =>
      !settings.sfxEnabled && !settings.musicEnabled && !settings.hapticsEnabled,
  };
}

/** Shared no-op singleton (default service until a real implementation lands). */
export const noopAudioHaptics: AudioHapticsService = createNoopAudioHaptics();
