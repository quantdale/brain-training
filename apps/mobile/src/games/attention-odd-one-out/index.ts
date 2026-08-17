/**
 * Odd One Out game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/attention-odd-one-out')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { OddOneOutScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  DeviationSpec,
  OddOneOutAction,
  OddOneOutBoard,
  OddOneOutDifficultyParams,
  OddOneOutGameState,
  OddOneOutPhase,
  OddOneOutRawResult,
  OddOneOutStats,
  QaForceStatePatch,
} from './types';
export { createInitialOddOneOutState } from './types';

export {
  ADAPTIVE_PARAMS,
  ODD_ONE_OUT_DIFFICULTY_PARAMS,
  effectiveParamsForStep,
  escalateStep,
  maxStepFor,
  oddOneOutParamsForLevel,
  oddOneOutParamsFromProfile,
  resolveOddOneOutDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { EffectiveRoundParams } from './difficulty';
export type { GenerateBoardInput } from './generator';
export {
  DEVIATION_VARIANTS,
  MAX_BOARD_ATTEMPTS,
  MIN_ODD_DISTANCE,
  generateBoard,
  isConfusable,
  manhattanDistance,
  renderSpecFor,
} from './generator';
export {
  FIRST_TRY_BONUS,
  ROUND_POINTS,
  WRONG_TAP_PENALTY,
  accuracyOf,
  avgSolveRatioOf,
  clamp01,
  firstTryRateOf,
  normalizeOddOneOutResult,
  oddOneOutPerformanceNormalizer,
  perfectSessionScore,
  roundPoints,
  speedOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildOddOneOutRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistOddOneOutSession,
  seedToNumber,
} from './session';
export { createOddOneOutQaForceStateHooks, createOddOneOutTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
