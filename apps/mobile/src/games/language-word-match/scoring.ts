/**
 * Scoring + normalization for the Word Match game.
 *
 * Raw scoring is game-owned; `normalizeLanguageResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy    = roundsCorrect / roundsPlayed                   (0..1)
 *   speedScore  = 1 - avg(answerMs / budget) over played rounds  (clamped 0..1)
 *   value       = accuracy * (0.5 + 0.5 * speedScore)
 *
 * `answerMs / budget` is clamped to [0, 1] per round (timeout rounds record
 * exactly the budget → ratio 1), so `speedScore` is 1 for instant answers and
 * 0 for answers that consumed the whole budget. The blend is multiplicative:
 * accuracy is the base and speed contributes up to half the value, so a
 * player who only answers slowly cannot reach a high normalized score.
 * Difficulty itself is deliberately NOT folded into the value — it is
 * recorded on the raw result / diagnostic metadata so the Phase-2 rating
 * pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { LanguageDifficultyParams, LanguageRawResult } from './types';

/**
 * Score of a correct round: 100 base + up to 50 speed bonus scaled by how
 * much of the budget remained. Instant answer → 150; answer at the budget
 * → 100. Wrong/timeout rounds score 0.
 */
export function roundScore(answerMs: number, timePerRoundMs: number): number {
  if (timePerRoundMs <= 0) {
    throw new RangeError(`roundScore: budget must be positive, got ${timePerRoundMs}`);
  }
  return 100 + Math.round(50 * (1 - clamp01(answerMs / timePerRoundMs)));
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(params: LanguageDifficultyParams): number {
  return 150 * params.rounds;
}

/** Share of rounds answered correctly; 0 when nothing was played. */
export function accuracyOf(roundsCorrect: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
}

/**
 * Speed component: 1 minus the average per-round time ratio. Instant answers
 * → 1; answers consuming the full budget (or timeouts) → 0.
 */
export function speedScoreOf(sumAnswerRatio: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? clamp01(1 - sumAnswerRatio / roundsPlayed) : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeLanguageResult(
  raw: LanguageRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
  const speed = speedScoreOf(raw.sumAnswerRatio, raw.roundsPlayed);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Word Match game. */
export const languagePerformanceNormalizer: PerformanceNormalizer<LanguageRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeLanguageResult,
};
