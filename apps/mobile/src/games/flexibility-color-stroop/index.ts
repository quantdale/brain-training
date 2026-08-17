/**
 * Color Stroop game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/flexibility-color-stroop')` and the route renders
 * `mod.default`). Also exports the frozen `gameDefinition` and the module's
 * public logic surface for tests/QA.
 */
export { default } from './screen';
export type { ColorStroopScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID, STROOP_COLORS, STROOP_COLOR_HEX, NEUTRAL_WORDS, INITIAL_STATS } from './types';
export type {
  AnswerRule,
  ColorStroopAction,
  ColorStroopDifficultyParams,
  ColorStroopGameState,
  ColorStroopPhase,
  ColorStroopRawResult,
  ColorStroopStats,
  QaForceStatePatch,
  StroopColor,
  StroopTrial,
} from './types';
export { createInitialColorStroopState } from './types';

export {
  ADAPTIVE_PARAMS,
  COLOR_STROOP_DIFFICULTY_PARAMS,
  adaptiveIncongruentRatio,
  colorStroopParamsForLevel,
  colorStroopParamsFromProfile,
  resolveColorStroopDifficulty,
  sessionChallengeRating,
} from './difficulty';

export type { GenerateTrialsInput } from './generator';
export { generateTrials, validateTrials } from './generator';

export {
  accuracyOf,
  clamp01,
  colorStroopPerformanceNormalizer,
  flipBonusFactor,
  normalizeColorStroopResult,
  perfectSessionScore,
  speedBonus,
  trialScore,
} from './scoring';

export type { BuildRawResultInput, BuildSessionRecordInput, PersistOutcome, SessionPersistence } from './session';
export {
  buildColorStroopRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistColorStroopSession,
  seedToNumber,
} from './session';

export { createColorStroopQaForceStateHooks, createColorStroopTutorialLifecycle } from './hooks';

export { SCORING_VERSION, versionToNumber } from './versions';

export { colorStroopGameReducer } from './reducer';