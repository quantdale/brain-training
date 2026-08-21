/**
 * Determinism tests for the W13 shell formatting helpers (capped per campaign
 * validation policy — new pure logic only, no test suite).
 */
import { describe, expect, it } from '@jest/globals';

import { formatRelativeDay, performanceBand } from '../format';

// Fixed reference clock: 2026-08-21T12:00:00 local (midday avoids any
// DST-boundary midnight edge in the test timezone).
const NOW = new Date(2026, 7, 21, 12, 0, 0).getTime();

describe('formatRelativeDay', () => {
  it('labels the same local day as Today', () => {
    const earlier = new Date(2026, 7, 21, 0, 30, 0).getTime();
    expect(formatRelativeDay(earlier, NOW)).toBe('Today');
  });

  it('labels the previous local day as Yesterday', () => {
    const yesterday = new Date(2026, 7, 20, 23, 59, 0).getTime();
    expect(formatRelativeDay(yesterday, NOW)).toBe('Yesterday');
  });

  it('counts days within the past week', () => {
    const threeDaysAgo = new Date(2026, 7, 18, 9, 0, 0).getTime();
    expect(formatRelativeDay(threeDaysAgo, NOW)).toBe('3 days ago');
  });

  it('falls back to a locale date beyond a week (not a relative label)', () => {
    const longAgo = new Date(2026, 6, 1, 9, 0, 0).getTime();
    const label = formatRelativeDay(longAgo, NOW);
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
    expect(label).not.toMatch(/days ago$/);
  });

  it('degrades invalid input to an em dash', () => {
    expect(formatRelativeDay(Number.NaN, NOW)).toBe('—');
  });
});

describe('performanceBand', () => {
  it('maps band boundaries inclusively', () => {
    expect(performanceBand(0.9).label).toBe('Outstanding');
    expect(performanceBand(0.89).label).toBe('Strong run');
    expect(performanceBand(0.5).label).toBe('Solid work');
    expect(performanceBand(0.49).label).toBe('Keep going');
    expect(performanceBand(0.24).label).toBe('Keep training');
  });

  it('treats non-numeric results as a neutral completion band', () => {
    expect(performanceBand(Number.NaN).label).toBe('Session complete');
  });
});
