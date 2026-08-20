/**
 * Real, platform-backed audio/haptics engine (constitution §20).
 *
 * Uses `expo-audio` for short SFX playback and `expo-haptics` for vibration.
 * This module imports those native packages, so it must NOT be imported by the
 * shared SDK barrel or by unit tests directly — only the app-level
 * `AudioHapticsProvider` imports it. Everything else talks to the
 * `AudioHapticsService` interface via `liveAudioHaptics`.
 *
 * Design invariants:
 * - Every method is synchronous and fire-and-forget; audio/haptic latency can
 *   never affect gameplay timing or scoring.
 * - Disabled channels (sfx/haptics off, or globally muted) are no-ops; games
 *   remain fully playable. feedback()/playSfx()/haptic() all short-circuit.
 * - Unsupported platforms (e.g. web without vibration, or a native call that
 *   rejects) are swallowed so a missing capability never crashes gameplay.
 * - Assets are preloaded in `prepare()` and released in `release()`.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import {
  AudioHapticsService,
  AudioHapticsSettings,
  DEFAULT_AUDIO_HAPTICS_SETTINGS,
  FEEDBACK_EVENT_MAP,
  HapticType,
  SFX_ALIASES,
  SfxName,
} from './audio-haptics';

type Player = ReturnType<typeof createAudioPlayer>;

/** Map of canonical sound name → bundler-resolved asset id (a `require()` result). */
export type SfxAssetMap = Record<SfxName, number>;

export interface AudioHapticsEngineOptions {
  initialSettings?: Partial<AudioHapticsSettings>;
  /** Canonical sound-name → asset id. Only canonical names need entries. */
  sfxAssets: SfxAssetMap;
}

function resolveSfxName(name: SfxName): SfxName {
  return SFX_ALIASES[name] ?? name;
}

function impactStyleFor(type: HapticType): Haptics.ImpactFeedbackStyle | null {
  switch (type) {
    case 'light':
      return Haptics.ImpactFeedbackStyle.Light;
    case 'medium':
      return Haptics.ImpactFeedbackStyle.Medium;
    case 'heavy':
      return Haptics.ImpactFeedbackStyle.Heavy;
    default:
      return null;
  }
}

function notificationFor(type: HapticType): Haptics.NotificationFeedbackType | null {
  switch (type) {
    case 'success':
      return Haptics.NotificationFeedbackType.Success;
    case 'warning':
      return Haptics.NotificationFeedbackType.Warning;
    case 'error':
      return Haptics.NotificationFeedbackType.Error;
    default:
      return null;
  }
}

/**
 * Create the real audio/haptics engine. Throws are not expected at construction
 * (players are created lazily/preloaded in `prepare`), but callers should treat
 * the returned object as the live service and rely on `prepare()` to surface
 * platform issues.
 */
export function createAudioHaptics(options: AudioHapticsEngineOptions): AudioHapticsService {
  const settings: AudioHapticsSettings = {
    ...DEFAULT_AUDIO_HAPTICS_SETTINGS,
    ...options.initialSettings,
  };
  const players = new Map<SfxName, Player>();
  const assets = options.sfxAssets;
  let prepared = false;
  let disposed = false;

  function getPlayer(name: SfxName): Player | undefined {
    let player = players.get(name);
    if (player) {
      return player;
    }
    const source = assets[name];
    if (source === undefined) {
      return undefined;
    }
    try {
      player = createAudioPlayer(source);
      players.set(name, player);
      return player;
    } catch {
      return undefined;
    }
  }

  return {
    playSfx(name: SfxName): void {
      if (settings.sfxEnabled === false || disposed) {
        return;
      }
      const canonical = resolveSfxName(name);
      const player = getPlayer(canonical) ?? getPlayer(name);
      if (!player) {
        return;
      }
      try {
        player.seekTo(0);
        player.play();
      } catch {
        /* unsupported or not-ready source: ignore */
      }
    },

    haptic(type: HapticType): void {
      if (settings.hapticsEnabled === false || disposed) {
        return;
      }
      const impact = impactStyleFor(type);
      try {
        if (impact !== null) {
          void Haptics.impactAsync(impact);
          return;
        }
        const notification = notificationFor(type);
        if (notification !== null) {
          void Haptics.notificationAsync(notification);
        }
      } catch {
        /* platform/hardware lacks the capability: ignore */
      }
    },

    feedback(event): void {
      const mapped = FEEDBACK_EVENT_MAP[event];
      if (!mapped) {
        return;
      }
      this.playSfx(mapped.sfx);
      this.haptic(mapped.haptic);
    },

    setSfxEnabled(enabled: boolean): void {
      settings.sfxEnabled = enabled;
    },
    setMusicEnabled(enabled: boolean): void {
      settings.musicEnabled = enabled;
    },
    setHapticsEnabled(enabled: boolean): void {
      settings.hapticsEnabled = enabled;
    },
    getSettings(): Readonly<AudioHapticsSettings> {
      return { ...settings };
    },
    isGloballyMuted(): boolean {
      return !settings.sfxEnabled && !settings.musicEnabled && !settings.hapticsEnabled;
    },

    async prepare(): Promise<void> {
      if (prepared || disposed) {
        return;
      }
      prepared = true;
      try {
        // SFX should mix with other audio and play even in silent/ring mode.
        await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
      } catch {
        /* audio session configuration is best-effort */
      }
      // Preload every known asset so first playback is near-instant.
      for (const name of Object.keys(assets) as SfxName[]) {
        getPlayer(name);
      }
    },

    release(): void {
      disposed = true;
      for (const player of players.values()) {
        try {
          player.remove();
        } catch {
          /* ignore */
        }
      }
      players.clear();
    },
  };
}
