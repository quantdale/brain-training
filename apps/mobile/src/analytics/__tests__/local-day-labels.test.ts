/**
 * Date labels show the player's LOCAL calendar date (constitution §14), the
 * same date the streak and activity calendar use. Dates are built from local
 * components so the expectations hold on every host timezone; a UTC
 * implementation fails them wherever the offset is non-zero.
 */
import { describe, expect, it } from '@jest/globals';

import { formatDateKeyLabel, formatDayLabel } from '@/analytics/format';

const local = (m: number, d: number, h = 12, min = 0) =>
  new Date(2026, m - 1, d, h, min).getTime();

describe('formatDayLabel', () => {
  it('labels an instant with its local date at both ends of the day', () => {
    expect(formatDayLabel(local(9, 10, 0, 30))).toBe('Sep 10');
    expect(formatDayLabel(local(9, 10, 23, 30))).toBe('Sep 10');
  });

  it('stays on the local month and year across their boundaries', () => {
    expect(formatDayLabel(new Date(2026, 11, 31, 23, 30).getTime())).toBe('Dec 31');
    expect(formatDayLabel(new Date(2027, 0, 1, 0, 30).getTime())).toBe('Jan 1');
  });
});

describe('formatDateKeyLabel', () => {
  it('labels a date key without passing through an instant', () => {
    expect(formatDateKeyLabel('2026-03-08')).toBe('Mar 8');
    expect(formatDateKeyLabel('2026-12-31')).toBe('Dec 31');
  });
});
