/**
 * ISO week keys must be a function of the local calendar date alone. Local
 * midnights are 23 or 25 hours apart across a DST change, so any arithmetic on
 * local-midnight epoch values skews the week number for the rest of the DST
 * season.
 *
 * The host timezone is not controllable from inside jest (the sandboxed
 * `process.env` does not reach the runtime), so:
 * - the table asserts the correct key on every host, and reproduces the defect
 *   when the suite is run with `TZ=America/New_York`;
 * - the simulated test models the 23-hour local day on any host.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { isoWeekKey, isoWeekOf } from '@/quests';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isoWeekKey across DST', () => {
  it.each([
    // New York 2026: DST starts Sunday March 8.
    [2026, 3, 1, '2026-W09'],
    [2026, 3, 2, '2026-W10'],
    [2026, 3, 8, '2026-W10'],
    [2026, 3, 9, '2026-W11'],
    [2026, 3, 16, '2026-W12'],
    [2026, 7, 1, '2026-W27'],
    // DST ends Sunday November 1.
    [2026, 10, 26, '2026-W44'],
    [2026, 11, 1, '2026-W44'],
    [2026, 11, 2, '2026-W45'],
    // Year boundaries stay on the ISO Thursday rule.
    [2025, 12, 28, '2025-W52'],
    [2025, 12, 29, '2026-W01'],
    [2021, 1, 1, '2020-W53'],
    [2026, 12, 31, '2026-W53'],
    [2027, 1, 4, '2027-W01'],
  ])('%i-%i-%i is %s', (year, month, day, expected) => {
    // Late-evening instant: the key depends on the date, never the time.
    expect(isoWeekKey(new Date(year, month - 1, day, 23, 30))).toBe(expected);
    expect(isoWeekKey(new Date(year, month - 1, day, 0, 30))).toBe(expected);
  });

  it('gives consecutive Mondays distinct, consecutive weeks all year', () => {
    let previous = isoWeekOf(new Date(2026, 0, 5)).week;
    for (let monday = new Date(2026, 0, 12); monday.getFullYear() === 2026; ) {
      const { week } = isoWeekOf(monday);
      expect(week).toBe(previous + 1);
      previous = week;
      monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    }
  });

  it('is not skewed when local midnights are less than whole days apart', () => {
    // Model summer time on any host: local-midnight epoch values after the
    // change are an hour short of a whole number of days from January 1.
    const realGetTime = Date.prototype.getTime;
    jest.spyOn(Date.prototype, 'getTime').mockImplementation(function (this: Date) {
      const summer = this.getMonth() >= 2 && this.getMonth() <= 9;
      return realGetTime.call(this) - (summer ? 3_600_000 : 0);
    });

    expect(isoWeekKey(new Date(2026, 2, 9, 12))).toBe('2026-W11');
  });
});
