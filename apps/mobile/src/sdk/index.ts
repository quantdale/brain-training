/**
 * Shared Game SDK — public surface (Phase 1 skeleton).
 *
 * Every game integrates through this barrel; import from `@/sdk`.
 * Version metadata: `SDK_VERSION` / `RNG_ALGORITHM_VERSION` (`version.ts`).
 */

// Version metadata
export { SDK_VERSION, RNG_ALGORITHM_VERSION } from './version';

// Core services
export { createRng, normalizeSeed, canonicalSeedToNumber } from './rng';
export type { Rng } from './rng';
export { canonicalClamp01 } from './numeric';
export { systemClock, createFakeClock, createMonotonicClock, Stopwatch } from './timing';
export type { Clock, FakeClock } from './timing';
export { SessionLifecycle, IllegalTransitionError } from './lifecycle';
export type { SessionStatus, SessionLifecycleOptions } from './lifecycle';
export { createPauseOverlaySpec } from './pause';
export type { PauseOverlaySpec } from './pause';
export { testId } from './testid';
export {
  createNoopAudioHaptics,
  noopAudioHaptics,
  liveAudioHaptics,
  getAudioHaptics,
  setLiveAudioHaptics,
  DEFAULT_AUDIO_HAPTICS_SETTINGS,
  FEEDBACK_EVENTS,
  FEEDBACK_EVENT_MAP,
  SFX_ALIASES,
} from './audio-haptics';
export type {
  AudioHapticsService,
  AudioHapticsSettings,
  HapticType,
  SfxName,
  FeedbackEvent,
} from './audio-haptics';
export {
  createTutorialLifecycle,
  createInMemoryTutorialStore,
  createWriteThroughTutorialStore,
} from './tutorial';
export type {
  TutorialLifecycle,
  TutorialState,
  TutorialStore,
  TutorialPersist,
  WriteThroughTutorialStore,
  WriteThroughTutorialStoreOptions,
} from './tutorial';

// Contracts (types/…)
export {
  GAME_CATEGORIES,
  isGameCategory,
  defineGame,
  parseGameDefinitionJson,
  CURRENT_SDK_VERSION,
} from './types/game-definition';
export type { GameCategory, GameDefinition, GameScreenProps } from './types/game-definition';
export {
  DIFFICULTY_LEVELS,
  isDifficultyLevel,
  DEFAULT_CHALLENGE_RATINGS,
  ADAPTIVE_BASELINE,
  DIFFICULTY_LABELS,
  clampChallengeRating,
  resolveDifficulty,
} from './types/difficulty';
export type { DifficultyLevel, DifficultyProfile, DifficultyMapping } from './types/difficulty';
export { noopXpRatingHook } from './types/results';
export type {
  GameRawResult,
  PerformanceScale,
  NormalizedPerformance,
  NormalizeContext,
  PerformanceNormalizer,
  RatingDelta,
  XpRatingContext,
  XpRatingHook,
} from './types/results';
export { createDiagnosticMetadata } from './types/diagnostics';
export type { DiagnosticMetadata, GeneratorInfo } from './types/diagnostics';
export { isDevBuild, assertDevOnly, createNoopQaForceStateHooks } from './types/qa';
export type { QaForceStateHooks } from './types/qa';
// Performance instrumentation (campaign 010, debt D4) — dev-only, no-op in
// production builds. Also importable directly via '@/sdk/perf'.
export {
  PERF_SCHEMA_VERSION,
  PERF_RING_CAPACITY,
  markPerfEvent,
  startPerfMeasure,
  markGameSessionStart,
  markGameFirstInteraction,
  trackSessionPersist,
  trackProgressSnapshotLoad,
  getRecentPerfRecords,
} from './perf';
export type {
  PerfEventName,
  PerfDetail,
  PerfRecord,
  PerfMeasure,
  PerfEventContext,
} from './perf';

// 075: reducer exhaustiveness — the compile-time assertion plus the honest
// runtime fallback, expressed once so 42 reducers do not each reinvent it.
export { assertExhaustive } from './exhaustive';
// 074: the runtime module-surface contract the host depends on. The
// GameDefinition (game.json) contract is validated at import; this guards the
// module the generated loader actually renders, which no type check can see.
export {
  assertGameModuleSurface,
  inspectGameModuleSurface,
  GameModuleSurfaceError,
  GAME_MODULE_SURFACE_ERROR,
  REQUIRED_MODULE_MEMBERS,
  type GameModuleSurface,
  type ValidatedScreenProps,
} from './module-surface';
