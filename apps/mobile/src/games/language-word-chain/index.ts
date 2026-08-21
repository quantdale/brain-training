/**
 * Word Chain game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/language-word-chain')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from "./screen";
export type { WordChainScreenProps } from "./screen";

export { gameDefinition } from "./game-definition";

export {
  TIERS,
  WordChainPackError,
  isTier,
  loadContentPack,
  validateWordChainPack,
} from "./content-validation";
export type { ChainItem, Tier, WordChainPack } from "./content-validation";

export { GAME_ID } from "./types";
export type {
  ChainStep,
  LanguageWordChainAction,
  LanguageWordChainPhase,
  LanguageWordChainRawResult,
  LanguageWordChainState,
  LanguageWordChainStats,
  QaForceStatePatch,
  RoundOutcome,
  WordChainDifficultyParams,
  WordChainRound,
} from "./types";
export { createInitialLanguageWordChainState } from "./types";

export {
  ADAPTIVE_PARAMS,
  TIER_BITS,
  TIER_NUMBERS,
  WORD_CHAIN_DIFFICULTY_PARAMS,
  isValidTier,
  nextRoundParams,
  resolveWordChainDifficulty,
  sessionChallengeRating,
  tierNumber,
  tierOfNumber,
  tiersFromMask,
  wordChainParamsForLevel,
  wordChainParamsFromProfile,
} from "./difficulty";
export type { NextRoundTuning } from "./difficulty";
export type { GenerateRoundInput } from "./generator";
export {
  MAX_GENERATION_ATTEMPTS,
  filterByLength,
  filterByTiers,
  generateRound,
  isNearDuplicateRound,
  validateGeneratedRound,
} from "./generator";
export {
  FULL_CHAIN_BONUS,
  PER_STEP_BASE,
  PER_STEP_MAX_SPEED,
  accuracyOf,
  clamp01,
  normalizeWordChainResult,
  perfectSessionScore,
  speedScoreOf,
  stepScore,
  wordChainPerformanceNormalizer,
} from "./scoring";
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from "./session";
export {
  buildSessionRecord,
  buildWordChainRawResult,
  dbSessionPersister,
  persistWordChainSession,
  seedToNumber,
} from "./session";
export {
  createWordChainQaForceStateHooks,
  createWordChainTutorialLifecycle,
} from "./hooks";
export type { WordChainQaForceStateHooks } from "./hooks";
export {
  CONTENT_PACK_ID,
  CONTENT_PACK_VERSION,
  SCORING_VERSION,
  versionToNumber,
} from "./versions";
