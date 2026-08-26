/**
 * Pattern Tap Back game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-pattern-tap-back')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from './screen';
export type { PatternTapBackScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  PatternTapBackAction,
  PatternTapBackDifficultyParams,
  PatternTapBackPhase,
  PatternTapBackRawResult,
  PatternTapBackState,
  PatternTapBackStats,
  QaForceStatePatch,
} from './types';
export { createInitialState } from './types';

export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  adaptiveGridSize,
  confirmsEachTap,
  nextSequenceLength,
  paramsForLevel,
  paramsFromProfile,
  resolvePatternTapBackDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateRoundSequence,
  isNearDuplicate,
  sequenceDistance,
  tilesAreAdjacent,
} from './generator';
export {
  accuracyOf,
  avgLengthProgress,
  clamp01,
  normalizePatternTapBackResult,
  patternTapBackPerformanceNormalizer,
  perfectSessionScore,
  roundLengthProgress,
  roundScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession,
  seedToNumber,
} from './session';
export { createQaForceStateHooks, createTutorialLifecycle_ } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
