/**
 * Pipeline-backed optimistic XP hook (057-result-reward-correctness).
 *
 * `computeXp` is exactly the rating pipeline's function applied to the
 * normalized value and the record's difficulty level, so the first rendered
 * reward already equals the authoritative `storedXp` the DB pipeline will
 * persist for the same record (`computeRatingOutcome`: XP =
 * `computeXp(clamp01(normalizedResult), difficultyLevel)`; the normalizer
 * contract guarantees a finite [0,1] value, making the clamp identity).
 *
 * Rating deltas are intentionally empty here: screens render deltas only
 * from the authoritative `completionOutcome` (which needs registry domains
 * plus challenge plumbing). No screen renders pre-persist deltas, so nothing
 * observable is lost; the DB outcome confirms rather than corrects.
 */
import type {
  NormalizedPerformance,
  XpRatingContext,
  XpRatingHook,
} from "@/sdk";
import { computeXp } from "./pipeline";

export const pipelineXpRatingHook: XpRatingHook = {
  computeXp: (performance: NormalizedPerformance, context: XpRatingContext) =>
    computeXp(performance.value, context.difficulty),
  computeRatingDeltas: () => [],
};
