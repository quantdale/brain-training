/**
 * Speed Color Match game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/speed-color-match')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from './screen';
export type { SpeedColorMatchScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  SpeedColorMatchAction,
  SpeedColorMatchDifficultyParams,
  SpeedColorMatchPhase,
  SpeedColorMatchRawResult,
  SpeedColorMatchGameState,
  SpeedColorMatchStats,
  QaForceStatePatch,
} from './types';
export { createInitialSpeedColorMatchState } from './types';

export {
  ADAPTIVE_PARAMS,
  SPEED_COLOR_MATCH_DIFFICULTY_PARAMS,
  speedColorMatchParamsForLevel,
  speedColorMatchParamsFromProfile,
  resolveSpeedColorMatchDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateTrialsInput } from './generator';
export { generateTrials } from './generator';
export {
  accuracyOf,
  clamp01,
  normalizeSpeedColorMatchResult,
  speedColorMatchPerformanceNormalizer,
  speedFactor,
  streakFactor,
  trialScore,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  SessionPersistence,
} from './session';
export {
  buildSpeedColorMatchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpeedColorMatchSession,
  seedToNumber,
} from './session';
export {
  createSpeedColorMatchQaForceStateHooks,
  createSpeedColorMatchTutorialLifecycle,
} from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
