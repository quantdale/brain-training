/**
 * Rule Grid game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/logic-rule-grid')` and the route renders `mod.default`).
 * Also exports the frozen `gameDefinition` (from game.json via the SDK
 * contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { RuleGridScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  RuleGridAction,
  RuleGridDifficultyParams,
  RuleGridGameState,
  RuleGridPhase,
  RuleGridRawResult,
  RuleGridRound,
  RuleGridStats,
  QaForceStatePatch,
} from './types';
export { createInitialRuleGridState, INITIAL_STATS } from './types';

export {
  ADAPTIVE_PARAMS,
  RULE_GRID_DIFFICULTY_PARAMS,
  ruleGridParamsForLevel,
  ruleGridParamsFromProfile,
  resolveRuleGridDifficulty,
  sessionChallengeRating,
} from './difficulty';
export { generateRound, generateSquare, isUniquelySolvable, buildSymbolOptions, validateGeneratedRound, MAX_ATTEMPTS } from './generator';
export type { GenerateRoundInput } from './generator';
export {
  accuracyOf,
  clamp01,
  efficiency,
  ruleGridPerformanceNormalizer,
  normalizeRuleGridResult,
  perfectSessionScore,
  roundScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildRuleGridRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistRuleGridSession,
  seedToNumber,
} from './session';
export { createRuleGridQaForceStateHooks, createRuleGridTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
