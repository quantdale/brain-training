/**
 * The activity calendar answers "which days did I train?", so a cell is a
 * LOCAL calendar date (constitution §14), matching the streak engine's
 * `'localtime'` day keys. Dates are built from local components so the
 * expectations hold on every host timezone.
 */
import { describe, expect, it } from '@jest/globals';

import { buildActivityCalendar } from '@/analytics';
import type { GameSessionRecord } from '@/db';

function session(completedAt: number): GameSessionRecord {
  return {
    id: `s-${completedAt}`,
    gameId: 'g',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.5,
    xp: 1,
    startedAt: completedAt,
    completedAt,
    durationMs: 1,
  } as GameSessionRecord;
}

const local = (m: number, d: number, h = 12, min = 0) =>
  new Date(2026, m - 1, d, h, min).getTime();

describe('buildActivityCalendar local days', () => {
  it('buckets a session into its local calendar date at both ends of the day', () => {
    const calendar = buildActivityCalendar(
      [session(local(9, 10, 0, 30)), session(local(9, 10, 23, 30))],
      3,
      local(9, 11),
    );

    expect(calendar.days.map((day) => `${day.dateKey}:${day.count}`)).toEqual([
      '2026-09-09:0',
      '2026-09-10:2',
      '2026-09-11:0',
    ]);
  });

  it('ends the grid on today\'s local date even just after local midnight', () => {
    const calendar = buildActivityCalendar([], 2, local(9, 11, 0, 5));

    expect(calendar.days.map((day) => day.dateKey)).toEqual(['2026-09-10', '2026-09-11']);
    expect(calendar.days.map((day) => day.offsetDays)).toEqual([1, 0]);
  });

  it('keeps one contiguous cell per date across DST changes', () => {
    const keysAround = (nowMs: number) =>
      buildActivityCalendar([], 10, nowMs).days.map((day) => day.dateKey);

    // Just after midnight, when 24h steps can land on a repeated/skipped date.
    expect(keysAround(local(3, 12, 0, 10))).toEqual([
      '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07',
      '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12',
    ]);
    expect(keysAround(local(11, 5, 23, 50))).toEqual([
      '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
      '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
    ]);
  });
});
