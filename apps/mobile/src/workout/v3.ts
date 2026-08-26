/**
 * Workout V3 — signal-ranked ordering over the deterministic base selection
 * (Campaign 014 W4).
 *
 * V2 established the architecture this layer completes: the DAILY member set
 * stays fully deterministic (`today.ts` chain + reroll seeds), and
 * personalization only ever REORDERS that set. V2 reordered by three coarse
 * tiers (weak domain → stale domain → recency tail). The Advanced
 * Personalization V2 kernel (`src/personalization`) already computed a much
 * richer transparent signal set — undertrained domains, novelty, performance
 * trend, personal-best proximity, difficulty fit, overexposure — but was
 * never wired into production selection.
 *
 * V3 wires it in WITHOUT touching selection semantics:
 * - The base member list is unchanged (chain avoidance, reroll economics,
 *   exclude handling all keep their pinned behavior and tests).
 * - Ordering re-ranks those members by the weighted signal sum (stable sort,
 *   ties keep the V2 order), so a player sees the most evidence-relevant
 *   game first while the workout's composition stays reproducible.
 * - Every ordering decision carries its truthful reason string straight from
 *   the kernel's formatters — no invented explanations, no pseudo-AI prose.
 *
 * Pure module: callers pass repository rows + an injected clock. No db, no
 * wall-clock reads, no randomness.
 */
import type { GameDefinition } from "@/sdk";
import {
  buildPersonalizationContext,
  type PersonalizationContextArgs,
} from "@/personalization/context";
import { scoreGames } from "@/personalization/scoring";
import type { PersonalizationContext, SignalKey } from "@/personalization/types";
import type { WorkoutSelectionReason } from "./personalize";

export type { PersonalizationContextArgs };

/** Build the immutable evidence snapshot for one selection pass. */
export function buildWorkoutV3Context(
  args: PersonalizationContextArgs,
): PersonalizationContext {
  return buildPersonalizationContext(args);
}

/**
 * Stable descending-score order over the BASE members. Input order survives
 * as the tie-break, so equal-evidence games keep their seeded positions and
 * an empty/absent context degrades to the input order unchanged.
 */
export function orderDailyBySignals(
  base: readonly GameDefinition[],
  context: PersonalizationContext | null,
): GameDefinition[] {
  if (!context || base.length <= 1) {
    return [...base];
  }
  const scored = scoreGames(base, context);
  return scored
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) => b.entry.score - a.entry.score || a.index - b.index,
    )
    .map(({ entry }) => entry.game);
}

/**
 * Signal-key → recorded-reason kind. Kinds extend the V2 vocabulary; see
 * `metadata.ts` (WORKOUT_METADATA_VERSION 2 records the extension).
 */
const SIGNAL_REASON_KIND: Record<
  SignalKey,
  WorkoutSelectionReason["kind"]
> = {
  "weak-domain": "weak-domain",
  "undertrained-domain": "undertrained-domain",
  "stale-domain": "stale-domain",
  novelty: "novelty",
  "performance-trend": "performance-trend",
  "personal-best-proximity": "personal-best-proximity",
  "difficulty-fit": "difficulty-fit",
  overexposure: "overexposure",
  "composition-fit": "selected",
};

/**
 * Explain an ordered list in final order using the same context the ordering
 * used (so reasons can never drift from the arrangement they describe). The
 * top active component supplies both the kind and the instance-specific
 * detail; games whose evidence is silent record the honest fallback
 * ("balanced selection") rather than an invented reason.
 */
export function explainSignalOrder(
  ordered: readonly GameDefinition[],
  context: PersonalizationContext | null,
  isExcluded?: (gameId: string) => boolean,
): WorkoutSelectionReason[] {
  if (!context) {
    return ordered.map((game) => ({
      gameId: game.id,
      kind: "selected",
      detail: "balanced selection",
    }));
  }
  const scored = new Map(
    scoreGames(ordered, context).map((entry) => [entry.game.id, entry]),
  );
  return ordered.map((game) => {
    if (isExcluded?.(game.id)) {
      return {
        gameId: game.id,
        kind: "excluded",
        detail: "excluded (already played)",
      };
    }
    const top = scored.get(game.id)?.components[0];
    if (!top) {
      return {
        gameId: game.id,
        kind: "selected",
        detail: "balanced selection",
      };
    }
    return {
      gameId: game.id,
      kind: SIGNAL_REASON_KIND[top.key],
      detail: top.reason,
    };
  });
}
