/**
 * Next in Sequence game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/logic-next-sequence')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { LogicScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  LogicAction,
  LogicDifficultyParams,
  LogicGameState,
  LogicPhase,
  LogicPuzzle,
  LogicRawResult,
  LogicStats,
  QaForceStatePatch,
  RecipeFamily,
} from './types';
export { INITIAL_STATS, createInitialLogicState } from './types';

export {
  ADAPTIVE_PARAMS,
  LOGIC_DIFFICULTY_PARAMS,
  MAX_TIER,
  logicParamsForLevel,
  logicParamsFromProfile,
  nextAdaptiveTier,
  referenceMsForTier,
  resolveLogicDifficulty,
  sessionChallengeRating,
  visibleLengthForTier,
} from './difficulty';
export type { GeneratePuzzleInput, SolvedPattern } from './generator';
export {
  MAX_PUZZLE_ATTEMPTS,
  RECIPE_TIERS,
  buildDistractors,
  describePattern,
  generatePuzzle,
  isNearDuplicatePuzzle,
  solveSequence,
} from './generator';
export {
  accuracyOf,
  clamp01,
  logicPerformanceNormalizer,
  normalizeLogicResult,
  perfectSessionScore,
  roundScore,
  sessionSpeed,
  speedFactor,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildLogicRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLogicSession,
  seedToNumber,
} from './session';
export { createLogicQaForceStateHooks, createLogicTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
