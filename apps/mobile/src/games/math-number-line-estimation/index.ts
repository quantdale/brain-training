/**
 * Number Line Estimation game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/math-number-line-estimation')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { NumberLineScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  NumberLineAction,
  NumberLineDifficultyParams,
  NumberLineGameState,
  NumberLinePhase,
  NumberLineRawResult,
  NumberLineRound,
  NumberLineStats,
  QaForceStatePatch,
  RoundOutcome,
} from './types';
export { INITIAL_STATS, createInitialNumberLineState } from './types';

export {
  ADAPTIVE_PARAMS,
  NUMBER_LINE_DIFFICULTY_PARAMS,
  nextTolerancePct,
  numberLineParamsForLevel,
  numberLineParamsFromProfile,
  numberLineParamsToRecord,
  resolveNumberLineDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { RoundValidation } from './generator';
export {
  MAX_TARGET_ATTEMPTS,
  generateRound,
  generateSessionRounds,
  targetRange,
  validateRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  closenessOf,
  isHit,
  meanClosenessOf,
  normalizeNumberLineResult,
  numberLinePerformanceNormalizer,
  perfectSessionScore,
  roundScore,
  toleranceSpan,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildNumberLineRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistNumberLineSession,
  seedToNumber,
} from './session';
export { numberLineGameReducer } from './reducer';
export { createNumberLineQaForceStateHooks, createNumberLineTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
