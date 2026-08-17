/**
 * Code Cracker game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/logic-code-cracker')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { CodeCrackerScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  CodeCrackerAction,
  CodeCrackerDifficultyParams,
  CodeCrackerGameState,
  CodeCrackerPhase,
  CodeCrackerRawResult,
  CodeCrackerStats,
  GuessEntry,
  GuessFeedback,
  QaForceStatePatch,
} from './types';
export { createInitialCodeCrackerState } from './types';

export {
  ADAPTIVE_PARAMS,
  CODE_CRACKER_DIFFICULTY_PARAMS,
  codeCrackerParamsForLevel,
  codeCrackerParamsFromProfile,
  nextCodeLength,
  resolveCodeCrackerDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateCodeInput } from './generator';
export {
  MAX_CODE_ATTEMPTS,
  MIN_CODE_HAMMING_DISTANCE,
  generateSecretCode,
  computeFeedback,
  bruteForceFeedback,
  codeDistance,
  isNearDuplicate,
} from './generator';
export {
  accuracyOf,
  clamp01,
  efficiency,
  codeCrackerPerformanceNormalizer,
  normalizeCodeCrackerResult,
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
  buildCodeCrackerRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistCodeCrackerSession,
  seedToNumber,
} from './session';
export { createCodeCrackerQaForceStateHooks, createCodeCrackerTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
