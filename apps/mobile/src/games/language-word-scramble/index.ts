/**
 * Word Scramble game module entry.
 *
 * Default export: the game screen. Also exports the frozen `gameDefinition`
 * and the module's public logic surface for tests/QA.
 */
export { default } from './screen';
export type { WordScrambleScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  WordScrambleAction,
  WordScrambleDifficultyParams,
  WordScrambleGameState,
  WordScramblePhase,
  WordScrambleRawResult,
  WordScrambleRound,
  WordScrambleStats,
  QaForceStatePatch,
} from './types';
export { createInitialWordScrambleState } from './types';

export {
  ADAPTIVE_PARAMS,
  WORD_SCRAMBLE_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  resolveWordScrambleDifficulty,
  sessionChallengeRating,
  wordScrambleParamsForLevel,
  wordScrambleParamsFromProfile,
} from './difficulty';
export type { GenerateRoundInput } from './generator';
export {
  MAX_WORD_ATTEMPTS,
  generateRound,
  scrambleWord,
  selectDistractors,
} from './generator';
export {
  accuracyOf,
  clamp01,
  normalizeWordScrambleResult,
  perfectSessionScore,
  roundScore,
  wordDifficultyProgress,
  wordScramblePerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildWordScrambleRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistWordScrambleSession,
  seedToNumber,
} from './session';
export { createWordScrambleQaForceStateHooks, createWordScrambleTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';
