/**
 * Deduction Table game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/logic-deduction-table')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { LogicDeductionScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export { GAME_ID } from "./types";
export type {
  AttributeDef,
  Clue,
  LogicDeductionAction,
  LogicDeductionDifficultyParams,
  LogicDeductionPhase,
  LogicDeductionRawResult,
  LogicDeductionRound,
  LogicDeductionState,
  LogicDeductionStats,
  Question,
  QaForceStatePatch,
  RoundOutcome,
} from "./types";
export { createInitialLogicDeductionState, INITIAL_STATS } from "./types";

export {
  ADAPTIVE_PARAMS,
  LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  logicDeductionParamsForLevel,
  logicDeductionParamsFromProfile,
  resolveLogicDeductionDifficulty,
  sessionChallengeRating,
} from "./difficulty";
export type { GenerateRoundInput } from "./generator";
export { MAX_GENERATION_ATTEMPTS, generateRound, validateGeneratedRound } from "./generator";
export {
  answerSet,
  countSolutions,
  isUniquelySolvable,
  solveAttribute,
} from "./solver";
export {
  accuracyOf,
  clamp01,
  logicDeductionPerformanceNormalizer,
  normalizeLogicDeductionResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from "./scoring";
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from "./session";
export {
  buildLogicDeductionRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLogicDeductionSession,
  seedToNumber,
} from "./session";
export {
  createLogicDeductionQaForceStateHooks,
  createLogicDeductionTutorialLifecycle,
} from "./hooks";
export type { LogicDeductionQaForceStateHooks } from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
