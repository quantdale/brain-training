/**
 * Per-game mastery (Campaign 014 W2). Pure engine + versioned semantics;
 * evidence arrives via `SessionRepository.getMasteryInputs()` (one GROUP BY
 * pushdown), so mastery is always a derived view of stored sessions — never
 * independently persisted state.
 */
export {
  computeMastery,
  EXPERT_STRONG_MIN,
  HARD_STRONG_MIN,
  MASTERED_EXPERT_CLEARS,
  MASTERY_TIERS,
  MASTERY_VERSION,
} from "./engine";
export type { MasteryInput, MasterySummary, MasteryTier } from "./engine";
