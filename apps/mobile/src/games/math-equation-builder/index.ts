/**
 * Math Equation Builder game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/math-equation-builder')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { MathEquationBuilderScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  MathEquationBuilderAction,
  MathEquationBuilderDifficultyParams,
  MathEquationBuilderGameState,
  MathEquationBuilderPhase,
  MathEquationBuilderRawResult,
  MathEquationBuilderStats,
  EquationToken,
  Operator,
  QaForceStatePatch,
} from './types';
export { createInitialMathEquationBuilderState } from './types';

export {
  ADAPTIVE_PARAMS,
  MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS,
  mathEquationBuilderParamsForLevel,
  mathEquationBuilderParamsFromProfile,
  nextAdaptiveParams,
  resolveMathEquationBuilderDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GeneratePuzzleInput, GeneratedPuzzle } from './generator';
export {
  MAX_PUZZLE_ATTEMPTS,
  applyOperator,
  canSolve,
  evaluateAllResults,
  generatePuzzle,
} from './generator';
export {
  evaluateEquationTokens,
  insertGroupParens,
  isValidEquationStructure,
} from './reducer';
export {
  accuracyOf,
  avgTimeBonus,
  clamp01,
  mathEquationBuilderPerformanceNormalizer,
  normalizeMathEquationBuilderResult,
  partialCreditScore,
  perfectSessionScore,
  puzzleScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildMathEquationBuilderRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathEquationBuilderSession,
  seedToNumber,
} from './session';
export {
  createMathEquationBuilderQaForceStateHooks,
  createMathEquationBuilderTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
