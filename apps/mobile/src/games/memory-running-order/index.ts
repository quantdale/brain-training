/**
 * Running Order game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-running-order')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { RunningOrderScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export { GAME_ID } from "./types";
export type {
 RunningOrderAction,
 RunningOrderDifficultyParams,
 RunningOrderGameState,
 RunningOrderPhase,
 RunningOrderRawResult,
 RunningOrderStats,
 QaForceStatePatch,
} from "./types";
export { createInitialRunningOrderState } from "./types";

export {
 ADAPTIVE_PARAMS,
 RUNNING_ORDER_DIFFICULTY_PARAMS,
 runningOrderParamsForLevel,
 runningOrderParamsFromProfile,
 nextRecallLength,
 resolveRunningOrderDifficulty,
 sessionChallengeRating,
} from "./difficulty";
export type { GenerateStreamInput } from "./generator";
export {
 MAX_STREAM_ATTEMPTS,
 MIN_TARGET_HAMMING_DISTANCE,
 generateStream,
 isNearDuplicateTarget,
 streamTarget,
 targetDistance,
} from "./generator";
export {
 accuracyOf,
 clamp01,
 runningOrderPerformanceNormalizer,
 normalizeRunningOrderResult,
 perfectSessionScore,
 recallProgress,
 referenceMaxTargets,
 roundScore,
} from "./scoring";
export type {
 BuildRawResultInput,
 BuildSessionRecordInput,
 PersistOutcome,
 SessionPersistence,
} from "./session";
export {
 buildRunningOrderRawResult,
 buildSessionRecord,
 dbSessionPersister,
 persistRunningOrderSession,
 seedToNumber,
} from "./session";
export {
 createRunningOrderQaForceStateHooks,
 createRunningOrderTutorialLifecycle,
} from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
export {
 RUNNING_ORDER_SYMBOLS,
 SYMBOL_COUNT,
 symbolById,
} from "./symbols";
export type { RunningOrderSymbol } from "./symbols";
