/**
 * "Active days" and per-day groupings count LOCAL calendar dates (constitution
 * §14), so they agree with the streak and the activity calendar. Dates are
 * built from local components so the expectations hold on every host timezone;
 * a UTC implementation fails them wherever the offset is non-zero.
 */
import { describe, expect, it } from '@jest/globals';

import {
  buildDomainBreadthPerformance,
  buildProgressConsistency,
  buildSessionVolume,
} from '@/analytics';
import type { GameSessionRecord } from '@/db';

const local = (m: number, d: number, h = 12, min = 0) =>
  new Date(2026, m - 1, d, h, min).getTime();

function session(completedAt: number, gameId = 'mem'): GameSessionRecord {
  return { id: `s-${completedAt}`, gameId, completedAt, normalizedResult: 0.5 } as GameSessionRecord;
}

const NOW = local(9, 12);
const sameLocalDay = [session(local(9, 10, 0, 30)), session(local(9, 10, 23, 30))];
const acrossLocalMidnight = [session(local(9, 9, 23, 30)), session(local(9, 10, 0, 30))];

describe('buildSessionVolume local active days', () => {
  it.each(['30d', 'all'] as const)('counts one local date as one active day (%s)', (windowKey) => {
    expect(buildSessionVolume(sameLocalDay, NOW, windowKey).activeDays).toBe(1);
  });

  it.each(['30d', 'all'] as const)('splits sessions either side of local midnight (%s)', (windowKey) => {
    expect(buildSessionVolume(acrossLocalMidnight, NOW, windowKey).activeDays).toBe(2);
  });
});

describe('buildProgressConsistency local active days', () => {
  it('counts one local date as one active day', () => {
    expect(buildProgressConsistency(sameLocalDay, NOW, '30d')).toMatchObject({
      activeDays: 1,
      averagePerActiveDay: 2,
    });
  });

  it('splits sessions either side of local midnight', () => {
    expect(buildProgressConsistency(acrossLocalMidnight, NOW, '30d').activeDays).toBe(2);
  });
});

describe('buildDomainBreadthPerformance local days', () => {
  const resolve = (gameId: string) =>
    (({ mem: 'Memory', att: 'Attention' }) as Record<string, string>)[gameId] ?? null;

  it('groups two domains trained on one local date into one breadth-2 day', () => {
    const view = buildDomainBreadthPerformance(
      [session(local(9, 10, 0, 30), 'mem'), session(local(9, 10, 23, 30), 'att')],
      resolve,
    );

    expect(view.daysConsidered).toBe(1);
    expect(view.groups.map((g) => [g.breadth, g.days])).toEqual([[2, 1]]);
  });

  it('keeps sessions either side of local midnight on separate days', () => {
    const view = buildDomainBreadthPerformance(
      [session(local(9, 9, 23, 30), 'mem'), session(local(9, 10, 0, 30), 'att')],
      resolve,
    );

    expect(view.groups.map((g) => [g.breadth, g.days])).toEqual([[1, 2]]);
  });

  it('reports an unmapped-only local date once, and not when it has a mapped session', () => {
    const view = buildDomainBreadthPerformance(
      [
        session(local(9, 8, 0, 30), 'zz'),
        session(local(9, 8, 23, 30), 'zz'),
        session(local(9, 10, 0, 30), 'zz'),
        session(local(9, 10, 23, 30), 'mem'),
      ],
      resolve,
    );

    expect(view.unmappedDays).toBe(1);
    expect(view.daysConsidered).toBe(1);
  });
});
