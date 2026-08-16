import { describe, expect, it } from '@jest/globals';
import {
  currentPeriodKey,
  isoWeekKey,
  isoWeekOf,
  localDateKey,
  LONGTERM_PERIOD_KEY,
  periodKeyFor,
} from '../period';

describe('periodKeyFor', () => {
  it('daily key is the local calendar date itself', () => {
    expect(periodKeyFor('daily', '2026-08-16')).toBe('2026-08-16');
  });

  it('weekly key is the ISO week of the date (2026-08-16 is 2026-W33)', () => {
    expect(periodKeyFor('weekly', '2026-08-16')).toBe('2026-W33');
  });

  it('longterm key is the all-time sentinel regardless of date', () => {
    expect(periodKeyFor('longterm', '2026-08-16')).toBe('all');
    expect(LONGTERM_PERIOD_KEY).toBe('all');
  });

  it('rejects malformed or impossible dates', () => {
    expect(() => periodKeyFor('daily', '2026-8-16')).toThrow(/YYYY-MM-DD/);
    expect(() => periodKeyFor('daily', '2026/08/16')).toThrow(/YYYY-MM-DD/);
    expect(() => periodKeyFor('daily', '2026-13-01')).toThrow(/invalid calendar date/);
    expect(() => periodKeyFor('daily', '2026-02-30')).toThrow(/invalid calendar date/);
    expect(() => periodKeyFor('weekly', '')).toThrow(/YYYY-MM-DD/);
  });
});

describe('ISO week boundaries', () => {
  it('maps days before the first Thursday into week 1 of the next year', () => {
    expect(periodKeyFor('weekly', '2025-12-29')).toBe('2026-W01'); // Monday
    expect(periodKeyFor('weekly', '2026-01-01')).toBe('2026-W01'); // Thursday
    expect(periodKeyFor('weekly', '2026-01-04')).toBe('2026-W01'); // Sunday
    expect(periodKeyFor('weekly', '2026-01-05')).toBe('2026-W02'); // Monday
  });

  it('maps late-December days into the previous week-year (2020-W53 exists)', () => {
    expect(periodKeyFor('weekly', '2020-12-28')).toBe('2020-W53');
    expect(periodKeyFor('weekly', '2021-01-01')).toBe('2020-W53'); // Friday
    expect(periodKeyFor('weekly', '2021-01-04')).toBe('2021-W01');
  });

  it('handles a 53-week year and the following year boundary', () => {
    expect(periodKeyFor('weekly', '2026-12-31')).toBe('2026-W53');
    expect(periodKeyFor('weekly', '2027-01-01')).toBe('2026-W53'); // Friday
  });

  it('isoWeekOf reports the raw year/week pair', () => {
    expect(isoWeekOf(new Date(2026, 7, 16))).toEqual({ year: 2026, week: 33 });
    expect(isoWeekOf(new Date(2021, 0, 1))).toEqual({ year: 2020, week: 53 });
  });
});

describe('currentPeriodKey / localDateKey', () => {
  it('derives keys from an injectable clock date', () => {
    const now = new Date(2026, 7, 16, 23, 59, 59); // local Sunday 2026-08-16
    expect(currentPeriodKey('daily', now)).toBe('2026-08-16');
    expect(currentPeriodKey('weekly', now)).toBe('2026-W33');
    expect(currentPeriodKey('longterm', now)).toBe('all');
  });

  it('localDateKey zero-pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('isoWeekKey matches the weekly period key', () => {
    expect(isoWeekKey(new Date(2026, 7, 16))).toBe('2026-W33');
  });
});
