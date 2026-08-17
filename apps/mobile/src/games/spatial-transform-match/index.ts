/**
 * Spatial Transform Match game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/spatial-transform-match')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json
 * via the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpatialTransformMatchScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  SpatialTransformMatchAction,
  SpatialTransformMatchDifficultyParams,
  SpatialTransformMatchGameState,
  SpatialTransformMatchPhase,
  SpatialTransformMatchRawResult,
  SpatialTransformMatchStats,
  QaForceStatePatch,
  TransformType,
} from './types';
export { ALL_TRANSFORMS, TRANSFORM_LABELS, createInitialState } from './types';

export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  nextFilledCells,
  nextOptionCount,
  paramsForLevel,
  paramsFromProfile,
  resolveGameDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundDataInput, RoundData } from './generator';
export {
  MAX_GENERATION_ATTEMPTS,
  MIN_PATTERN_DISTANCE,
  applyTransform,
  coordsToIndex,
  generateRoundData,
  generateSourcePattern,
  indexToCoords,
  isSymmetric,
  patternDistance,
} from './generator';
export {
  CORRECT_POINTS,
  accuracyOf,
  clamp01,
  normalizeResult,
  perfectSessionScore,
  roundScore,
  speedProgress,
  spatialTransformMatchPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession,
  seedToNumber,
} from './session';
export { createQaForceStateHooks, createSpatialTransformMatchTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
