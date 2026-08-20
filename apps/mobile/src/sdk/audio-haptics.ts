/**
 * Audio/haptics service contract (constitution §20: SFX, optional conservative
 * background music, differentiated haptics, global off controls; "Games remain
 * playable muted").
 *
 * This module is intentionally dependency-free (no `expo-audio` / `expo-haptics`
 * imports) so it can be used and unit-tested in any environment, including the
 * Node jest runner. The real, platform-backed implementation lives in
 * `audio-haptics-real.ts` and is only imported by the app-level
 * `AudioHapticsProvider`, keeping native modules out of the shared test surface.
 *
 * The previous Phase 1 build shipped a documented no-op (`noopAudioHaptics`)
 * behind this interface. This module now also defines the canonical feedback
 * event vocabulary, a mapping from the many game-defined sound names to the
 * small set of real assets, and a stable "live" service accessor so production
 * can inject the real engine instead of the no-op.
 */

/** Game-defined or canonical sound names. */
export type SfxName = string;

/** Differentiated haptic types; engines map these to platform patterns. */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Canonical feedback events. Games should prefer `feedback(event)` over
 * ad-hoc `playSfx`/`haptic` pairs; the real engine maps each event to a
 * sound asset and a haptic pattern (see `FEEDBACK_EVENT_MAP`).
 */
export type FeedbackEvent =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'success'
  | 'failure'
  | 'record'
  | 'reward';

export const FEEDBACK_EVENTS: readonly FeedbackEvent[] = [
  'tap',
  'correct',
  'wrong',
  'success',
  'failure',
  'record',
  'reward',
];

/**
 * Mapping from each canonical feedback event to the sound asset name and the
 * haptic pattern it should trigger. `playSfx` resolves asset names through
 * `SFX_ALIASES` first, so game-defined names funnel into this small set.
 */
export const FEEDBACK_EVENT_MAP: Readonly<Record<FeedbackEvent, { sfx: SfxName; haptic: HapticType }>> =
  Object.freeze({
    tap: { sfx: 'tap', haptic: 'light' },
    correct: { sfx: 'correct', haptic: 'light' },
    wrong: { sfx: 'wrong', haptic: 'warning' },
    success: { sfx: 'success', haptic: 'success' },
    failure: { sfx: 'failure', haptic: 'error' },
    record: { sfx: 'record', haptic: 'success' },
    reward: { sfx: 'reward', haptic: 'success' },
  });

/**
 * Alias table mapping the many game-specific sound names used across the
 * catalog onto the small canonical asset set. Unknown names passed to
 * `playSfx` fall through to the raw name (which simply yields no sound when
 * no asset is registered), so a missing alias degrades gracefully rather than
 * throwing. Keep this in sync with the asset set owned by the real engine.
 */
export const SFX_ALIASES: Readonly<Record<string, SfxName>> = Object.freeze({
  'tile-flip': 'tap',
  'speed-trigger': 'tap',
  'memory-tile-correct': 'correct',
  'memory-sequence-memory-tile-correct': 'correct',
  'visual-search-hit': 'correct',
  'odd-one-out-correct': 'correct',
  'logic-option-correct': 'correct',
  'language-word-match-correct': 'correct',
  'flexibility-card-correct': 'correct',
  'math-fast-math-correct': 'correct',
  'math-missing-operator-correct': 'correct',
  'spatial-answer-correct': 'correct',
  'memory-tile-wrong': 'wrong',
  'memory-sequence-memory-tile-wrong': 'wrong',
  'visual-search-miss': 'wrong',
  'odd-one-out-wrong': 'wrong',
  'logic-option-wrong': 'wrong',
  'language-word-match-wrong': 'wrong',
  'flexibility-card-wrong': 'wrong',
  'math-fast-math-wrong': 'wrong',
  'math-missing-operator-wrong': 'wrong',
  'spatial-answer-wrong': 'wrong',
  'speed-false-start': 'wrong',
});

export interface AudioHapticsSettings {
  sfxEnabled: boolean;
  /** Background music — off by default (conservative BGM, deferred). */
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

export const DEFAULT_AUDIO_HAPTICS_SETTINGS: Readonly<AudioHapticsSettings> = Object.freeze({
  sfxEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
});

/**
 * The audio/haptics service. Every method is synchronous and fire-and-forget:
 * callers (gameplay) must never await feedback, so audio/haptic latency can
 * never affect scoring or timing-sensitive mechanics.
 */
export interface AudioHapticsService {
  /**
   * Play a named sound effect. Implementations must no-op when `sfxEnabled`
   * is false; callers may call unconditionally.
   */
  playSfx(name: SfxName): void;
  /** Trigger a haptic pattern. Implementations must no-op when `hapticsEnabled` is false. */
  haptic(type: HapticType): void;
  /** Dispatch a canonical feedback event (sound + haptic together). */
  feedback(event: FeedbackEvent): void;
  setSfxEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  getSettings(): Readonly<AudioHapticsSettings>;
  /** True when sfx, music, and haptics are all disabled. */
  isGloballyMuted(): boolean;
  /** Prepare/preload assets. Safe to call multiple times. */
  prepare(): Promise<void>;
  /** Release native resources. */
  release(): void;
}

/**
 * Working no-op implementation: updates mute flags, plays nothing. Safe to use
 * in tests, as the default live service before production injection, and as a
 * graceful fallback when the platform is unsupported.
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
    feedback: () => {
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
    prepare: async () => {
      /* no-op */
    },
    release: () => {
      /* no-op */
    },
  };
}

/** Shared no-op singleton (default live service until production injects a real one). */
export const noopAudioHaptics: AudioHapticsService = createNoopAudioHaptics();

/**
 * Live service registry. Production's `AudioHapticsProvider` replaces this with
 * the real engine on mount; game code should reference `liveAudioHaptics` (a
 * stable delegating object) rather than the initial no-op so the swap is
 * transparent. Tests may inject their own service via `setLiveAudioHaptics`.
 */
let liveService: AudioHapticsService = noopAudioHaptics;

/** Returns the currently injected live audio/haptics service. */
export function getAudioHaptics(): AudioHapticsService {
  return liveService;
}

/** Replace the live service (used by production injection and tests). */
export function setLiveAudioHaptics(service: AudioHapticsService): void {
  liveService = service;
}

/**
 * Stable delegating service. Every method forwards to whatever is currently the
 * live service, so importing `liveAudioHaptics` once and calling it from game
 * code keeps working across the no-op → real engine swap.
 */
export const liveAudioHaptics: AudioHapticsService = {
  playSfx: (name) => getAudioHaptics().playSfx(name),
  haptic: (type) => getAudioHaptics().haptic(type),
  feedback: (event) => getAudioHaptics().feedback(event),
  setSfxEnabled: (enabled) => getAudioHaptics().setSfxEnabled(enabled),
  setMusicEnabled: (enabled) => getAudioHaptics().setMusicEnabled(enabled),
  setHapticsEnabled: (enabled) => getAudioHaptics().setHapticsEnabled(enabled),
  getSettings: () => getAudioHaptics().getSettings(),
  isGloballyMuted: () => getAudioHaptics().isGloballyMuted(),
  prepare: () => getAudioHaptics().prepare(),
  release: () => getAudioHaptics().release(),
};
