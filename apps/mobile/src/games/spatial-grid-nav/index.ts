/**
 * Spatial Grid Navigator game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/spatial-grid-nav')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpatialGridNavScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, cellsEqual, createInitialState } from './types';
export type {
  SpatialGridNavAction,
  SpatialGridNavDifficultyParams,
  SpatialGridNavGameState,
  SpatialGridNavPhase,
  SpatialGridNavRawResult,
  SpatialGridNavStats,
  QaForceStatePatch,
  Cell,
  Dir,
  Command,
  CommandType,
  GeneratedRound,
} from './types';
export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  paramsForLevel,
  paramsFromProfile,
  resolveSpatialGridNavDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { BuildRawResultInput, BuildSessionRecordInput, PersistOutcome, SessionPersistence } from './session';
export {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpatialGridNavSession,
  seedToNumber,
} from './session';
export {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  generateRound,
  generateSession,
  inBounds,
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
  hardAccuracyOf,
  normalizeSpatialGridNavResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  spatialGridNavPerformanceNormalizer,
} from './scoring';
export { createQaForceStateHooks, createSpatialGridNavTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
