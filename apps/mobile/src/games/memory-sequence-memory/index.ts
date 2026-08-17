/**
 * Sequence Memory game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-sequence-memory')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json
 * via the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SequenceMemoryScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  SequenceMemoryAction,
  SequenceMemoryDifficultyParams,
  SequenceMemoryGameState,
  SequenceMemoryPhase,
  SequenceMemoryRawResult,
  SequenceMemoryStats,
} from './types';
export { createInitialSequenceMemoryState } from './types';

export {
  ADAPTIVE_PARAMS,
  SEQUENCE_MEMORY_DIFFICULTY_PARAMS,
  nextSequenceLength,
  resolveSequenceMemoryDifficulty,
  sequenceMemoryParamsForLevel,
  sequenceMemoryParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateSequenceInput } from './generator';
export {
  MAX_ADJACENT_ATTEMPTS,
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateSequence,
  isNearDuplicate,
  isValidSequence,
  sequenceDistance,
} from './generator';
export {
  accuracyOf,
  clamp01,
  lengthProgress,
  perfectClimbRounds,
  perfectClimbTaps,
  perfectSessionScore,
  sequenceMemoryPerformanceNormalizer,
  sequenceScore,
  normalizeSequenceMemoryResult,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSequenceMemoryRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSequenceMemorySession,
  seedToNumber,
} from './session';
export {
  createSequenceMemoryQaForceStateHooks,
  createSequenceMemoryTutorialLifecycle,
} from './hooks';
export type { SequenceMemoryQaForceStateHooks } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
