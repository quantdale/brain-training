/**
 * Order Sweep game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/speed-order-sweep')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { OrderSweepScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  OrderSweepAction,
  OrderSweepDifficultyParams,
  OrderSweepGameState,
  OrderSweepPhase,
  OrderSweepRawResult,
  OrderSweepRound,
  OrderSweepStats,
  QaForceStatePatch,
  RoundOutcome,
  SweepVerdict,
  Token,
} from './types';
export { INITIAL_STATS, createInitialOrderSweepState } from './types';

export {
  ADAPTIVE_PARAMS,
  ORDER_SWEEP_DIFFICULTY_PARAMS,
  nextWindowMs,
  orderSweepParamsForLevel,
  orderSweepParamsFromProfile,
  resolveOrderSweepDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  MAX_PLACEMENT_ATTEMPTS,
  VALIDATION_EPSILON,
  generateRound,
  rowsFor,
  validateRound,
} from './generator';
export {
  clearRatioOf,
  clamp01,
  correctPoints,
  meanOf,
  meanSpeedOf,
  bestOf,
  normalizeOrderSweepResult,
  paceMs,
  perfectRoundBonus,
  perfectSessionScore,
  speedFactor,
  orderSweepPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildOrderSweepRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOrderSweepSession,
  seedToNumber,
} from './session';
export { createOrderSweepQaForceStateHooks, createOrderSweepTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
