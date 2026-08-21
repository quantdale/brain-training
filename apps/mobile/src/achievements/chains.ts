/**
 * Multi-stage achievement chains (engagement V2, campaign 010 / W12).
 *
 * A chain groups an ordered family of existing achievements into one named
 * progression (e.g. the session-count ladder `ach-first → ach-25 → ach-100 →
 * …`). Chains are PURE presentation/logic: every stage is a real definition
 * with its own criteria, unlock, and claim, so no new persistence and no
 * criteria changes are involved — the chain only answers "which stage is the
 * player on, and how far to the next one".
 *
 * Stage ids are validated against the catalog when a chain is resolved (a
 * typo throws immediately instead of silently rendering an empty chain).
 */
import type { AchievementDef, AchievementSnapshot, AchievementTier } from "./types";
import { evaluateAchievementProgress } from "./evaluate";

/** One stage of a chain: the underlying definition plus its 0-based position. */
export interface AchievementChainStage {
  def: AchievementDef;
  /** 0-based position within the chain (definition order). */
  index: number;
}

/** A named multi-stage achievement progression. */
export interface AchievementChain {
  id: string;
  title: string;
  description: string;
  /** Ordered stages; each id must exist in the seeded catalog. */
  stageIds: readonly string[];
}

/**
 * Presentational progress for one chain against a snapshot. `currentStage`
 * is the first incomplete stage (null when every stage is complete);
 * `nextRatio` mirrors that stage's clamped 0..1 progress.
 */
export interface AchievementChainProgress {
  chainId: string;
  title: string;
  totalStages: number;
  completedStages: number;
  currentStage: AchievementChainStage | null;
  nextRatio: number;
  /** True when every stage's criteria are met. */
  complete: boolean;
}

export const ACHIEVEMENT_CHAINS: readonly AchievementChain[] = [
  Object.freeze({
    id: "chain-sessions",
    title: "Session Ladder",
    description: "From your very first session to a lifetime of training.",
    stageIds: ["ach-first", "ach-25", "ach-100", "ach-250", "ach-500", "ach-1000", "ach-2500"],
  } satisfies AchievementChain),
  Object.freeze({
    id: "chain-xp",
    title: "XP Ascent",
    description: "Grow lifetime XP from voyager to grandmaster.",
    stageIds: ["ach-xp-5000", "ach-xp-25000", "ach-xp-75000", "ach-xp-150000"],
  } satisfies AchievementChain),
  Object.freeze({
    id: "chain-streak",
    title: "Streak Forge",
    description: "Keep the streak alive from one week to one hundred days.",
    stageIds: ["ach-streak-7", "ach-streak-30", "ach-streak-100"],
  } satisfies AchievementChain),
  Object.freeze({
    id: "chain-active-days",
    title: "Habit Builder",
    description: "Show up on more and more distinct days.",
    stageIds: ["ach-active-7", "ach-active-30", "ach-active-100"],
  } satisfies AchievementChain),
  Object.freeze({
    id: "chain-perfect",
    title: "Precision Path",
    description: "Stack high-performance sessions.",
    stageIds: ["ach-perfect-10", "ach-perfect-50"],
  } satisfies AchievementChain),
];

/** Presentation order for tiers (bronze first). Unknown tiers sort last. */
export const TIER_ORDER: readonly AchievementTier[] = ["bronze", "silver", "gold", "platinum"];

/** Ordinal rank of a tier (higher = rarer); unknown tiers rank -1. */
export function tierRank(tier: AchievementTier): number {
  const index = TIER_ORDER.indexOf(tier);
  return index;
}

/** Build the per-chain stage lists from a definition catalog. */
function stagesFor(chain: AchievementChain, byId: Map<string, AchievementDef>): AchievementChainStage[] {
  const stages: AchievementChainStage[] = [];
  chain.stageIds.forEach((id, index) => {
    const def = byId.get(id);
    if (!def) {
      throw new Error(`achievement chain "${chain.id}" references unknown achievement "${id}"`);
    }
    stages.push({ def, index });
  });
  return stages;
}

/**
 * Resolve one chain's progress. Deterministic: same definitions + snapshot,
 * same result. Stages whose criteria are met count as completed even when
 * their reward is still unclaimed (completion is about the criteria).
 */
export function resolveChainProgress(
  chain: AchievementChain,
  definitions: readonly AchievementDef[],
  snapshot: AchievementSnapshot,
): AchievementChainProgress {
  const byId = new Map(definitions.map((def) => [def.id, def]));
  const stages = stagesFor(chain, byId);
  let completedStages = 0;
  let currentStage: AchievementChainStage | null = null;
  let nextRatio = 1;
  for (const stage of stages) {
    const progress = evaluateAchievementProgress(stage.def, snapshot);
    if (progress.completed) {
      completedStages += 1;
    } else if (currentStage === null) {
      currentStage = stage;
      nextRatio = progress.ratio;
    }
  }
  return {
    chainId: chain.id,
    title: chain.title,
    totalStages: stages.length,
    completedStages,
    currentStage,
    nextRatio,
    complete: currentStage === null && stages.length > 0,
  };
}
