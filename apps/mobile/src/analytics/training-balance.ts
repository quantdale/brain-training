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

/**
 * Coverage: the fraction of `knownDomains` with at least one in-window session
 * (0..1). A plain restatement of breadth — "you touched N of M domains".
 */
export function balanceCoverage(
  balance: TrainingBalance,
  knownDomains: readonly string[],
): number {
  if (knownDomains.length === 0) {
    return 0;
  }
  return balance.trainedDomains / knownDomains.length;
}

/**
 * Evenness: the "effective number of domains" (inverse Simpson index) —
 * `1 / Σ share²`. Equal spread across N domains yields exactly N; one dominant
 * domain approaches 1. A deterministic, explainable single-number summary of
 * how evenly sessions were distributed. Returns 0 when nothing was mapped.
 */
export function balanceEffectiveDomains(balance: TrainingBalance): number {
  if (balance.mappedSessions === 0) {
    return 0;
  }
  const herfindahl = balance.perDomain.reduce((s, d) => s + d.share * d.share, 0);
  // Floating-point guard: a perfectly even spread can round Σshare² just above
  // its exact value; clamp so the effective count never exceeds reality.
  const effective = herfindahl > 0 ? 1 / herfindahl : 0;
  return Math.min(effective, balance.mappedSessions);
}

/** One week's slice of the balance history. */
export interface WeeklyBalanceSlice {
  /** Whole days before "now" where this 7-day slice ends (0 = current week). */
  endOffsetDays: number;
  /** Sessions in the slice (mapped + unmapped). */
  sessions: number;
  /** Per-domain shares, canonical `knownDomains` order first (stable colors). */
  perDomain: DomainSessionShare[];
}

/**
 * Week-by-week balance history for a stacked share view: `weekCount` slices of
 * 7 days each, ending at `nowMs`, oldest first. Domains keep canonical order
 * in every slice (NOT count order) so stacked-bar segment colors stay stable
 * across weeks — count ordering here would make the same domain change color
 * week to week.
 */
export function buildWeeklyBalance(
  sessions: readonly GameSessionRecord[],
  resolveDomain: (gameId: string) => string | null,
  knownDomains: readonly string[],
  nowMs: number,
  weekCount: number,
): WeeklyBalanceSlice[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const slices: WeeklyBalanceSlice[] = [];

  for (let w = weekCount - 1; w >= 0; w -= 1) {
    const end = nowMs - w * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;

    const counts = new Map<string, number>();
    let mapped = 0;
    let total = 0;
    for (const session of sessions) {
      const t = session.completedAt;
      if (t < start || t >= end) {
        continue;
      }
      total += 1;
      const domain = resolveDomain(session.gameId);
      if (domain === null) {
        continue;
      }
      mapped += 1;
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }

    // Canonical order first, then any resolved extras (alphabetical fallback).
    const orderedDomains = [...knownDomains];
    for (const domain of counts.keys()) {
      if (!orderedDomains.includes(domain)) {
        orderedDomains.push(domain);
      }
    }

    slices.push({
      endOffsetDays: w * 7,
      sessions: total,
      perDomain: orderedDomains.map((domain) => ({
        domain,
        sessions: counts.get(domain) ?? 0,
        share: mapped > 0 ? (counts.get(domain) ?? 0) / mapped : 0,
      })),
    });
  }

  return slices;
}
