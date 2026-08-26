/**
 * Rule Flip game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/flexibility-rule-flip')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { RuleFlipScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  Card,
  ColorId,
  FlexibilityRuleFlipAction,
  FlexibilityRuleFlipDifficultyParams,
  FlexibilityRuleFlipGameState,
  FlexibilityRuleFlipPhase,
  FlexibilityRuleFlipRawResult,
  FlexibilityRuleFlipStats,
  GeneratedRound,
  QaForceStatePatch,
  RuleId,
  ShapeId,
} from './types';
export {
  ALL_RULES,
  CARD_COLORS,
  INITIAL_STATS,
  RULES,
  RULE_LABELS,
  SHAPES,
  createInitialFlexibilityRuleFlipState,
  matchesUnder,
  otherRules,
  repeatAccuracyOf,
  switchAccuracyOf as statsSwitchAccuracyOf,
  uncuedAccuracyOf as statsUncuedAccuracyOf,
} from './types';

export {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS,
  flexibilityRuleFlipParamsForLevel,
  flexibilityRuleFlipParamsFromProfile,
  nextBlockRule,
  resolveFlexibilityRuleFlipDifficulty,
  sessionChallengeRating,
} from './difficulty';

export type { GenerateRoundInput } from './generator';
export {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  generateSession,
  pickDifferentRule,
  pickInitialRule,
  validateRound,
} from './generator';

export {
  SWITCH_CORRECT_BONUS,
  UNCUED_FIRST_PICK_BONUS,
  accuracyOf,
  clamp01,
  flexibilityRuleFlipPerformanceNormalizer,
  normalizeFlexibilityRuleFlipResult,
  perfectPlanScore,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  switchAccuracyOf,
  trialRawScore,
  uncuedAccuracyOf as scoreUncuedAccuracyOf,
} from './scoring';

export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildFlexibilityRuleFlipRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityRuleFlipSession,
  seedToNumber,
} from './session';

export {
  createFlexibilityRuleFlipQaForceStateHooks,
  createFlexibilityRuleFlipTutorialLifecycle,
} from './hooks';

export { SCORING_VERSION, versionToNumber } from './versions';
