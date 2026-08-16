import { describe, expect, it } from '@jest/globals';
import {
  daysBetween,
  effectiveCurrent,
  nextDate,
  previousDate,
  reconstructStreak,
  toUtcDate,
} from '../reconstruct';

const TODAY = '2026-08-16';

/** Consecutive local dates ending at `end`, `count` days. */
function runEndingAt(end: string, count: number): string[] {
  const dates: string[] = [];
  let cursor = end;
  for (let i = 0; i < count; i += 1) {
    dates.push(cursor);
    cursor = previousDate(cursor);
  }
  return dates;
}

describe('reconstructStreak', () => {
  it('returns an empty state for no activity history', () => {
    expect(reconstructStreak([], TODAY)).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
      atRisk: false,
      frozenDays: 0,
    });
  });

  it('single day yesterday: alive, at risk, current 1', () => {
    const state = reconstructStreak(['2026-08-15'], TODAY);
    expect(state).toMatchObject({ current: 1, longest: 1, lastActiveDate: '2026-08-15', atRisk: true });
    expect(effectiveCurrent(state, TODAY)).toBe(1);
  });

  it('single day today: alive, not at risk, current 1', () => {
    const state = reconstructStreak(['2026-08-16'], TODAY);
    expect(state).toMatchObject({ current: 1, longest: 1, lastActiveDate: '2026-08-16', atRisk: false });
    expect(effectiveCurrent(state, TODAY)).toBe(1);
  });

  it('single day long ago: broken — raw run kept, effective current 0', () => {
    const state = reconstructStreak(['2026-08-10'], TODAY);
    expect(state).toMatchObject({ current: 1, longest: 1, lastActiveDate: '2026-08-10', atRisk: false });
    expect(effectiveCurrent(state, TODAY)).toBe(0);
  });

  it('long run ending today', () => {
    const state = reconstructStreak(runEndingAt(TODAY, 10), TODAY);
    expect(state).toMatchObject({ current: 10, longest: 10, lastActiveDate: TODAY, atRisk: false });
  });

  it('long run ending yesterday: current intact, at risk', () => {
    const state = reconstructStreak(runEndingAt('2026-08-15', 10), TODAY);
    expect(state).toMatchObject({ current: 10, longest: 10, lastActiveDate: '2026-08-15', atRisk: true });
    expect(effectiveCurrent(state, TODAY)).toBe(10);
  });

  it('mid-streak gap breaks the streak (activity today restarts current)', () => {
    // 10-day run broken 3 days ago, then activity today.
    const dates = [...runEndingAt('2026-08-13', 10), TODAY];
    const state = reconstructStreak(dates, TODAY);
    expect(state).toMatchObject({ current: 1, longest: 10, lastActiveDate: TODAY, atRisk: false });
    expect(effectiveCurrent(state, TODAY)).toBe(1);
  });

  it('mid-streak gap breaks the streak (no activity today → effective 0)', () => {
    // 10-day run ending 3 days ago, nothing since.
    const state = reconstructStreak(runEndingAt('2026-08-13', 10), TODAY);
    expect(state).toMatchObject({ current: 10, longest: 10, lastActiveDate: '2026-08-13', atRisk: false });
    expect(effectiveCurrent(state, TODAY)).toBe(0);
  });

  it('future dates are ignored', () => {
    const state = reconstructStreak([...runEndingAt(TODAY, 5), '2026-08-17', '2030-01-01'], TODAY);
    expect(state).toMatchObject({ current: 5, longest: 5, lastActiveDate: TODAY });
  });

  it('unsorted input with duplicates reconstructs the same state', () => {
    const sorted = runEndingAt(TODAY, 7);
    const shuffled = [
      TODAY,
      '2026-08-10',
      '2026-08-10',
      '2026-08-13',
      '2026-08-11',
      '2026-08-16',
      '2026-08-12',
      '2026-08-15',
      '2026-08-14',
      '2026-08-16',
    ];
    expect(reconstructStreak(shuffled, TODAY)).toEqual(reconstructStreak(sorted, TODAY));
    expect(reconstructStreak(shuffled, TODAY)).toMatchObject({ current: 7, longest: 7 });
  });

  it('leap-year Feb 29 boundary is contiguous (2024)', () => {
    const dates = ['2024-02-28', '2024-02-29', '2024-03-01'];
    const state = reconstructStreak(dates, '2024-03-01');
    expect(state).toMatchObject({ current: 3, longest: 3, lastActiveDate: '2024-03-01', atRisk: false });
  });

  it('non-leap-year boundary: 02-28 to 03-01 is contiguous (2023 has no Feb 29)', () => {
    const contiguous = reconstructStreak(['2023-02-27', '2023-02-28', '2023-03-01'], '2023-03-01');
    expect(contiguous).toMatchObject({ current: 3, longest: 3 });
    // Missing 03-01 is a real gap: the 2-day run breaks.
    const gapped = reconstructStreak(['2023-02-27', '2023-02-28', '2023-03-02'], '2023-03-02');
    expect(gapped).toMatchObject({ current: 1, longest: 2 });
  });

  it('impossible leap-day date is ignored', () => {
    const state = reconstructStreak(['2026-08-15', '2023-02-29'], TODAY);
    expect(state).toMatchObject({ current: 1, longest: 1, lastActiveDate: '2026-08-15', atRisk: true });
  });

  it('malformed entries are ignored', () => {
    const state = reconstructStreak(
      [...runEndingAt(TODAY, 3), '2026-13-01', '2026-02-30', 'not-a-date', '2026-8-16', ''],
      TODAY,
    );
    expect(state).toMatchObject({ current: 3, longest: 3, lastActiveDate: TODAY });
  });

  it('longest spans the best run across multiple runs', () => {
    const dates = [...runEndingAt('2026-07-20', 3), ...runEndingAt('2026-07-30', 5)];
    const state = reconstructStreak(dates, '2026-08-01');
    expect(state).toMatchObject({ current: 5, longest: 5, lastActiveDate: '2026-07-30' });
    // longer gap variant: the older 7-day run should win longest
    const older = [...runEndingAt('2026-06-10', 7), ...runEndingAt('2026-07-30', 2)];
    expect(reconstructStreak(older, '2026-08-01')).toMatchObject({ longest: 7, current: 2 });
  });

  it('invalid today yields an empty state', () => {
    expect(reconstructStreak(['2026-08-15'], '2026-13-99')).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
      atRisk: false,
      frozenDays: 0,
    });
  });

  it('atRisk is true only when the last active day is exactly yesterday', () => {
    expect(reconstructStreak([], TODAY).atRisk).toBe(false);
    expect(reconstructStreak(['2026-08-16'], TODAY).atRisk).toBe(false);
    expect(reconstructStreak(['2026-08-15'], TODAY).atRisk).toBe(true);
    expect(reconstructStreak(['2026-08-14'], TODAY).atRisk).toBe(false);
  });
});

describe('date helpers', () => {
  it('previousDate/nextDate are exact inverses across month and leap-year boundaries', () => {
    for (const date of ['2026-03-01', '2026-01-01', '2024-03-01', '2024-02-29']) {
      expect(nextDate(previousDate(date))).toBe(date);
    }
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(previousDate('2024-03-01')).toBe('2024-02-29');
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
  });

  it('daysBetween counts whole days', () => {
    expect(daysBetween('2026-08-16', '2026-08-16')).toBe(0);
    expect(daysBetween('2026-08-16', '2026-08-15')).toBe(1);
    expect(daysBetween('2026-08-16', '2026-08-13')).toBe(3);
    expect(daysBetween('2024-03-01', '2024-02-28')).toBe(2);
  });

  it('toUtcDate rejects malformed and impossible calendar dates', () => {
    for (const bad of ['2026-8-16', '2026/08/16', '2026-02-30', '2026-13-01', '', 'abc']) {
      expect(toUtcDate(bad)).toBeNull();
    }
    expect(toUtcDate('2026-08-16')).not.toBeNull();
  });
});
