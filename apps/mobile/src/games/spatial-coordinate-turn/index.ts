/**
 * Spatial Coordinate Turn game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/spatial-coordinate-turn')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpatialCoordinateTurnScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export {
  GAME_ID,
  INITIAL_STATS,
  createInitialSpatialCoordinateTurnState,
} from './types';
export type {
  SpatialCoordinateTurnAction,
  SpatialCoordinateTurnDifficultyParams,
  SpatialCoordinateTurnGameState,
  SpatialCoordinateTurnPhase,
  SpatialCoordinateTurnRawResult,
  SpatialCoordinateTurnRound,
  SpatialCoordinateTurnStats,
  QaForceStatePatch,
  Coord,
  Dir,
  Command,
  CommandType,
  HeadingRound,
  PositionRound,
} from './types';
export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  paramsForLevel,
  spatialCoordinateTurnParamsFromProfile,
  resolveSpatialCoordinateTurnDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { BuildRawResultInput, BuildSessionRecordInput, PersistOutcome, SessionPersistence } from './session';
export {
  buildSessionRecord,
  buildSpatialCoordinateTurnRawResult,
  dbSessionPersister,
  persistSpatialCoordinateTurnSession,
  seedToNumber,
} from './session';
export {
  POSITION_OPTION_COUNT,
  directionsOrder,
  generateRound,
  generateSession,
  rotateDir,
  simulate,
  validateRound,
} from './generator';
export {
  BASE_POINTS,
  MAX_SPEED_BONUS,
  PERFECT_ROUND_SCORE,
  accuracyOf,
  clamp01,
  normalizeSpatialCoordinateTurnResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  spatialCoordinateTurnPerformanceNormalizer,
} from './scoring';
export { createSpatialCoordinateTurnQaForceStateHooks, createSpatialCoordinateTurnTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
