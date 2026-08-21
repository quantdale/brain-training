import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { ContextFitDifficultyParams, ContextFitRawResult } from './types';

export function roundScore(answerMs: number, timePerRoundMs: number): number {
  if (timePerRoundMs <= 0) throw new RangeError(`roundScore: budget must be positive, got ${timePerRoundMs}`);
  return 100 + Math.round(50 * (1 - clamp01(answerMs / timePerRoundMs)));
}

export function perfectSessionScore(params: ContextFitDifficultyParams): number {
  return 150 * params.rounds;
}

export function accuracyOf(roundsCorrect: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
}

export function speedScoreOf(sumAnswerRatio: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? clamp01(1 - sumAnswerRatio / roundsPlayed) : 0;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`normalized performance must be finite, got ${value}`);
  return Math.min(1, Math.max(0, value));
}

export function normalizeContextFitResult(
  raw: ContextFitRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
  const speed = speedScoreOf(raw.sumAnswerRatio, raw.roundsPlayed);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

export const contextFitPerformanceNormalizer: PerformanceNormalizer<ContextFitRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeContextFitResult,
};
