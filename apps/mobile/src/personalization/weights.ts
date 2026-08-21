/**
 * Transparent signal weights for Advanced Personalization V2.
 *
 * The recommendation score of a game is the SUM of `weight × value` over its
 * active signals, where every signal value lies in [0, 1] (see `signals.ts`).
 * The table below is the complete, documented tuning surface: changing any
 * number here changes recommendations predictably and is auditable in one
 * place. Bump {@link PERSONALIZATION_VERSION} when the table's meaning (not
 * just its numbers) changes so persisted diagnostics stay interpretable.
 *
 * Positive weights BOOST a game; negative weights DEMOTE it. Weights are
 * deliberately coarse (one decimal) — this is a transparent preference layer,
 * not a model.
 */

import type { SignalKey } from './types';

/**
 * Version of the scoring rule (weights + signal definitions). V2 is the
 * weighted-component rewrite of the original weak/stale/recency reorder;
 * the workout reorder itself keeps its pinned legacy behavior and does not
 * depend on this version.
 */
export const PERSONALIZATION_VERSION = 2;

/**
 * Signed weight per signal. Rationale, in priority order:
 *
 * - `weak-domain` (+1.0): an actively declined domain is the strongest
 *   retargeting evidence (constitution §14). Largest single boost.
 * - `undertrained-domain` (+0.6): little evidence in a domain — worth
 *   surfacing, but weaker than demonstrated decline.
 * - `stale-domain` (+0.5): a rusty domain deserves re-training (§15), but a
 *   strong-and-rusty domain must not outrank genuine weakness.
 * - `novelty` (+0.4): discovery boost for rarely played games (§21).
 * - `performance-trend` (+0.4): improving recent form — momentum worth
 *   reinforcing while it lasts.
 * - `personal-best-proximity` (+0.3): a record within reach is motivating.
 * - `difficulty-fit` (+0.3): results in the productive middle band mean the
 *   current challenge level fits; keep playing at that edge.
 * - `overexposure` (−0.8): the strongest dampener — a game that dominated
 *   recent history should step aside even if its other signals are good.
 * - `composition-fit` (−0.6 per repeat): selection-time penalty applied by
 *   `selectRecommendations` for each already-picked game of the same primary
 *   category, so one picked set spreads across domains (§14 diversity).
 */
export const SIGNAL_WEIGHTS: Readonly<Record<SignalKey, number>> = {
  'weak-domain': 1,
  'undertrained-domain': 0.6,
  'stale-domain': 0.5,
  novelty: 0.4,
  'performance-trend': 0.4,
  'personal-best-proximity': 0.3,
  'difficulty-fit': 0.3,
  overexposure: -0.8,
  'composition-fit': -0.6,
};

/** Sum of positive weights — the maximum achievable static score. */
export const MAX_POSITIVE_SCORE = Object.values(SIGNAL_WEIGHTS)
  .filter((weight) => weight > 0)
  .reduce((sum, weight) => sum + weight, 0);

/**
 * Magnitude of the largest negative weight — used to map raw scores into a
 * stable [0, 1] band (`score01`). Selection-time composition penalties can
 * push a score below this static floor; `score01` clamps at 0 there.
 */
export const MAX_NEGATIVE_SCORE = Math.abs(
  Object.values(SIGNAL_WEIGHTS)
    .filter((weight) => weight < 0)
    .reduce((sum, weight) => sum + weight, 0),
);
