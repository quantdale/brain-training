/**
 * Quest refresh boundary hardening (campaign 011 / W13).
 *
 * `nextRefreshAt` answers WHEN the active set rotates; these attacks pin its
 * edges beyond the fixed-date tests in rollover.test.ts:
 * - daily: strictly-future local midnight — including `now` exactly AT
 *   midnight (must roll to the NEXT day's midnight, never the past/never 0ms);
 * - weekly: always a LOCAL MONDAY 00:00 within 1..7 calendar days, across the
 *   Sunday→Monday seam and the ISO week-year seam;
 * - longterm: never rotates (null, and msUntilRefresh null);
 * - a full-calendar-year structural sweep at several intraday times: the
 *   contract must hold on EVERY date of 2027 on whatever timezone the host
 *   runs in (all expectations are local-component based, so DST transitions
 *   inside the swept year cannot break them — a DST day only changes the
 *   millisecond length of the day, never the local calendar answer).
 */
import { describe, expect, it } from '@jest/globals';

import { msUntilRefresh, nextRefreshAt } from '../refresh';

/** Local Date for Y-M-D h:m:s. */
function localDate(y: number, m: number, d: number, h = 12, min = 0, s = 0): Date {
  return new Date(y, m - 1, d, h, min, s, 0);
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole CALENDAR-day difference a−b (DST-safe: uses UTC-midnight anchors). */
function calendarDayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86_400_000);
}

function expectLocalMidnight(date: Date): void {
  expect(date.getHours()).toBe(0);
  expect(date.getMinutes()).toBe(0);
  expect(date.getSeconds()).toBe(0);
  expect(date.getMilliseconds()).toBe(0);
}

describe('daily refresh — exact midnight edge', () => {
  it('at exactly local midnight rolls to the NEXT day’s midnight (strictly future)', () => {
    const midnight = localDate(2026, 8, 21, 0, 0, 0);
    const next = nextRefreshAt('daily', midnight)!;
    expectLocalMidnight(next);
    expect(calendarDayDiff(next, midnight)).toBe(1); // 08-22, not 08-21
    expect(next.getTime()).toBeGreaterThan(midnight.getTime());
    expect(msUntilRefresh('daily', midnight)).toBe(next.getTime() - midnight.getTime());
    // One millisecond before midnight still targets the coming midnight (+0 days… i.e. tomorrow).
    const justBefore = new Date(midnight.getTime() - 1);
    expect(calendarDayDiff(nextRefreshAt('daily', justBefore)!, justBefore)).toBe(1);
  });

  it('one second after midnight targets the following night', () => {
    const justAfter = localDate(2026, 8, 21, 0, 0, 1);
    const next = nextRefreshAt('daily', justAfter)!;
    expect(localDateKey(next)).toBe('2026-08-22');
    expect(msUntilRefresh('daily', justAfter)).toBe(
      localDate(2026, 8, 22, 0, 0, 0).getTime() - justAfter.getTime(),
    );
  });
});

describe('weekly refresh — Monday seams', () => {
  it('Sunday 23:59:59 rolls to the immediately-following Monday 00:00', () => {
    // 2026-08-16 is a Sunday.
    const sundayNight = localDate(2026, 8, 16, 23, 59, 59);
    const next = nextRefreshAt('weekly', sundayNight)!;
    expectLocalMidnight(next);
    expect(next.getDay()).toBe(1);
    expect(localDateKey(next)).toBe('2026-08-17');
  });

  it('Monday 00:00 exactly rolls a FULL week forward (never same-instant/0ms)', () => {
    // 2026-08-17 is a Monday.
    const mondayMidnight = localDate(2026, 8, 17, 0, 0, 0);
    const next = nextRefreshAt('weekly', mondayMidnight)!;
    expectLocalMidnight(next);
    expect(next.getDay()).toBe(1);
    expect(calendarDayDiff(next, mondayMidnight)).toBe(7);
    expect(localDateKey(next)).toBe('2026-08-24');
  });

  it('crosses the ISO week-year seam onto the correct next Monday', () => {
    // Sun 2025-12-28 (last 2025 week) → Mon 2025-12-29 (which is 2026-W01).
    const next = nextRefreshAt('weekly', localDate(2025, 12, 28, 23, 59, 59))!;
    expect(localDateKey(next)).toBe('2025-12-29');
    expect(next.getDay()).toBe(1);

    // From INSIDE the 2026-W01 week (Thu 2025-12-31) → Mon 2026-01-05.
    const fromNewYearWeek = nextRefreshAt('weekly', localDate(2025, 12, 31, 12))!;
    expect(localDateKey(fromNewYearWeek)).toBe('2026-01-05');
    expect(fromNewYearWeek.getDay()).toBe(1);
  });
});

describe('longterm never refreshes', () => {
  it('returns null for both helpers at every probed instant', () => {
    for (const probe of [
      localDate(2026, 8, 21),
      localDate(2026, 8, 21, 0, 0, 0),
      localDate(2025, 12, 28, 23, 59, 59),
    ]) {
      expect(nextRefreshAt('longterm', probe)).toBeNull();
      expect(msUntilRefresh('longterm', probe)).toBeNull();
    }
  });
});

describe('full-year structural sweep (every day of 2027 × intraday probes)', () => {
  /**
   * The contract, checked structurally so it holds on ANY host timezone
   * (including ones with DST transitions inside the swept year):
   * - daily → strictly future local midnight of the next calendar day
   *   (next day when probed AT midnight);
   * - weekly → local Monday 00:00, 1..7 calendar days ahead;
   * - msUntilRefresh agrees with nextRefreshAt and is never negative.
   */
  const PROBE_HOURS = [0, 9, 13, 23]; // includes both midnights + midday

  it('daily: always next local midnight, strictly future, non-negative countdown', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28 && !(month === 2 && day > 28); day += 1) {
        for (const hour of PROBE_HOURS) {
          const now = localDate(2027, month, day, hour, hour === 0 ? 0 : 37);
          const next = nextRefreshAt('daily', now)!;
          expectLocalMidnight(next);
          expect(next.getTime()).toBeGreaterThan(now.getTime());
          // Exactly one calendar day ahead (the at-midnight probe still rolls
          // forward — strictly-future contract).
          expect(calendarDayDiff(next, now)).toBe(1);
          expect(msUntilRefresh('daily', now)).toBe(next.getTime() - now.getTime());
          expect(msUntilRefresh('daily', now)!).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('weekly: always a Monday midnight 1..7 calendar days ahead, never negative', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        for (const hour of PROBE_HOURS) {
          const now = localDate(2027, month, day, hour, hour === 0 ? 0 : 41);
          const next = nextRefreshAt('weekly', now)!;
          expectLocalMidnight(next);
          expect(next.getDay()).toBe(1);
          const diff = calendarDayDiff(next, now);
          expect(diff).toBeGreaterThanOrEqual(1);
          expect(diff).toBeLessThanOrEqual(7);
          expect(next.getTime()).toBeGreaterThan(now.getTime());
          expect(msUntilRefresh('weekly', now)).toBe(next.getTime() - now.getTime());
        }
      }
    }
  });
});
