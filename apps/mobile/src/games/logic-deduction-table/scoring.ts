/**
 * Scoring + normalization for the Deduction Table game.
 *
 * Raw scoring is game-owned; `normalizeLogicDeductionResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsCorrect / roundsPlayed                  (0..1)
 *   speed    = 1 - avg(answerMs / budget) over played rounds  (clamped 0..1)
 *   value    = accuracy * (0.5 + 0.5 * speed)
 *
 * Difficulty itself is deliberately NOT folded into `value` — it is recorded
 * on the raw result / diagnostic metadata so the Phase-2 rating pipeline can
 * weight it.
 */
import type {
 NormalizeContext,
 NormalizedPerformance,
 PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
 LogicDeductionDifficultyParams,
 LogicDeductionRawResult,
} from "./types";

/** Score of a correct round: 100 base + up to 50 speed bonus. */
export function roundScore(answerMs: number, timePerRoundMs: number): number {
 if (timePerRoundMs <= 0) {
  throw new RangeError(
   `roundScore: budget must be positive, got ${timePerRoundMs}`,
  );
 }
 return 100 + Math.round(50 * (1 - clamp01(answerMs / timePerRoundMs)));
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(
 params: LogicDeductionDifficultyParams,
): number {
 return 150 * params.rounds;
}

/** Share of rounds answered correctly; 0 when nothing was played. */
export function accuracyOf(
 roundsCorrect: number,
 roundsPlayed: number,
): number {
 return roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
}

/** Speed component: 1 minus the average per-round time ratio. */
export function speedScoreOf(
 sumAnswerRatio: number,
 roundsPlayed: number,
): number {
 return roundsPlayed > 0 ? clamp01(1 - sumAnswerRatio / roundsPlayed) : 0;
}

/** Clamp to [0, 1]; rejects non-finite input. */
export function clamp01(value: number): number {
 if (!Number.isFinite(value)) {
  throw new RangeError(`normalized performance must be finite, got ${value}`);
 }
 return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeLogicDeductionResult(
 raw: LogicDeductionRawResult,
 _context: NormalizeContext,
): NormalizedPerformance {
 // Bind raw fields to explicit number types so any checker (including ones that
 // resolve through the GameRawResult index signature) sees concrete numbers.
 const { roundsCorrect, roundsPlayed, sumAnswerRatio } = raw as {
  roundsCorrect: number;
  roundsPlayed: number;
  sumAnswerRatio: number;
 };
 const accuracy = accuracyOf(roundsCorrect, roundsPlayed);
 const speed = speedScoreOf(sumAnswerRatio, roundsPlayed);
 const value = clamp01(accuracy * (0.5 + 0.5 * speed));
 return { value, scale: "0..1", raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Deduction Table game. */
export const logicDeductionPerformanceNormalizer: PerformanceNormalizer<LogicDeductionRawResult> =
 {
  gameId: GAME_ID,
  normalize: normalizeLogicDeductionResult,
 };
