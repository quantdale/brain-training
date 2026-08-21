/**
 * Sustained Vigilance game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/attention-sustained-vigilance')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { VigilanceScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, DIGIT_MAX, DIGIT_MIN } from './types';
export type {
  QaForceStatePatch,
  TrialVerdict,
  VigilanceAction,
  VigilanceDifficultyParams,
  VigilanceGameState,
  VigilancePhase,
  VigilanceRawResult,
  VigilanceStats,
  VigilanceTrial,
} from './types';
export { INITIAL_STATS, createInitialVigilanceState, isResponseVerdict } from './types';

export {
  ADAPTIVE_PARAMS,
  VIGILANCE_DIFFICULTY_PARAMS,
  expectedTargetCount,
  isValidDigit,
  nextResponseWindowMs,
  resolveVigilanceDifficulty,
  sessionChallengeRating,
  targetLayoutFeasible,
  vigilanceParamsForLevel,
  vigilanceParamsFromProfile,
  vigilanceParamsToRecord,
} from './difficulty';
export type { StreamValidation } from './generator';
export {
  MAX_DIGIT_ATTEMPTS,
  MAX_LAYOUT_ATTEMPTS,
  fallbackTargetIndices,
  gapsRespected,
  generateStream,
  validateStream,
} from './generator';
export type { VigilanceStream } from './generator';
export {
  COMMISSION_PENALTY,
  HOLD_SCORE,
  applyScoreDelta,
  clamp01,
  goAccuracyOf,
  hitScore,
  holdAccuracyOf,
  meanOf,
  meanSpeedOf,
  normalizeVigilanceResult,
  perfectSessionScore,
  speedFactorOf,
  vigilancePerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildVigilanceRawResult,
  dbSessionPersister,
  persistVigilanceSession,
  seedToNumber,
} from './session';
export { trialSlotMs, vigilanceGameReducer } from './reducer';
export { createVigilanceQaForceStateHooks, createVigilanceTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
