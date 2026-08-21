/**
 * Order Path game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/logic-order-path')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { OrderPathScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  OrderPathAction,
  OrderPathDifficultyParams,
  OrderPathGameState,
  OrderPathPhase,
  OrderPathRawResult,
  OrderPathStats,
  QaForceStatePatch,
} from './types';
export { createInitialOrderPathState } from './types';

export {
  ADAPTIVE_PARAMS,
  ORDER_PATH_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  orderPathParamsForLevel,
  orderPathParamsFromProfile,
  resolveOrderPathDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  ITEM_POOL,
  MAX_ATTEMPTS,
  generateRound,
  validateGeneratedRound,
} from './generator';
export {
  availableNext,
  countTopologicalOrders,
  isUniquelyOrdered,
  validateRound,
} from './solver';
export {
  accuracyOf,
  clamp01,
  normalizeOrderPathResult,
  orderPathPerformanceNormalizer,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildOrderPathRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOrderPathSession,
  seedToNumber,
} from './session';
export {
  createOrderPathQaForceStateHooks,
  createOrderPathTutorialLifecycle,
} from './hooks';
export type { OrderPathQaForceStateHooks } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
