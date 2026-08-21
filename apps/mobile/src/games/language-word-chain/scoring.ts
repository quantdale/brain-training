/**
 * Scoring + normalization for the Word Chain game.
 *
 * Raw scoring is game-owned; `normalizeWordChainResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy    = roundsCorrect / roundsPlayed                   (0..1)
 *   speedScore  = 1 - avg(stepAnswerMs / budget) over played steps (clamped 0..1)
 *   value       = accuracy * (0.5 + 0.5 * speedScore)
 *
 * `stepAnswerMs / budget` is clamped to [0, 1] per step (timeout steps
 * record exactly the budget → ratio 1), so `speedScore` is 1 for instant
 * answers and 0 for answers that consumed the whole budget. The blend is
 * multiplicative: accuracy is the base and speed contributes up to half the
 * value, so a player who only answers slowly cannot reach a high normalized
 * score. Difficulty itself is deliberately NOT folded into the value — it is
 * recorded on the raw result / diagnostic metadata so the Phase-2 rating
 * pipeline can weight it.
 */
import type {
 NormalizeContext,
 NormalizedPerformance,
 PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
 LanguageWordChainRawResult,
 WordChainDifficultyParams,
} from "./types";

/** Extra points awarded for completing a whole chain correctly. */
export const FULL_CHAIN_BONUS = 10;

/** Base points for a correct step. */
export const PER_STEP_BASE = 10;

/** Max speed bonus on top of the base for an instant step. */
export const PER_STEP_MAX_SPEED = 5;

/**
 * Score of a correct step: base + up to `PER_STEP_MAX_SPEED` bonus scaled by
 * how much of the budget remained. Instant answer → 15; answer at the budget
 * → 10. Wrong/timeout steps score 0.
 */
export function stepScore(answerMs: number, timePerRoundMs: number): number {
 if (timePerRoundMs <= 0) {
  throw new RangeError(
   `stepScore: budget must be positive, got ${timePerRoundMs}`,
  );
 }
 return (
  PER_STEP_BASE +
  Math.round(PER_STEP_MAX_SPEED * (1 - clamp01(answerMs / timePerRoundMs)))
 );
}

/** Perfect score of a session: max step points + full-chain bonus per chain. */
export function perfectSessionScore(params: WordChainDifficultyParams): number {
 return (
  params.rounds *
  (params.maxBlanks * (PER_STEP_BASE + PER_STEP_MAX_SPEED) + FULL_CHAIN_BONUS)
 );
}

/** Share of chains answered correctly; 0 when nothing was played. */
export function accuracyOf(
 roundsCorrect: number,
 roundsPlayed: number,
): number {
 return roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
}

/** Speed component: 1 minus the average per-step time ratio. */
export function speedScoreOf(
 sumAnswerRatio: number,
 stepsPlayed: number,
): number {
 return stepsPlayed > 0 ? clamp01(1 - sumAnswerRatio / stepsPlayed) : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
 if (!Number.isFinite(value)) {
  throw new RangeError(`normalized performance must be finite, got ${value}`);
 }
 return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeWordChainResult(
 raw: LanguageWordChainRawResult,
 _context: NormalizeContext,
): NormalizedPerformance {
 const accuracy = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
 const speed = speedScoreOf(raw.sumAnswerRatio, raw.stepsPlayed);
 const value = clamp01(accuracy * (0.5 + 0.5 * speed));
 return { value, scale: "0..1", raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Word Chain game. */
export const wordChainPerformanceNormalizer: PerformanceNormalizer<LanguageWordChainRawResult> =
 {
  gameId: GAME_ID,
  normalize: normalizeWordChainResult,
 };
