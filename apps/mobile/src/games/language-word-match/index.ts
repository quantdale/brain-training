/**
 * Word Match game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/language-word-match')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { LanguageWordMatchScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export {
  ContentPackError,
  TIERS,
  correctWordOf,
  isTier,
  loadContentPack,
  validateContentPack,
} from './content-validation';
export type { ContentPack, PackItem, Tier } from './content-validation';

export { GAME_ID } from './types';
export type {
  LanguageAction,
  LanguageDifficultyParams,
  LanguageGameState,
  LanguagePhase,
  LanguageRawResult,
  LanguageRound,
  LanguageStats,
  QaForceStatePatch,
  RoundOutcome,
} from './types';
export { createInitialLanguageState } from './types';

export {
  ADAPTIVE_PARAMS,
  LANGUAGE_DIFFICULTY_PARAMS,
  TIER_BITS,
  TIER_NUMBERS,
  isValidTier,
  languageParamsForLevel,
  languageParamsFromProfile,
  nextRoundParams,
  resolveLanguageDifficulty,
  sessionChallengeRating,
  tierNumber,
  tierOfNumber,
  tiersFromMask,
} from './difficulty';
export type { NextRoundTuning } from './difficulty';
export {
  MAX_SELECTION_ATTEMPTS,
  filterByTiers,
  isNearDuplicateRound,
  selectRound,
} from './generator';
export type { SelectRoundInput } from './generator';
export {
  accuracyOf,
  clamp01,
  languagePerformanceNormalizer,
  normalizeLanguageResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildLanguageRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLanguageSession,
  seedToNumber,
} from './session';
export { createLanguageQaForceStateHooks, createLanguageTutorialLifecycle } from './hooks';
export type { LanguageQaForceStateHooks } from './hooks';
export { CONTENT_PACK_ID, CONTENT_PACK_VERSION, SCORING_VERSION, versionToNumber } from './versions';
