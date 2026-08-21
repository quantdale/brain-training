/**
 * Value Order game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/math-value-ordering')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { ValueOrderingScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  RoundOutcome,
  ValueOrderingAction,
  ValueOrderingDifficultyParams,
  ValueOrderingGameState,
  ValueOrderingPhase,
  ValueOrderingRawResult,
  ValueOrderingRound,
  ValueOrderingStats,
  ValueTile,
} from './types';
export { INITIAL_STATS, createInitialValueOrderingState } from './types';

export {
  ADAPTIVE_PARAMS,
  VALUE_ORDERING_DIFFICULTY_PARAMS,
  nextTileCount,
  resolveValueOrderingDifficulty,
  sessionChallengeRating,
  valueOrderingParamsForLevel,
  valueOrderingParamsFromProfile,
  valueOrderingParamsToRecord,
} from './difficulty';
export type { RoundValidation } from './generator';
export {
  EXPRESSION_OPERATORS,
  MAX_ROUND_ATTEMPTS,
  MAX_TILE_ATTEMPTS,
  evaluateExpression,
  formatExpression,
  generateRound,
  generateSessionRounds,
  sortedValuesOf,
  validateRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  meanProgressOf,
  meanSpeedFactorOf,
  normalizeValueOrderingResult,
  perfectSessionScore,
  roundScore,
  speedFactorOf,
  valueOrderingPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildValueOrderingRawResult,
  dbSessionPersister,
  persistValueOrderingSession,
  seedToNumber,
} from './session';
export { valueOrderingGameReducer } from './reducer';
export {
  createValueOrderingQaForceStateHooks,
  createValueOrderingTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
