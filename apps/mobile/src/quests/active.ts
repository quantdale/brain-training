/**
 * Deterministic active-quest selection (engagement-cosmetics wave).
 *
 * The quest catalog is a POOL. Each day a stable subset of the daily pool is
 * surfaced; each ISO week a stable subset of the weekly pool is surfaced.
 * Long-term quests are always active. The selection is a pure function of the
 * clock date — no per-player state, no stored selection, identical for every
 * player on the same calendar day/week — so it is fully reproducible in tests
 * and cannot drift.
 *
 * Determinism: a per-period seed (the period key itself) permutes the pool
 * via a stable string hash; the first N entries are chosen, then re-sorted to
 * their original catalog order so the UI presentation is also stable.
 */
import { currentPeriodKey } from './period';
import type { QuestDefinition } from './types';

/** How many daily/weekly quests are surfaced per period. */
export const DAILY_QUEST_SLOTS = 3;
export const WEEKLY_QUEST_SLOTS = 3;

/**
 * Select the quests active for `now`'s periods.
 * - daily: `DAILY_QUEST_SLOTS` of the daily pool
 * - weekly: `WEEKLY_QUEST_SLOTS` of the weekly pool
 * - longterm: all long-term quests
 */
export function selectActiveQuests(
  definitions: readonly QuestDefinition[],
  now: Date,
): QuestDefinition[] {
  const daily = definitions.filter((d) => d.kind === 'daily');
  const weekly = definitions.filter((d) => d.kind === 'weekly');
  const longterm = definitions.filter((d) => d.kind === 'longterm');

  const dailyActive = pickStable(daily, currentPeriodKey('daily', now), DAILY_QUEST_SLOTS);
  const weeklyActive = pickStable(weekly, currentPeriodKey('weekly', now), WEEKLY_QUEST_SLOTS);

  const active = [...dailyActive, ...weeklyActive, ...longterm];
  return sortByCatalogOrder(definitions, active);
}

/**
 * Choose `count` entries from `pool` deterministically for `seed`. Returns the
 * original definition objects (not copies). Stable: identical seed+pool →
 * identical selection across runs and players.
 */
export function pickStable<T extends { id: string }>(
  pool: readonly T[],
  seed: string,
  count: number,
): T[] {
  if (pool.length <= count) {
    return [...pool];
  }
  const scored = pool.map((item, index) => ({
    item,
    index,
    score: hashScore(`${seed} ${item.id}`),
  }));
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.slice(0, count).map((s) => s.item);
}

/** Re-sort a selected subset into its original catalog order. */
function sortByCatalogOrder<T extends { id: string }>(
  catalog: readonly T[],
  selected: readonly T[],
): T[] {
  const order = new Map(catalog.map((item, index) => [item.id, index]));
  return [...selected].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Stable, dependency-free 32-bit string hash (FNV-1a variant). Not
 * cryptographic — only used to permute a small pool deterministically.
 */
function hashScore(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Non-negative so subtraction-based sorting is well-defined.
  return hash >>> 0;
}
