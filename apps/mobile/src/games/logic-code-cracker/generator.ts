/**
 * Deterministic code generation and feedback oracle for the Code Cracker game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Codes come from a per-round
 * RNG fork and are random permutations of color indices (colors may repeat
 * within a code, so it's sampling with replacement).
 *
 * The feedback oracle is a pure function: given a secret code and a guess,
 * it returns exact + color-only counts. The oracle is consistent and
 * deterministic — the same inputs always produce the same output.
 *
 * Near-duplicate avoidance: consecutive rounds that have very similar codes
 * are confusable, so a candidate is re-drawn with an incremented attempt salt
 * until its distance from the previous round's code is at least
 * `MIN_CODE_HAMMING_DISTANCE` (or the budget is exhausted). Every step is
 * deterministic — the same seed always yields the same session.
 */
import type { Rng } from '@/sdk';

import type { GuessFeedback } from './types';

/** Minimum distance between a round's code and the previous round's. */
export const MIN_CODE_HAMMING_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_CODE_ATTEMPTS = 12;

export interface GenerateCodeInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly codeLength: number;
  readonly colorCount: number;
  /** Previous round's secret code, or null for round 0. */
  readonly prevSecretCode: readonly number[] | null;
}

/**
 * Generate a secret code for one round. Colors are sampled with replacement
 * (repeats are allowed) from [0, colorCount).
 *
 * The code is generated via a per-round RNG fork so changing the seed of
 * one round does not affect others.
 */
export function generateSecretCode(input: GenerateCodeInput): number[] {
  const { rng, roundIndex, codeLength, colorCount, prevSecretCode } = input;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate: number[] = [];
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    for (let i = 0; i < codeLength; i += 1) {
      candidate.push(fork.nextInt(colorCount));
    }
    if (!isNearDuplicate(candidate, prevSecretCode)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  const fallback: number[] = [];
  const fork = rng.fork(`round:${roundIndex}:attempt:${MAX_CODE_ATTEMPTS - 1}`);
  for (let i = 0; i < codeLength; i += 1) {
    fallback.push(fork.nextInt(colorCount));
  }
  return fallback;
}

/**
 * Compute the feedback for a guess against the secret code.
 *
 * Oracle rules:
 * - Exact match: same color in same position.
 * - Color-only: same color in a different position, but each color in the
 *   secret can only be counted once across all feedback pegs.
 * - Order of evaluation: exact matches are counted first, then color-only
 *   matches are counted from the remaining unmatched positions.
 *
 * This oracle is consistent: the same (secret, guess) pair always produces
 * the same feedback, and the feedback is invertible in the sense that if
 * the oracle says "3 exact, 0 color-only" for a 4-peg code, you know at
 * least 3 pegs are correct.
 */
export function computeFeedback(
  secret: readonly number[],
  guess: readonly number[],
): GuessFeedback {
  if (secret.length !== guess.length) {
    throw new Error(
      `computeFeedback: secret length ${secret.length} !== guess length ${guess.length}`,
    );
  }

  const len = secret.length;
  // Track which positions have been matched (exact or color-only).
  const secretMatched = new Array<boolean>(len).fill(false);
  const guessMatched = new Array<boolean>(len).fill(false);

  let exact = 0;

  // Pass 1: count exact matches.
  for (let i = 0; i < len; i += 1) {
    if (secret[i] === guess[i]) {
      exact += 1;
      secretMatched[i] = true;
      guessMatched[i] = true;
    }
  }

  // Pass 2: count color-only matches (greedy, each color counted once).
  let colorOnly = 0;
  for (let i = 0; i < len; i += 1) {
    if (guessMatched[i]) {
      continue;
    }
    for (let j = 0; j < len; j += 1) {
      if (secretMatched[j]) {
        continue;
      }
      if (guess[i] === secret[j]) {
        colorOnly += 1;
        guessMatched[i] = true;
        secretMatched[j] = true;
        break;
      }
    }
  }

  return { exact, colorOnly };
}

/**
 * Brute-force oracle for cross-checking the optimized oracle in tests.
 * Same semantics, different implementation — exhaustive counting approach.
 */
export function bruteForceFeedback(
  secret: readonly number[],
  guess: readonly number[],
): GuessFeedback {
  if (secret.length !== guess.length) {
    throw new Error('length mismatch');
  }
  const len = secret.length;

  // Count exact matches.
  // Size the arrays to cover all possible color indices.
  const maxColor = Math.max(0, ...secret, ...guess) + 1;
  const exactCounts = new Array<number>(maxColor).fill(0);
  const guessCounts = new Array<number>(maxColor).fill(0);
  let exact = 0;
  for (let i = 0; i < len; i += 1) {
    if (secret[i] === guess[i]) {
      exact += 1;
    } else {
      // Count unmatched colors for color-only calculation.
      exactCounts[secret[i]] += 1;
      guessCounts[guess[i]] += 1;
    }
  }

  // Color-only: min of unmatched counts for each color.
  let colorOnly = 0;
  for (let c = 0; c < exactCounts.length; c += 1) {
    if (exactCounts[c] > 0 && guessCounts[c] > 0) {
      colorOnly += Math.min(exactCounts[c], guessCounts[c]);
    }
  }

  return { exact, colorOnly };
}

/**
 * Hamming-style distance between two codes: absolute length difference
 * plus the number of positions where the colors differ. `null` previous
 * code (round 0) counts as infinitely far.
 */
export function codeDistance(
  a: readonly number[],
  b: readonly number[] | null,
): number {
  if (b === null) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = Math.abs(a.length - b.length);
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

/** True when `a` is confusable with `b` (too similar to the previous round). */
export function isNearDuplicate(
  a: readonly number[],
  b: readonly number[] | null,
): boolean {
  if (b === null || b.length < 2) {
    return false;
  }
  return codeDistance(a, b) < MIN_CODE_HAMMING_DISTANCE;
}
