/**
 * Memory game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { MemoryScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  MemoryAction,
  MemoryDifficultyParams,
  MemoryGameState,
  MemoryPhase,
  MemoryRawResult,
  MemoryStats,
  QaForceStatePatch,
} from './types';
export { createInitialMemoryState } from './types';

export {
  ADAPTIVE_PARAMS,
  MEMORY_DIFFICULTY_PARAMS,
  memoryParamsForLevel,
  memoryParamsFromProfile,
  nextSequenceLength,
  resolveMemoryDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateRoundSequence,
  isNearDuplicate,
  sequenceDistance,
} from './generator';
export {
  accuracyOf,
  clamp01,
  lengthProgress,
  memoryPerformanceNormalizer,
  normalizeMemoryResult,
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
  buildMemoryRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMemorySession,
  seedToNumber,
} from './session';
export { createMemoryQaForceStateHooks, createMemoryTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
