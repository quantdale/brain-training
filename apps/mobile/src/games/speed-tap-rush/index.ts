/**
 * Tap Rush game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/speed-tap-rush')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { TapRushScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  TapRushAction,
  TapRushDifficultyParams,
  TapRushGameState,
  TapRushPhase,
  TapRushRawResult,
  TapRushStats,
  TargetPosition,
  TargetVerdict,
} from './types';
export { INITIAL_STATS, createInitialTapRushState } from './types';

export {
  ADAPTIVE_PARAMS,
  TAP_RUSH_DIFFICULTY_PARAMS,
  nextWindowMs,
  resolveTapRushDifficulty,
  sessionChallengeRating,
  tapRushParamsForLevel,
  tapRushParamsFromProfile,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  MAX_POSITION_ATTEMPTS,
  MIN_SEPARATION_MULTIPLIER,
  PLACEMENT_EPSILON,
  distanceSq,
  generateRoundTargets,
  isInsideField,
  minSeparation,
  validateTargetPlacement,
} from './generator';
export type { PlacementValidation } from './generator';
export {
  accuracyOf,
  bestOf,
  clamp01,
  hitPoints,
  meanOf,
  meanSpeedOf,
  normalizeTapRushResult,
  perfectRoundBonus,
  perfectSessionScore,
  speedFactor,
  tapRushPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildTapRushRawResult,
  dbSessionPersister,
  persistTapRushSession,
  seedToNumber,
} from './session';
export { createTapRushQaForceStateHooks, createTapRushTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
