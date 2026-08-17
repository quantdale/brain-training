/**
 * Scoring + normalization for the Code Cracker game.
 *
 * Raw scoring is game-owned; `normalizeCodeCrackerResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy        = roundsSolved / roundsPlayed            (0..1)
 *   efficiency      = 1 - (totalGuessesUsed / totalGuessesBudget)  (0..1, clamped)
 *   value           = accuracy * (0.5 + 0.5 * efficiency)
 *
 * The blend is multiplicative: accuracy is the base, and efficiency (how few
 * guesses the player used relative to the budget) contributes up to half the
 * value. A player who solves all rounds but uses maximum guesses cannot reach
 * a high normalized score. Difficulty itself is deliberately NOT folded into
 * the value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 *
 * Points:
 *   - Base solve: 100 points
 *   - Bonus for fewer guesses: (budget - guessesUsed) * 10 points
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { CodeCrackerDifficultyParams, CodeCrackerRawResult } from './types';

/** Points for a solved round: 100 base + 10 per unused guess. */
export function roundScore(guessBudget: number, guessesUsed: number): number {
  return 100 + Math.max(0, guessBudget - guessesUsed) * 10;
}

/** Score of a hypothetically perfect session (all rounds solved in 1 guess each). */
export function perfectSessionScore(params: CodeCrackerDifficultyParams): number {
  return params.rounds * (100 + (params.guessBudget - 1) * 10);
}

/** Share of rounds solved; 0 when nothing was played (division guard). */
export function accuracyOf(roundsSolved: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsSolved / roundsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Efficiency relative to the guess budget. 1.0 means every guess was used
 * optimally (solved in minimum guesses); 0.0 means all budget was consumed.
 */
export function efficiency(
  totalGuessesUsed: number,
  totalGuessesBudget: number,
): number {
  if (totalGuessesBudget <= 0) {
    return 0;
  }
  return clamp01(1 - totalGuessesUsed / totalGuessesBudget);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeCodeCrackerResult(
  raw: CodeCrackerRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const acc = accuracyOf(raw.roundsSolved, raw.roundsPlayed);
  const eff = efficiency(raw.totalGuessesUsed, raw.totalGuessesBudget);
  const value = clamp01(acc * (0.5 + 0.5 * eff));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Code Cracker game. */
export const codeCrackerPerformanceNormalizer: PerformanceNormalizer<CodeCrackerRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeCodeCrackerResult,
};
