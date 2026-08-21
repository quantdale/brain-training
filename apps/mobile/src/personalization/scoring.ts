/**
 * Weighted-component scoring pipeline for Advanced Personalization V2.
 *
 * Pipeline: evidence (`context.ts`) → signals (`signals.ts`) → transparent
 * weighted sum (`weights.ts`) → ranked recommendations WITH per-component
 * reasons. Every recommendation carries its full breakdown, so any score can
 * be audited down to "signal X contributed w×v because <reason>".
 *
 * Determinism: no randomness anywhere. Equal scores keep input order (stable
 * sort), so the same inputs + injected clock always yield the same output.
 * The optional clock only gates the staleness signal; every other signal is
 * clock-free by design.
 */

import { clamp01 } from '@/rating/pipeline';
import type { GameDefinition } from '@/sdk';

import {
  formatCompositionFitDetail,
  formatDifficultyFitDetail,
  formatNoveltyDetail,
  formatOverexposureDetail,
  formatPersonalBestProximityDetail,
  formatStaleDomainDetail,
  formatTrendDetail,
  formatUndertrainedDetail,
  formatWeakDomainDetail,
} from './explain';
import {
  computeDomainSignals,
  computeGameEvidence,
  difficultyFitValue,
  fatigueValue,
  FATIGUE_RECENT_SESSIONS,
  noveltyValue,
  personalBestProximityValue,
  trendValue,
  undertrainingValue,
  type DomainSignalSummary,
} from './signals';
import type {
  PersonalizationContext,
  SignalKey,
} from './types';
import {
  MAX_NEGATIVE_SCORE,
  MAX_POSITIVE_SCORE,
  SIGNAL_WEIGHTS,
} from './weights';

/** One active signal's transparent contribution to a game's score. */
export interface RecommendationComponent {
  key: SignalKey;
  /** Published weight (signed) from `SIGNAL_WEIGHTS`. */
  weight: number;
  /** Signal strength in [0, 1] (see `signals.ts`). */
  value: number;
  /** `weight × value` — the exact amount added to the score. */
  contribution: number;
  /** Human-readable, instance-specific reason string. */
  reason: string;
}

/** A fully explained recommendation for one game. */
export interface ScoredRecommendation {
  game: GameDefinition;
  /**
   * Final weighted score. From `scoreGames`/`rankRecommendations` this is the
   * static signal sum; from `selectRecommendations` it additionally includes
   * any selection-time `composition-fit` penalty applied when the game was
   * picked.
   */
  score: number;
  /** `score` mapped into [0, 1] across the achievable static band. */
  score01: number;
  /** Active components only (value > 0), in documented priority order. */
  components: RecommendationComponent[];
}

/**
 * Score one game against the context. `domainSignals` may be precomputed once
 * per pass (see {@link scoreGames}); it is computed on demand otherwise.
 * Pure and deterministic.
 */
export function scoreGame(
  game: GameDefinition,
  context: PersonalizationContext,
  domainSignals?: ReadonlyMap<string, DomainSignalSummary>,
): ScoredRecommendation {
  const signals =
    domainSignals ??
    computeDomainSignals([...context.ratingByDomain.values()], {
      nowMs: context.nowMs ?? undefined,
      staleDays: context.staleDays,
    });
  const summary = signals.get(game.primaryCategory);
  const evidence = computeGameEvidence(game.id, context);

  const components: RecommendationComponent[] = [];
  const push = (
    key: SignalKey,
    value: number,
    reason: string,
  ): void => {
    if (value <= 0) {
      return; // no evidence ⇒ no component ⇒ no invented reason
    }
    const weight = SIGNAL_WEIGHTS[key];
    components.push({
      key,
      weight,
      value,
      contribution: weight * value,
      reason,
    });
  };

  // Components are pushed in the documented priority order (weights.ts).
  if (summary?.weak) {
    push('weak-domain', summary.weakness, formatWeakDomainDetail(
      summary.domain,
      summary.rating,
    ));
  }
  push(
    'undertrained-domain',
    undertrainingValue(summary),
    formatUndertrainedDetail(
      game.primaryCategory,
      summary ? summary.sessions : 0,
    ),
  );
  if (summary?.stale) {
    push('stale-domain', summary.staleness, formatStaleDomainDetail(
      summary.domain,
      summary.rating,
      summary.daysSinceUpdate ?? 0,
    ));
  }
  const novelty = noveltyValue(evidence);
  if (novelty > 0) {
    push('novelty', novelty, formatNoveltyDetail(evidence.lifetimeSessions));
  }
  const trend = trendValue(evidence);
  if (trend > 0 && evidence.recentFormNormalized !== null && evidence.lifetimeAvgNormalized !== null) {
    push('performance-trend', trend, formatTrendDetail(
      evidence.recentFormNormalized,
      evidence.lifetimeAvgNormalized,
    ));
  }
  const proximity = personalBestProximityValue(evidence);
  if (proximity > 0 && evidence.bestNormalized !== null && evidence.recentBestNormalized !== null) {
    push('personal-best-proximity', proximity, formatPersonalBestProximityDetail(
      evidence.bestNormalized - evidence.recentBestNormalized,
    ));
  }
  const fit = difficultyFitValue(evidence);
  if (fit > 0 && evidence.recentFormNormalized !== null) {
    push('difficulty-fit', fit, formatDifficultyFitDetail(
      evidence.recentFormNormalized,
    ));
  }
  const fatigue = fatigueValue(evidence);
  if (fatigue > 0) {
    push('overexposure', fatigue, formatOverexposureDetail(
      evidence.recentPlays,
      Math.min(FATIGUE_RECENT_SESSIONS, context.recentSessions.length),
    ));
  }

  const score = components.reduce((sum, c) => sum + c.contribution, 0);
  const score01 = clamp01(
    (score + MAX_NEGATIVE_SCORE) / (MAX_POSITIVE_SCORE + MAX_NEGATIVE_SCORE),
  );

  return { game, score, score01, components };
}

/**
 * Score every game, sharing one domain-signal computation across the pass.
 * Output preserves input order (use {@link rankRecommendations} to sort).
 */
export function scoreGames(
  games: readonly GameDefinition[],
  context: PersonalizationContext,
): ScoredRecommendation[] {
  const domainSignals = computeDomainSignals(
    [...context.ratingByDomain.values()],
    { nowMs: context.nowMs ?? undefined, staleDays: context.staleDays },
  );
  return games.map((game) => scoreGame(game, context, domainSignals));
}

/**
 * Score and sort by score descending; equal scores keep input order (stable,
 * deterministic). The input array is never mutated.
 */
export function rankRecommendations(
  games: readonly GameDefinition[],
  context: PersonalizationContext,
): ScoredRecommendation[] {
  return scoreGames(games, context)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.score - a.entry.score || a.index - b.index)
    .map(({ entry }) => entry);
}

/**
 * Selection-time diversity penalty applied per already-picked game of the
 * same primary category (weight published as `composition-fit`). Chosen so a
 * second same-category pick must beat alternatives by a clear margin, while a
 * genuinely dominant game can still win two slots.
 */
export const COMPOSITION_REPEAT_PENALTY = SIGNAL_WEIGHTS['composition-fit'];

/**
 * Greedily select up to `count` recommendations with workout-composition fit:
 * each pick is penalized by {@link COMPOSITION_REPEAT_PENALTY} for every
 * already-picked game sharing its `primaryCategory`, so a chosen set spreads
 * across domains (constitution §14). Ties break toward earlier input order.
 *
 * Returned entries carry the composition penalty INSIDE their `score`/
 * `score01` and an explicit `composition-fit` component whenever one was
 * applied, keeping every pick fully explainable. Deterministic.
 */
export function selectRecommendations(
  games: readonly GameDefinition[],
  context: PersonalizationContext,
  count: number,
): ScoredRecommendation[] {
  if (count <= 0 || games.length === 0) {
    return [];
  }

  const pool = scoreGames(games, context);
  const picked: ScoredRecommendation[] = [];
  const categoryCounts = new Map<string, number>();

  while (picked.length < Math.min(count, pool.length)) {
    let bestIndex = -1;
    let bestEffective = -Infinity;
    let bestRepeats = 0;
    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      if (!candidate || picked.some((p) => p.game === candidate.game)) {
        continue;
      }
      const repeats = categoryCounts.get(candidate.game.primaryCategory) ?? 0;
      const effective = candidate.score + COMPOSITION_REPEAT_PENALTY * repeats;
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIndex = i;
        bestRepeats = repeats;
      }
    }
    if (bestIndex === -1) {
      break; // pool exhausted (defensive; loop bound prevents this)
    }
    const winner = pool[bestIndex];
    if (!winner) {
      break;
    }
    const components = winner.components.slice();
    let score = winner.score;
    if (bestRepeats > 0) {
      const weight = SIGNAL_WEIGHTS['composition-fit'];
      const contribution = weight * bestRepeats;
      components.push({
        key: 'composition-fit',
        weight,
        value: bestRepeats,
        contribution,
        reason: formatCompositionFitDetail(bestRepeats),
      });
      score += contribution;
    }
    picked.push({
      game: winner.game,
      score,
      score01: clamp01(
        (score + MAX_NEGATIVE_SCORE) /
          (MAX_POSITIVE_SCORE + MAX_NEGATIVE_SCORE),
      ),
      components,
    });
    categoryCounts.set(
      winner.game.primaryCategory,
      (categoryCounts.get(winner.game.primaryCategory) ?? 0) + 1,
    );
  }

  return picked;
}
