/**
 * Deterministic active-quest selection tests (engagement-cosmetics wave).
 *
 * The catalog is a POOL; each day/week a stable subset is surfaced. The
 * selection must be a pure function of the clock date: identical for every
 * player on the same day/week, bounded in size, and reproducible.
 */
import { describe, expect, it } from '@jest/globals';

import { QUEST_DEFINITIONS_V1 } from '@/quests';
import { DAILY_QUEST_SLOTS, pickStable, selectActiveQuests, WEEKLY_QUEST_SLOTS } from '@/quests';

const NOW = new Date(2026, 7, 16, 12, 0, 0); // Sunday 2026-08-16, ISO week 2026-W33
const LATER = new Date(2026, 7, 17, 12, 0, 0); // Monday 2026-08-17, ISO week 2026-W34

describe('pickStable', () => {
  it('returns the whole pool when it fits within the count', () => {
    const pool = [{ id: 'a' }, { id: 'b' }];
    expect(pickStable(pool, 'seed', 5).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('is deterministic for the same seed and bounded by count', () => {
    const pool = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));
    const a = pickStable(pool, '2026-W33', 3).map((x) => x.id);
    const b = pickStable(pool, '2026-W33', 3).map((x) => x.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });

  it('can differ across seeds', () => {
    const pool = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));
    const week1 = pickStable(pool, '2026-W33', 3).map((x) => x.id);
    const week2 = pickStable(pool, '2026-W34', 3).map((x) => x.id);
    // Both are valid subsets; they need not be identical but must be stable.
    expect(week1).toHaveLength(3);
    expect(pickStable(pool, '2026-W34', 3).map((x) => x.id)).toEqual(week2);
  });
});

describe('selectActiveQuests', () => {
  it('surfaces DAILY_QUEST_SLOTS daily quests, WEEKLY_QUEST_SLOTS weekly, and all longterm', () => {
    const active = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW);
    const daily = active.filter((d) => d.kind === 'daily');
    const weekly = active.filter((d) => d.kind === 'weekly');
    const longterm = active.filter((d) => d.kind === 'longterm');
    expect(daily).toHaveLength(DAILY_QUEST_SLOTS);
    expect(weekly).toHaveLength(WEEKLY_QUEST_SLOTS);
    expect(longterm.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same date and stable across calls', () => {
    const a = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW).map((d) => d.id);
    const b = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW).map((d) => d.id);
    expect(a).toEqual(b);
  });

  it('may change between days/weeks but stays within slot bounds', () => {
    const today = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW);
    const later = selectActiveQuests(QUEST_DEFINITIONS_V1, LATER);
    expect(today.filter((d) => d.kind === 'daily')).toHaveLength(DAILY_QUEST_SLOTS);
    expect(later.filter((d) => d.kind === 'weekly')).toHaveLength(WEEKLY_QUEST_SLOTS);
  });

  it('includes the baseline quests among the possible pool', () => {
    const ids = new Set(QUEST_DEFINITIONS_V1.map((d) => d.id));
    expect(ids.has('qd3')).toBe(true);
    expect(ids.has('qdx')).toBe(true);
    expect(ids.has('qw-memory')).toBe(true);
    expect(ids.has('qt100')).toBe(true);
  });
});
