/**
 * Co-occurrence presentation for Progress V2 ("streak correlation", packet W08).
 *
 * This module deliberately does NOT compute a correlation coefficient or claim
 * any causal relationship. It groups stored sessions by the UTC day they were
 * completed on, counts how many distinct domains each day touched, and
 * restates the average normalized result per breadth group. The only honest
 * statement is "in your history, days that looked like this averaged that" —
 * `COOCCURRENCE_CAPTION` says exactly that, and screens must render it next to
 * the numbers (constitution §4: no cognitive-efficacy claims).
 */

import type { GameSessionRecord } from '@/db';

import { utcDateKey } from './format';

/** One breadth group: days on which exactly `breadth` distinct domains were trained. */
export interface BreadthGroup {
  /** Distinct primary domains trained that day (1..N). */
  breadth: number;
  /** Distinct days in this group. */
  days: number;
  /** Sessions contributed by those days. */
  sessions: number;
  /** Mean normalized result across those sessions (`null` when none). */
  avgNormalized: number | null;
}

export interface DomainBreadthView {
  /** Groups ascending by breadth; only breadths with at least one day appear. */
  groups: BreadthGroup[];
  /** Distinct days considered (days with at least one mapped session). */
  daysConsidered: number;
  /** Days excluded because no session could be mapped to a domain. */
  unmappedDays: number;
}

/**
 * Fixed co-occurrence disclaimer. Presentation-only modules must show it
 * alongside breadth stats so the numbers can never read as "training more
 * domains causes better scores".
 */
export const COOCCURRENCE_CAPTION =
  'These numbers only describe what tended to co-occur in your own history. They do not mean one thing caused the other.';

/**
 * Group sessions by UTC day and restate average performance per domain
 * breadth. Attribution uses the caller-supplied `resolveDomain` (primary
 * category), matching `training-balance`. Deterministic given the same inputs.
 */
export function buildDomainBreadthPerformance(
  sessions: readonly GameSessionRecord[],
  resolveDomain: (gameId: string) => string | null,
): DomainBreadthView {
  // day key -> { domains, values }
  const byDay = new Map<string, { domains: Set<string>; values: number[] }>();
  let unmappedDays = 0;
  const unmappedDayKeys = new Set<string>();

  for (const session of sessions) {
    const domain = resolveDomain(session.gameId);
    if (domain === null) {
      // A day whose sessions are all unmapped must not count as breadth-0 data.
      unmappedDayKeys.add(utcDateKey(session.completedAt));
      continue;
    }
    const key = utcDateKey(session.completedAt);
    let entry = byDay.get(key);
    if (!entry) {
      entry = { domains: new Set<string>(), values: [] };
      byDay.set(key, entry);
    }
    entry.domains.add(domain);
    entry.values.push(session.normalizedResult);
  }

  for (const key of unmappedDayKeys) {
    if (!byDay.has(key)) {
      unmappedDays += 1;
    }
  }

  // breadth -> aggregate
  type Agg = { days: Set<string>; sessions: number; sum: number };
  const byBreadth = new Map<number, Agg>();
  for (const [key, entry] of byDay) {
    const breadth = entry.domains.size;
    let agg = byBreadth.get(breadth);
    if (!agg) {
      agg = { days: new Set<string>(), sessions: 0, sum: 0 };
      byBreadth.set(breadth, agg);
    }
    agg.days.add(key);
    agg.sessions += entry.values.length;
    for (const v of entry.values) {
      agg.sum += v;
    }
  }

  const groups: BreadthGroup[] = [...byBreadth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([breadth, agg]) => ({
      breadth,
      days: agg.days.size,
      sessions: agg.sessions,
      avgNormalized: agg.sessions > 0 ? agg.sum / agg.sessions : null,
    }));

  return { groups, daysConsidered: byDay.size, unmappedDays };
}
