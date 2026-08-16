/**
 * Visual Search game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/attention-visual-search')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` (from game.json via
 * the SDK contract) and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { VisualSearchScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  QaForceStatePatch,
  VisualSearchAction,
  VisualSearchDifficultyParams,
  VisualSearchGameState,
  VisualSearchPhase,
  VisualSearchRawResult,
  VisualSearchStats,
} from './types';
export { createInitialVisualSearchState } from './types';

export {
  ADAPTIVE_PARAMS,
  DISTRACTOR_PENALTY_MS,
  GRID_ESCALATION_EVERY,
  GRID_LEVELS,
  VISUAL_SEARCH_DIFFICULTY_PARAMS,
  gridSizeFor,
  nextAdaptiveWindow,
  resolveVisualSearchDifficulty,
  sessionChallengeRating,
  visualSearchParamsForLevel,
  visualSearchParamsFromProfile,
  windowMsFor,
} from './difficulty';
export type { GenerateRoundTargetInput } from './generator';
export {
  MAX_TARGET_ATTEMPTS,
  generateRoundTarget,
  generateSessionTargets,
  isNearDuplicateTarget,
  isValidLayout,
  targetDistance,
} from './generator';
export {
  BASE_ROUND_POINTS,
  MAX_SPEED_BONUS,
  accuracyOf,
  avgResponseMsOf,
  avgSpeedRatio,
  clamp01,
  normalizeVisualSearchResult,
  perfectSessionScore,
  roundScore,
  visualSearchPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildSessionRecord,
  buildVisualSearchRawResult,
  dbSessionPersister,
  persistVisualSearchSession,
  seedToNumber,
} from './session';
export { createVisualSearchQaForceStateHooks, createVisualSearchTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
