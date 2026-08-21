/**
 * Task Switch game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/flexibility-task-switch')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { FlexibilityTaskSwitchScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export {
 GAME_ID,
 TASKS,
 TOKEN_COLORS,
 TOKEN_SHAPES,
 TASK_LABELS,
 TASK_ANSWERS,
 correctAnswerFor,
} from "./types";
export type {
 ColorId,
 FlexibilityTaskSwitchAction,
 FlexibilityTaskSwitchDifficultyParams,
 FlexibilityTaskSwitchGameState,
 FlexibilityTaskSwitchPhase,
 FlexibilityTaskSwitchRawResult,
 FlexibilityTaskSwitchStats,
 GeneratedRound,
 QaForceStatePatch,
 ShapeId,
 TaskId,
 Token,
} from "./types";
export {
 createInitialFlexibilityTaskSwitchState,
 switchAccuracyOfStats,
 switchCostMsOf,
} from "./types";

export {
 DIFFICULTY_PARAMS,
 ADAPTIVE_PARAMS,
 flexibilityTaskSwitchParamsFromProfile,
 paramsForLevel,
 resolveFlexibilityTaskSwitchDifficulty,
 sessionChallengeRating,
} from "./difficulty";
export { generateSession, validateRound, validatePlan } from "./generator";
export {
 accuracyOf,
 clamp01,
 flexibilityTaskSwitchPerformanceNormalizer,
 normalizeFlexibilityTaskSwitchResult,
 perfectSessionScore,
 roundScore,
 speedScoreOf,
 switchAccuracyOf,
} from "./scoring";
export type {
 BuildRawResultInput,
 BuildSessionRecordInput,
 PersistOutcome,
 SessionPersistence,
} from "./session";
export {
 buildFlexibilityTaskSwitchRawResult,
 buildSessionRecord,
 dbSessionPersister,
 persistFlexibilityTaskSwitchSession,
 seedToNumber,
} from "./session";
export {
 createFlexibilityTaskSwitchQaForceStateHooks,
 createFlexibilityTaskSwitchTutorialLifecycle,
} from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
