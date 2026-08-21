/**
 * Quick Compare game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/speed-quick-compare')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { QuickCompareScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  ComparePromptType,
  CompareSide,
  CompareVerdict,
  QuickCompareAction,
  QuickCompareDifficultyParams,
  QuickCompareGameState,
  QuickComparePhase,
  QuickCompareRawResult,
  QuickCompareRound,
  QuickCompareStats,
  QaForceStatePatch,
} from './types';
export { INITIAL_STATS, createInitialQuickCompareState } from './types';

export {
  ADAPTIVE_PARAMS,
  PROMPT_TYPE_MASK,
  PROMPT_TYPES,
  QUICK_COMPARE_DIFFICULTY_PARAMS,
  nextWindowMs,
  quickCompareParamsForLevel,
  quickCompareParamsFromProfile,
  quickCompareParamsToRecord,
  resolveQuickCompareDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { RoundValidation } from './generator';
export {
  MAX_ROUND_ATTEMPTS,
  generateRound,
  generateSessionRounds,
  validateRound,
} from './generator';
export {
  accuracyOf,
  applyRoundOutcome,
  bestOf,
  clamp01,
  correctPoints,
  meanOf,
  meanSpeedOf,
  normalizeQuickCompareResult,
  perfectSessionScore,
  quickComparePerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildQuickCompareRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistQuickCompareSession,
  seedToNumber,
} from './session';
export { quickCompareGameReducer } from './reducer';
export { createQuickCompareQaForceStateHooks, createQuickCompareTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
