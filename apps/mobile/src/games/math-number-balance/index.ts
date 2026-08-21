/**
 * Fast Math game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/math-fast-math')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { MathScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, OPERATORS } from './types';
export type {
  MathAction,
  MathDifficultyParams,
  MathGameState,
  MathPhase,
  MathProblem,
  MathRawResult,
  MathRoundOutcome,
  MathStats,
  Operator,
  OperatorRange,
  QaForceStatePatch,
} from './types';
export { createInitialMathState } from './types';

export {
  ADAPTIVE_MAX_STEP,
  ADAPTIVE_MIN_STEP,
  ADAPTIVE_PARAMS,
  MATH_DIFFICULTY_PARAMS,
  OPERATOR_MASK,
  adaptiveParamsForStep,
  mathParamsForLevel,
  mathParamsFromProfile,
  mathParamsToRecord,
  operatorMaskOf,
  operatorsForStep,
  operatorsFromMask,
  resolveMathDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateProblemInput } from './generator';
export {
  MAX_PROBLEM_ATTEMPTS,
  generateProblem,
  generateSessionProblems,
  isNearDuplicate,
  isTrivialProblem,
  problemSignature,
} from './generator';
export {
  BASE_PROBLEM_POINTS,
  SPEED_BONUS_POINTS,
  accuracyOf,
  clamp01,
  mathPerformanceNormalizer,
  normalizeMathResult,
  perfectSessionScore,
  problemScore,
  speedFactor,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildMathRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathSession,
  seedToNumber,
} from './session';
export { createMathQaForceStateHooks, createMathTutorialLifecycle } from './hooks';
export { MAX_INPUT_LENGTH, mathGameReducer } from './reducer';
export { SCORING_VERSION, versionToNumber } from './versions';
