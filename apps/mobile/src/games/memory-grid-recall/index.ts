/**
 * Grid Recall game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-grid-recall')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { GridRecallScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export { GAME_ID } from "./types";
export type {
 GridRecallAction,
 GridRecallDifficultyParams,
 GridRecallGameState,
 GridRecallPhase,
 GridRecallRawResult,
 GridRecallStats,
 QaForceStatePatch,
} from "./types";
export { createInitialGridRecallState } from "./types";

export {
 ADAPTIVE_PARAMS,
 GRID_RECALL_DIFFICULTY_PARAMS,
 gridRecallParamsForLevel,
 gridRecallParamsFromProfile,
 nextTargetCount,
 resolveGridRecallDifficulty,
 sessionChallengeRating,
} from "./difficulty";
export type { GenerateTargetsInput } from "./generator";
export {
 MAX_TARGET_ATTEMPTS,
 MIN_TARGET_SET_DISTANCE,
 generateTargetCells,
 isNearDuplicateSet,
 targetSetDistance,
} from "./generator";
export {
 accuracyOf,
 clamp01,
 gridRecallPerformanceNormalizer,
 normalizeGridRecallResult,
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
 buildGridRecallRawResult,
 buildSessionRecord,
 dbSessionPersister,
 persistGridRecallSession,
 seedToNumber,
} from "./session";
export {
 createGridRecallQaForceStateHooks,
 createGridRecallTutorialLifecycle,
} from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
