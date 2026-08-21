/**
 * Spatial Fold Match game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/spatial-fold-match')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpatialFoldMatchScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  FoldType,
  QaForceStatePatch,
  SpatialFoldMatchAction,
  SpatialFoldMatchDifficultyParams,
  SpatialFoldMatchGameState,
  SpatialFoldMatchPhase,
  SpatialFoldMatchRawResult,
  SpatialFoldMatchStats,
} from './types';
export {
  ALL_FOLDS,
  FOLD_LABELS,
  INITIAL_STATS,
  createInitialSpatialFoldMatchState,
} from './types';

export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  nextFilledCells,
  nextOptionCount,
  paramsForLevel,
  resolveSpatialFoldMatchDifficulty,
  sessionChallengeRating,
  spatialFoldMatchParamsFromProfile,
} from './difficulty';
export type { GenerateRoundInput, Grid, ReadonlyGrid, RoundData } from './generator';
export {
  MAX_GENERATION_ATTEMPTS,
  MIN_PATTERN_DISTANCE,
  applyFold,
  applyFoldBaseOnly,
  applyFoldXor,
  cloneGrid,
  generateRoundData,
  generateSourceGrid,
  gridDims,
  gridDistance,
  gridsEqual,
  makeEmptyGrid,
  validateRound,
} from './generator';
export {
  CORRECT_POINTS,
  MAX_ROUND_SCORE,
  SPEED_BONUS,
  accuracyOf,
  clamp01,
  normalizeSpatialFoldMatchResult,
  perfectSessionScore,
  roundScore,
  spatialFoldMatchPerformanceNormalizer,
  speedScoreOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildSpatialFoldMatchRawResult,
  dbSessionPersister,
  persistSpatialFoldMatchSession,
  seedToNumber,
} from './session';
export {
  createSpatialFoldMatchQaForceStateHooks,
  createSpatialFoldMatchTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
