/**
 * Mental Rotation game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/spatial-mental-rotation')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpatialScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, BLOCK_COLOR_COUNT, INITIAL_STATS, createInitialSpatialState } from './types';
export type {
  Block,
  Cell,
  QaForceStatePatch,
  RotationDegrees,
  RoundKind,
  RoundOutcome,
  SpatialAction,
  SpatialDifficultyParams,
  SpatialGameState,
  SpatialPhase,
  SpatialProfileParams,
  SpatialRawResult,
  SpatialStats,
} from './types';

export {
  ADAPTIVE_ANGLE_MASK_TIERS,
  ADAPTIVE_PARAMS,
  ADAPTIVE_POSITION_STEP,
  SPATIAL_DIFFICULTY_PARAMS,
  angleMaskForPosition,
  anglesFromMask,
  nextAdaptivePosition,
  paramsForPosition,
  resolveSpatialDifficulty,
  sessionChallengeRating,
  spatialParamsForLevel,
  spatialParamsFromProfile,
} from './difficulty';
export type { GenerateRoundInput, RotationRound, RoundValidation } from './generator';
export {
  GRID_BOUND,
  MAX_ROUND_ATTEMPTS,
  MAX_SHAPE_ATTEMPTS,
  MAX_WALK_STEPS,
  alterBlocks,
  cellsOf,
  fallbackShape,
  generateRound,
  generateShape,
  hasReflectionSymmetry,
  hasRotationSymmetry,
  isAmbiguous,
  isBlockRotationOf,
  isWellFormed,
  mirrorBlocks,
  mirrorCells,
  normalizeBlocks,
  normalizeCells,
  rotateBlocks,
  rotateCells,
  sameBlockSet,
  sameCellSet,
  solveRound,
  validateRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  normalizeSpatialResult,
  perfectSessionScore,
  roundScore,
  spatialPerformanceNormalizer,
  speedOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildSpatialRawResult,
  dbSessionPersister,
  persistSpatialSession,
  seedToNumber,
} from './session';
export {
  createSpatialQaForceStateHooks,
  createSpatialTutorialLifecycle,
} from './hooks';
export type { SpatialQaForceStateHooks } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
