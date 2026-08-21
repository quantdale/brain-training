/**
 * Training-balance aggregation for Progress: how a player's sessions are
 * distributed across the known cognitive domains inside a time window.
 *
 * Every session counts toward exactly one domain — its game's primary
 * category, resolved by the caller via the registry — so the shares are a
 * direct, explainable restatement of stored evidence (no weighting, no
 * invented score). Sessions whose game cannot be resolved are reported
 * separately as `unmappedSessions` instead of being silently dropped.
 */

import type { GameSessionRecord } from '@/db';

import { filterByWindow } from './windows';
import type { TimeWindowKey } from './types';

/** One domain's share of in-window sessions. */
export interface DomainSessionShare {
  domain: string;
  /** Completed sessions mapped to this domain inside the window. */
  sessions: number;
  /** `sessions / mappedSessions` in [0, 1] (`0` when nothing mapped). */
  share: number;
}

/** Domain-distribution summary for a time window. */
export interface TrainingBalance {
  /** Sessions completed inside the window (mapped + unmapped). */
  windowSessions: number;
  /** In-window sessions resolvable to a domain via `resolveDomain`. */
  mappedSessions: number;
  /** In-window sessions whose game/domain could not be resolved. */
  unmappedSessions: number;
  /**
   * One entry per known domain (zero-count entries included) plus any extra
   * resolved domains, sorted by session count desc, then canonical order.
   */
  perDomain: DomainSessionShare[];
  /** Number of known domains with at least one in-window session. */
  trainedDomains: number;
  /** Known domains with zero in-window sessions (canonical order). */
  untrainedDomains: string[];
  /** Domain holding the largest share, or `null` when nothing was played. */
  topDomain: string | null;
  /** Largest single-domain share in [0, 1], or `null` when nothing mapped. */
  topDomainShare: number | null;
}

/**
 * Build the balance view. `resolveDomain(gameId)` returns the game's primary
 * domain or `null` when unknown (e.g. registry lookup). Deterministic given
 * the same inputs; ties break toward canonical `knownDomains` order.
 */
export function buildTrainingBalance(
  sessions: readonly GameSessionRecord[],
  resolveDomain: (gameId: string) => string | null,
  knownDomains: readonly string[],
  nowMs: number,
  windowKey: TimeWindowKey,
): TrainingBalance {
  const inWindow = filterByWindow(sessions, nowMs, windowKey);

  const counts = new Map<string, number>();
  let unmappedSessions = 0;
  for (const session of inWindow) {
    const domain = resolveDomain(session.gameId);
    if (domain === null) {
      unmappedSessions += 1;
      continue;
    }
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  const mappedSessions = inWindow.length - unmappedSessions;

  // Canonical order first, then any resolved extras (alphabetical for stability).
  const orderedDomains = [...knownDomains];
  for (const domain of counts.keys()) {
    if (!orderedDomains.includes(domain)) {
      orderedDomains.push(domain);
    }
  }

  const rankOf = (domain: string) => {
    const index = knownDomains.indexOf(domain);
    return index === -1 ? knownDomains.length : index;
  };

  const perDomain: DomainSessionShare[] = orderedDomains
    .map((domain) => ({
      domain,
      sessions: counts.get(domain) ?? 0,
      share: mappedSessions > 0 ? (counts.get(domain) ?? 0) / mappedSessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || rankOf(a.domain) - rankOf(b.domain));

  const untrainedDomains = orderedDomains.filter((d) => !counts.has(d));
  const top = perDomain.find((entry) => entry.sessions > 0) ?? null;

  return {
    windowSessions: inWindow.length,
    mappedSessions,
    unmappedSessions,
    perDomain,
    trainedDomains: counts.size,
    untrainedDomains,
    topDomain: top?.domain ?? null,
    topDomainShare: top !== null && mappedSessions > 0 ? top.share : null,
  };
}
