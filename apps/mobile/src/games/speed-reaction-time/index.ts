/**
 * Reaction Time game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/speed-reaction-time')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpeedScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  RoundOutcome,
  SpeedAction,
  SpeedDifficultyParams,
  SpeedGameState,
  SpeedPhase,
  SpeedRawResult,
  SpeedStats,
} from './types';
export { createInitialSpeedState } from './types';

export {
  ADAPTIVE_PARAMS,
  SPEED_DIFFICULTY_PARAMS,
  nextDelayMinMs,
  resolveSpeedDifficulty,
  sessionChallengeRating,
  speedParamsForLevel,
  speedParamsFromProfile,
} from './difficulty';
export type { GenerateRoundDelayInput } from './generator';
export { generateRoundDelay } from './generator';
export {
  bestOf,
  clamp01,
  completionOf,
  falseStartScore,
  meanOf,
  medianOf,
  normalizeSpeedResult,
  perfectSessionScore,
  reactionScore,
  roundScore,
  speedPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildSpeedRawResult,
  dbSessionPersister,
  persistSpeedSession,
  seedToNumber,
} from './session';
export {
  createSpeedQaForceStateHooks,
  createSpeedTutorialLifecycle,
} from './hooks';
export type { SpeedQaForceStateHooks } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
