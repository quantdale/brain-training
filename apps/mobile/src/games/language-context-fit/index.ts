/**
 * Context Fit game module entry.
 */
export { default } from './screen';
export type { ContextFitScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export {
  ContentPackError,
  TIERS,
  blankCount,
  isTier,
  loadContentPack,
  validateContentPack,
} from './content-validation';
export type { ContentPack, PackItem, Tier } from './content-validation';

export { GAME_ID } from './types';
export type {
  ContextFitAction,
  ContextFitDifficultyParams,
  ContextFitGameState,
  ContextFitPhase,
  ContextFitRawResult,
  ContextFitRound,
  ContextFitStats,
  QaForceStatePatch,
  RoundOutcome,
} from './types';
export { createInitialContextFitState } from './types';

export {
  ADAPTIVE_PARAMS,
  CONTEXT_FIT_DIFFICULTY_PARAMS,
  TIER_BITS,
  TIER_NUMBERS,
  isValidTier,
  contextFitParamsForLevel,
  contextFitParamsFromProfile,
  nextRoundParams,
  resolveContextFitDifficulty,
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
  validateRound,
} from './generator';
export type { SelectRoundInput } from './generator';
export {
  accuracyOf,
  clamp01,
  contextFitPerformanceNormalizer,
  normalizeContextFitResult,
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
  buildContextFitRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistContextFitSession,
  seedToNumber,
} from './session';
export { CONTENT_PACK_ID, CONTENT_PACK_VERSION, SCORING_VERSION, versionToNumber } from './versions';
