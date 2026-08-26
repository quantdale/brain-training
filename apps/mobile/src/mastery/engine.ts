/**
 * Per-game mastery (Campaign 014 W2): a capability/completion-depth ladder
 * derived from ALREADY-STORED session evidence. This is deliberately NOT a
 * second XP number: every tier transition names its concrete milestone
 * ("clear Expert twice"), so a player can always answer what the label means
 * and exactly what to do next.
 *
 * Semantics are versioned via {@link MASTERY_VERSION}. The tier is a pure
 * function of the {@link MasteryInput} aggregate row — no persistence of its
 * own, so backup/restore/wipe can never desync it and long-history cost is a
 * single GROUP BY pushdown (see `SessionRepository.getMasteryInputs`).
 */

/** Version of the tier semantics. Bump when milestone thresholds change. */
export const MASTERY_VERSION = 1;

/** Aggregate evidence for one game, straight from the sessions table. */
export interface MasteryInput {
  readonly gameId: string;
  readonly sessions: number;
  /** Best normalized performance ever (0..1). */
  readonly bestNormalized: number;
  /** Mean normalized performance (0..1). */
  readonly avgNormalized: number;
  /** Sessions at `hard` difficulty with normalized ≥ HARD_STRONG_MIN. */
  readonly hardStrong: number;
  /** Sessions at `expert` difficulty with normalized ≥ EXPERT_STRONG_MIN. */
  readonly expertStrong: number;
  /** Unix epoch ms of the most recent session (0 = never). */
  readonly lastCompletedAt: number;
}

/** Ordered capability ladder (index === rank). */
export const MASTERY_TIERS = [
  "unplayed",
  "learning",
  "developing",
  "proficient",
  "advanced",
  "mastered",
] as const;

export type MasteryTier = (typeof MASTERY_TIERS)[number];

/** A `hard` clear only counts toward mastery at this normalized floor. */
export const HARD_STRONG_MIN = 0.6;
/** An `expert` clear only counts toward mastery at this normalized floor. */
export const EXPERT_STRONG_MIN = 0.65;
/** Minimum strong Expert clears for the top tier. */
export const MASTERED_EXPERT_CLEARS = 2;

/** One row per game with its tier plus the concrete next milestone. */
export interface MasterySummary {
  readonly gameId: string;
  readonly tier: MasteryTier;
  /** Rank index into {@link MASTERY_TIERS} (0..5). */
  readonly rank: number;
  /**
   * Human-readable next milestone, phrased from stored counts only — e.g.
   * "Win 2 more Hard rounds" or "Clear Expert once". Null when mastered.
   */
  readonly nextMilestone: string | null;
  /** Evidence snapshot used for the decision (debug/QA + Progress detail). */
  readonly evidence: MasteryInput;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Pure tier decision. First matching rule wins; the ordering encodes intent:
 * volume gates first (a handful of sessions is never "proficient" no matter
 * how lucky), then the strongest evidence (Expert clears), then consistent
 * Hard performance.
 */
export function computeMastery(input: MasteryInput): MasterySummary {
  const { sessions, bestNormalized, avgNormalized, hardStrong, expertStrong } =
    input;

  let tier: MasteryTier;
  if (sessions === 0) {
    tier = "unplayed";
  } else if (sessions < 5 || bestNormalized < 0.5) {
    tier = "learning";
  } else if (expertStrong >= MASTERED_EXPERT_CLEARS && bestNormalized >= 0.8) {
    tier = "mastered";
  } else if (expertStrong >= 1 || (hardStrong >= 4 && avgNormalized >= 0.75)) {
    tier = "advanced";
  } else if (hardStrong >= 2 || (sessions >= 8 && avgNormalized >= 0.7)) {
    tier = "proficient";
  } else {
    tier = "developing";
  }

  return {
    gameId: input.gameId,
    tier,
    rank: MASTERY_TIERS.indexOf(tier),
    nextMilestone: nextMilestoneFor(tier, input),
    evidence: input,
  };
}

/** Concrete, count-based next step for the tier below each boundary. */
function nextMilestoneFor(tier: MasteryTier, input: MasteryInput): string | null {
  const {
    sessions,
    bestNormalized,
    avgNormalized,
    hardStrong,
    expertStrong,
  } = input;
  switch (tier) {
    case "unplayed":
      return "Play your first round";
    case "learning": {
      if (bestNormalized < 0.5 && sessions >= 5) {
        return "Reach 50% on any round";
      }
      return `Play ${plural(5 - sessions, "more session")} to leave the basics`;
    }
    case "developing": {
      if (hardStrong < 2) {
        return `Win ${plural(2 - hardStrong, "more Hard round")} to reach Proficient`;
      }
      return `Lift your average to 70% (${Math.round(avgNormalized * 100)}% now)`;
    }
    case "proficient": {
      if (expertStrong < 1) {
        return "Clear Expert once to reach Advanced";
      }
      return `Win ${plural(4 - hardStrong, "more Hard round")} with a 75% average`;
    }
    case "advanced": {
      const clearsLeft = Math.max(0, MASTERED_EXPERT_CLEARS - expertStrong);
      if (clearsLeft > 0) {
        return `Clear Expert ${plural(clearsLeft, "more time")} for Mastery`;
      }
      return "Push an Expert run to 80% for Mastery";
    }
    case "mastered":
      return null;
  }
}
