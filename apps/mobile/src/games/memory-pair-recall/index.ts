/**
 * Pair Recall game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/memory-pair-recall')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { PairRecallScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export { GAME_ID } from "./types";
export type {
  LastCueOutcome,
  PairRecallAction,
  PairRecallDifficultyParams,
  PairRecallGameState,
  PairRecallPhase,
  PairRecallRawResult,
  PairRecallRound,
  PairRecallStats,
  QaForceStatePatch,
  StimulusResponsePair,
} from "./types";
export { createInitialPairRecallState } from "./types";

export {
  ADAPTIVE_PARAMS,
  PAIR_RECALL_DIFFICULTY_PARAMS,
  nextPairCount,
  pairRecallParamsForLevel,
  pairRecallParamsFromProfile,
  resolvePairRecallDifficulty,
  sessionChallengeRating,
} from "./difficulty";
export {
  MAX_ROUND_ATTEMPTS,
  carryOverCount,
  generateRound,
  isNearDuplicateRound,
  validateRound,
} from "./generator";
export {
  PAIR_RESPONSES,
  PAIR_STIMULI,
  RESPONSE_COUNT,
  STIMULUS_COUNT,
  responseById,
  stimulusById,
} from "./pairs";
export {
  WRONG_TAP_PENALTY,
  accuracyOf,
  clamp01,
  normalizePairRecallResult,
  pairProgress,
  pairRecallPerformanceNormalizer,
  perfectSessionScore,
  referenceMaxPairs,
  roundScore,
} from "./scoring";
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from "./session";
export {
  buildPairRecallRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistPairRecallSession,
  seedToNumber,
} from "./session";
export {
  createPairRecallQaForceStateHooks,
  createPairRecallTutorialLifecycle,
} from "./hooks";
export { SCORING_VERSION, versionToNumber } from "./versions";
