/**
 * Math Missing Operator game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/math-missing-operator')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json
 * via the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { MathMissingOperatorScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, OPERATORS, OPERATOR_GLYPHS } from './types';
export type {
  Equation,
  MathMissingOperatorAction,
  MathMissingOperatorDifficultyParams,
  MathMissingOperatorGameState,
  MathMissingOperatorPhase,
  MathMissingOperatorRawResult,
  MathMissingOperatorRoundOutcome,
  MathMissingOperatorStats,
  Operator,
  QaForceStatePatch,
} from './types';
export { INITIAL_STATS, createInitialMathMissingOperatorState } from './types';

export {
  ADAPTIVE_PARAMS,
  MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS,
  aMaxForRound,
  adaptiveRatingAfter,
  budgetForRound,
  mathMissingOperatorParamsForLevel,
  mathMissingOperatorParamsFromProfile,
  resolveMathMissingOperatorDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateEquationInput } from './generator';
export {
  MAX_EQUATION_ATTEMPTS,
  evaluate,
  generateEquation,
  isUniqueSolution,
  uniqueSolutionCount,
} from './generator';
export {
  accuracyOf,
  avgResponseMs,
  clamp01,
  mathMissingOperatorPerformanceNormalizer,
  normalizeMathMissingOperatorResult,
  perfectSessionScore,
  roundScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildMathMissingOperatorRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathMissingOperatorSession,
  seedToNumber,
} from './session';
export {
  createMathMissingOperatorQaForceStateHooks,
  createMathMissingOperatorTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
