/**
 * Cue Shift game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/flexibility-cue-shift')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { CueShiftScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, RULES, SHAPES, CARD_COLORS, RULE_LABELS, INITIAL_STATS } from './types';
export type {
  Card,
  ColorId,
  FlexibilityCueAction,
  FlexibilityCueDifficultyParams,
  FlexibilityCueGameState,
  FlexibilityCuePhase,
  FlexibilityCueRawResult,
  FlexibilityCueStats,
  GeneratedRound,
  QaForceStatePatch,
  RuleId,
  ShapeId,
} from './types';
export { createInitialFlexibilityCueState, matchesUnder, otherRules, switchAccuracyOf } from './types';

export {
  ADAPTIVE_PARAMS,
  FLEXIBILITY_CUE_DIFFICULTY_PARAMS,
  flexibilityCueParamsForLevel,
  flexibilityCueParamsFromProfile,
  nextRule,
  resolveFlexibilityCueDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  cardAlphabet,
  generateRound,
  generateSession,
  pickInitialRule,
  validateRound,
} from './generator';
export {
  accuracyOf,
  clamp01,
  flexibilityCuePerformanceNormalizer,
  normalizeFlexibilityCueResult,
  perfectSessionScore,
  roundScore,
  speedScoreOf,
  switchAccuracyOf as switchAccuracyOfScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildFlexibilityCueRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityCueSession,
  seedToNumber,
} from './session';
export {
  createFlexibilityCueQaForceStateHooks,
  createFlexibilityCueTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
