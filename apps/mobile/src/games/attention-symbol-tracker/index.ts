/**
 * Symbol Tracker game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/attention-symbol-tracker')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SymbolTrackerScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  SymbolTrackerAction,
  SymbolTrackerDifficultyParams,
  SymbolTrackerGameState,
  SymbolTrackerPhase,
  SymbolTrackerRawResult,
  SymbolTrackerStats,
} from './types';
export { createInitialSymbolTrackerState } from './types';

export {
  ADAPTIVE_PARAMS,
  DEFAULT_RESPOND_DEADLINE_MS,
  SYMBOL_TRACKER_DIFFICULTY_PARAMS,
  nextTrackCount,
  resolveSymbolTrackerDifficulty,
  sessionChallengeRating,
  symbolTrackerParamsForLevel,
  symbolTrackerParamsFromProfile,
} from './difficulty';
export type { GenerateRoundInput, GeneratedRound } from './generator';
export {
  EMPTY,
  MAX_ROUND_ATTEMPTS,
  generateRound,
  isNearDuplicateTracked,
} from './generator';
export {
  accuracyOf,
  clamp01,
  normalizeSymbolTrackerResult,
  perfectSessionScore,
  recallProgress,
  referenceMaxRecall,
  roundScore,
  symbolTrackerPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildSymbolTrackerRawResult,
  dbSessionPersister,
  persistSymbolTrackerSession,
  seedToNumber,
} from './session';
export {
  createSymbolTrackerQaForceStateHooks,
  createSymbolTrackerTutorialLifecycle,
} from './hooks';
export type { SymbolTrackerQaForceStateHooks } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
