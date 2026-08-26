/**
 * Target Count game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/attention-target-count')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { TargetCountScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  TargetCountAction,
  TargetCountDifficultyParams,
  TargetCountGameState,
  TargetCountPhase,
  TargetCountRawResult,
  TargetCountRound,
  TargetCountStats,
  QaForceStatePatch,
} from './types';
export { createInitialTargetCountState, INITIAL_STATS } from './types';

export {
  ADAPTIVE_PARAMS,
  ESCALATION_EVERY,
  MAX_ESCALATION_STEPS,
  TARGET_COUNT_DIFFICULTY_PARAMS,
  escalatedDistractorClasses,
  targetCountParamsForLevel,
  targetCountParamsFromProfile,
  resolveTargetCountDifficulty,
  sessionChallengeRating,
} from './difficulty';
export {
  MAX_ATTEMPTS,
  SYMBOLS,
  SYMBOL_NAMES,
  generateRound,
  buildCountOptions,
  countTargets,
  validateGeneratedRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  efficiency,
  targetCountPerformanceNormalizer,
  normalizeTargetCountResult,
  perfectSessionScore,
  roundScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildTargetCountRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistTargetCountSession,
  seedToNumber,
} from './session';
export { createTargetCountQaForceStateHooks, createTargetCountTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
