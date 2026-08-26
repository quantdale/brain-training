/**
 * Card Sort game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/flexibility-card-sort')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { CardSortScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, RULES, SHAPES, CARD_COLORS, INITIAL_STATS } from './types';
export type {
  Card,
  ColorId,
  FlexibilityAction,
  FlexibilityDifficultyParams,
  FlexibilityGameState,
  FlexibilityPhase,
  FlexibilityRawResult,
  FlexibilityStats,
  GeneratedRound,
  QaForceStatePatch,
  RuleId,
  ShapeId,
} from './types';
export { createInitialFlexibilityState, matchesUnder, otherRule } from './types';

export {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_DIFFICULTY_PARAMS,
  flexibilityParamsForLevel,
  flexibilityParamsFromProfile,
  nextSwitchEvery,
  resolveFlexibilityDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  isDiscoveryBlock,
  pickInitialRule,
  planDiscoveryBlocks,
  validateRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  discoveryAccuracyOf,
  flexibilityPerformanceNormalizer,
  normalizeFlexibilityResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  switchAccuracyOf,
  switchBlendFactorOf,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildFlexibilityRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilitySession,
  seedToNumber,
} from './session';
export {
  createFlexibilityQaForceStateHooks,
  createFlexibilityTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
