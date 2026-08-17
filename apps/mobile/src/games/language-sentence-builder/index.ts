/**
 * Sentence Builder game module entry.
 *
 * Default export: the game screen (the generated `gameScreenLoaders` does
 * `() => import('@/games/language-sentence-builder')` and the route renders
 * `mod.default`).
 */
export { default } from './screen';
export type { SentenceBuilderScreenProps } from './screen';

export { gameDefinition } from './game-definition';

export { GAME_ID } from './types';
export type {
  SentenceBuilderAction,
  SentenceBuilderDifficultyParams,
  SentenceBuilderState,
  SentenceBuilderPhase,
  SentenceBuilderRawResult,
  SentenceBuilderStats,
  QaForceStatePatch,
  CuratedSentence,
  ScrambledSentence,
} from './types';
export { createInitialState, INITIAL_STATS } from './types';

export {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  paramsForLevel,
  paramsFromProfile,
  resolveSentenceBuilderDifficulty,
  sessionChallengeRating,
} from './difficulty';
export type { GenerateRoundInput, GenerateRoundResult } from './generator';
export {
  MAX_SCRAMBLE_ATTEMPTS,
  categoryDistance,
  generateRound,
  scrambleWords,
} from './generator';
export {
  accuracyOf,
  avgWordLengthFactor,
  clamp01,
  computeRoundScore,
  normalizeSentenceBuilderResult,
  partialRoundScore,
  perfectRoundScore,
  positionAccuracy,
  sentenceBuilderPerformanceNormalizer,
} from './scoring';
export type {
  BuildRawResultInput,
  BuildSessionRecordInput,
  PersistOutcome,
  SessionPersistence,
} from './session';
export {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession,
  seedToNumber,
} from './session';
export { createSentenceBuilderQaForceStateHooks, createSentenceBuilderTutorialLifecycle } from './hooks';
export { SCORING_VERSION, versionToNumber } from './versions';

export { CATEGORY_LABELS, SENTENCE_BANK } from './content/sentence-bank';
