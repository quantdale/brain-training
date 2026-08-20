/**
 * Best-effort extraction of comparable performance metrics from a game session's
 * free-form `rawResult` / `difficulty` payloads.
 *
 * `GameRawResult` is an opaque `Record<string, unknown>` (see `@/sdk`), so each
 * game chooses its own field names. The maps below are a presentation adapter
 * owned by the analytics feature (not the Game SDK or registry): they recognize
 * the field names actually emitted by the 20 shipped games. When a field is
 * absent for a particular game, the extractor returns `null` and the UI simply
 * omits that trend — we never manufacture a metric that is not present in the
 * stored evidence.
 *
 * Reaction-time / difficulty handling mirrors the per-game shapes observed in
 * the catalog: reaction times appear under several names (`avgResponseMs`,
 * `meanReactionMs`, `avgReactionMs`, `averageAnswerMs`, `fastestReactionMs`,
 * `medianReactionMs`, ...); difficulty carries either a numeric `challengeRating`
 * or a named `DifficultyLevel` string that maps to the SDK baseline ratings.
 */

import { DEFAULT_CHALLENGE_RATINGS, DIFFICULTY_LEVELS } from '@/sdk';

/** Candidate field names (in priority order) carrying a raw numeric score. */
const SCORE_FIELDS = ['score', 'points', 'totalScore'] as const;

/** Candidate accuracy field names (expected on a 0..1 scale). */
const ACCURACY_FIELDS = ['accuracy', 'hitRate', 'precision'] as const;

/**
 * Candidate reaction-time field names. For each we record whether it is a
 * "best" (lower is better) or "mean" (representative) timing; the extractor
 * returns the most specific available, preferring a mean over a single best.
 */
const REACTION_MEAN_FIELDS = [
  'avgResponseMs',
  'meanReactionMs',
  'avgReactionMs',
  'averageAnswerMs',
  'avgReactionTimeMs',
  'medianReactionMs',
] as const;

const REACTION_BEST_FIELDS = ['fastestReactionMs', 'bestReactionMs', 'fastestResponseMs'] as const;

function readNumber(record: unknown, field: string): number | null {
  if (record == null || typeof record !== 'object') {
    return null;
  }
  const value = (record as Record<string, unknown>)[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Extract a raw score for the session, or `null` when the game does not emit a
 * comparable score (e.g. pure reaction-time games). The value is an absolute
 * score, not normalized — trends are shown as raw numbers.
 */
export function extractScore(rawResult: unknown): number | null {
  for (const field of SCORE_FIELDS) {
    const value = readNumber(rawResult, field);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

/**
 * Extract an accuracy ratio (0..1) or `null` when unavailable. Out-of-range
 * values are clamped to [0, 1] so a malformed payload cannot distort a trend.
 */
export function extractAccuracy(rawResult: unknown): number | null {
  for (const field of ACCURACY_FIELDS) {
    const value = readNumber(rawResult, field);
    if (value !== null) {
      return Math.min(1, Math.max(0, value));
    }
  }
  return null;
}

/**
 * Extract a representative reaction time in milliseconds (mean preferred),
 * or `null` when the game does not emit one.
 */
export function extractReactionMs(rawResult: unknown): number | null {
  for (const field of REACTION_MEAN_FIELDS) {
    const value = readNumber(rawResult, field);
    if (value !== null) {
      return value;
    }
  }
  for (const field of REACTION_BEST_FIELDS) {
    const value = readNumber(rawResult, field);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

/**
 * Extract a difficulty rating in [0, 1] from a session's `difficulty` payload,
 * or `null` when it cannot be interpreted. Recognizes a numeric
 * `challengeRating` (continuous estimate) and the named `DifficultyLevel`
 * strings from the SDK.
 */
export function extractDifficultyRating(difficulty: unknown): number | null {
  if (difficulty == null) {
    return null;
  }
  if (typeof difficulty === 'object') {
    const candidate = (difficulty as Record<string, unknown>).challengeRating;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.min(1, Math.max(0, candidate));
    }
    const level = (difficulty as Record<string, unknown>).level;
    if (typeof level === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(level)) {
      return DEFAULT_CHALLENGE_RATINGS[level as keyof typeof DEFAULT_CHALLENGE_RATINGS] ?? null;
    }
    return null;
  }
  if (typeof difficulty === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(difficulty)) {
    return DEFAULT_CHALLENGE_RATINGS[difficulty as keyof typeof DEFAULT_CHALLENGE_RATINGS] ?? null;
  }
  return null;
}
