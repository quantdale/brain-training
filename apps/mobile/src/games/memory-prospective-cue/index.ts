/**
 * Cue Keeper game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-prospective-cue')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { ProspectiveCueScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export { GAME_ID } from "./types";
export type {
  ItemResponse,
  LastItemOutcome,
  ProspectiveCueAction,
  ProspectiveCueDifficultyParams,
  ProspectiveCueGameState,
  ProspectiveCuePhase,
  ProspectiveCueRawResult,
  ProspectiveCueStats,
  ProspectiveRound,
  QaForceStatePatch,
  StreamItem,
} from "./types";
export { createInitialProspectiveCueState } from "./types";

export {
  ADAPTIVE_PARAMS,
  ITEM_MS_STEP,
  PROSPECTIVE_CUE_DIFFICULTY_PARAMS,
  nextItemMs,
  nextSignalCount,
  prospectiveCueParamsForLevel,
  prospectiveCueParamsFromProfile,
  resolveProspectiveCueDifficulty,
  sessionChallengeRating,
} from "./difficulty";
export {
  MAX_ROUND_ATTEMPTS,
  generateRound,
  isNearDuplicateRound,
  splitCarryOver,
  validateRound,
} from "./generator";
export { GLYPH_COUNT, STREAM_GLYPHS, glyphById } from "./glyphs";
export {
  FALSE_ALARM_PENALTY,
  GO_HIT_POINTS,
  GO_MISS_PENALTY,
  GO_SPEED_BONUS,
  SIGNAL_HIT_POINTS,
  SIGNAL_MISS_PENALTY,
  accuracyOf,
  clamp01,
  itemAccuracyOf,
  itemPoints,
  normalizeProspectiveCueResult,
  perfectSessionScore,
  prospectiveCuePerformanceNormalizer,
  signalAccuracyOf,
} from "./scoring";
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from "./session";
export {
  buildProspectiveCueRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistProspectiveCueSession,
  seedToNumber,
} from "./session";
export {
  createProspectiveCueQaForceStateHooks,
  createProspectiveCueTutorialLifecycle,
} from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
