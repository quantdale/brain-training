/**
 * Determinism tests for the Progress V2 pure modules (campaign 010, W08).
 *
 * Capped per the campaign validation policy (~≤8 tests, no suites): one test
 * per new module's core contract, all with fixed clocks and fixtures.
 */

import { describe, expect, it } from '@jest/globals';

import type { GameSessionRecord, WorkoutInstance } from '@/db';

import {
  activeRuns,
  buildDomainBreadthPerformance,
  buildPersonalBestHistory,
  buildSessionVolume,
  buildWorkoutAnalytics,
  rollingAverages,
  summarizeTrend,
  weekdayDistribution,
} from '@/analytics';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 20); // fixed clock: 2026-01-20

function session(over: Partial<GameSessionRecord>): GameSessionRecord {
  return {
    id: 's',
    gameId: 'g',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.5,
    xp: 10,
    startedAt: T0,
    completedAt: T0,
    durationMs: 1000,
    ...over,
  };
}

function workout(date: string, status: 'active' | 'completed', games = 4, done = 0): WorkoutInstance {
  return {
    date,
    gameIds: Array.from({ length: games }, (_, i) => `g${i}`),
    status,
    currentIndex: status === 'completed' ? games : done,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: T0,
    updatedAt: T0,
  };
}

describe('Progress V2 pure modules (determinism)', () => {
  it('summarizeTrend: stats, consistency and direction from a fixed series', () => {
    const s = summarizeTrend([0.5, 0.7, 0.9]);
    expect(s.count).toBe(3);
    expect(s.first).toBe(0.5);
    expect(s.last).toBe(0.9);
    expect(s.delta).toBeCloseTo(0.4, 10);
    expect(s.mean).toBeCloseTo(0.7, 10);
    // Flat series is perfectly consistent; this one is not.
    expect(summarizeTrend([0.6, 0.6]).consistency).toBe(1);
    expect(s.consistency).toBeLessThan(1);
    expect(s.direction).toBe('up');
    // Deterministic across calls.
    expect(summarizeTrend([0.5, 0.7, 0.9])).toEqual(s);
  });

  it('buildSessionVolume: counts window vs previous equal-length window', () => {
    const sessions = [
      session({ id: 'a', completedAt: T0 - 1 * DAY }),
      session({ id: 'b', completedAt: T0 - 2 * DAY }),
      session({ id: 'old', completedAt: T0 - 40 * DAY }),
      session({ id: 'edge', completedAt: T0 - 60 * DAY }),
    ];
    const v = buildSessionVolume(sessions, T0, '30d');
    expect(v.windowSessions).toBe(2); // a, b
    expect(v.previousWindowSessions).toBe(1); // old (40d ago) — edge is outside
    expect(v.deltaSessions).toBe(1);
    expect(v.direction).toBe('up');
    expect(v.weeklyCounts).toHaveLength(Math.ceil(30 / 7));
    expect(v.weeklyCounts.reduce((s, n) => s + n, 0)).toBe(2);
    // `all` has no previous period.
    const all = buildSessionVolume(sessions, T0, 'all');
    expect(all.previousWindowSessions).toBeNull();
    expect(all.windowSessions).toBe(4);
  });

  it('buildPersonalBestHistory: strictly improving chain with standing days', () => {
    const h = buildPersonalBestHistory(
      [
        { t: T0 - 3 * DAY, value: 0.5 },
        { t: T0 - 2 * DAY, value: 0.8 },
        { t: T0 - 1 * DAY, value: 0.7 }, // below best: no event
        { t: T0, value: 0.9 },
      ],
      T0,
    );
    expect(h.events.map((e) => e.value)).toEqual([0.5, 0.8, 0.9]);
    expect(h.current?.value).toBe(0.9);
    expect(h.previous?.value).toBe(0.8);
    expect(h.timesBeaten).toBe(2);
    expect(h.standingDays).toBe(0);
  });

  it('rollingAverages: trailing means aligned to input with null warm-up', () => {
    expect(rollingAverages([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
    expect(rollingAverages([5], 3)).toEqual([null]);
    expect(rollingAverages([], 2)).toEqual([]);
  });

  it('buildWorkoutAnalytics: completion rate and consecutive-day runs', () => {
    const instances = [
      workout('2026-01-18', 'completed'),
      workout('2026-01-19', 'completed'),
      workout('2026-01-20', 'active', 4, 2), // today, partially played
      workout('2026-01-15', 'completed'), // gap: breaks runs
    ];
    const a = buildWorkoutAnalytics(instances, 27);
    expect(a.loadedInstances).toBe(4);
    expect(a.completedInstances).toBe(3);
    expect(a.completionRate).toBeCloseTo(0.75, 10);
    expect(a.gamesAssigned).toBe(16);
    expect(a.gamesCompleted).toBe(14);
    // Newest completed day is the 19th (today is still active): the current
    // run counts back over 18→19 = 2; the gap to the 15th breaks it there.
    expect(a.currentCompletedRun).toBe(2);
    expect(a.longestCompletedRun).toBe(2);
    expect(a.lifetimeCompleted).toBe(27);
  });

  it('buildDomainBreadthPerformance: groups days by distinct domains trained', () => {
    const resolve = (gameId: string) =>
      ({ mem: 'Memory', att: 'Attention' })[gameId] ?? null;
    const sessions = [
      session({ id: '1', gameId: 'mem', completedAt: T0, normalizedResult: 0.6 }),
      session({ id: '2', gameId: 'att', completedAt: T0, normalizedResult: 0.8 }),
      session({ id: '3', gameId: 'mem', completedAt: T0 - DAY, normalizedResult: 0.4 }),
      session({ id: '4', gameId: 'unknown', completedAt: T0 - 2 * DAY }),
    ];
    const view = buildDomainBreadthPerformance(sessions, resolve);
    expect(view.daysConsidered).toBe(2);
    expect(view.unmappedDays).toBe(1);
    const breadth2 = view.groups.find((g) => g.breadth === 2)!;
    expect(breadth2.days).toBe(1);
    expect(breadth2.sessions).toBe(2);
    expect(breadth2.avgNormalized).toBeCloseTo(0.7, 10);
    const breadth1 = view.groups.find((g) => g.breadth === 1)!;
    expect(breadth1.avgNormalized).toBeCloseTo(0.4, 10);
  });

  it('activeRuns: current and longest consecutive active-day runs in the window', () => {
    const cal = {
      days: [
        { dateKey: 'd6', offsetDays: 6, count: 1, hasSession: true },
        { dateKey: 'd5', offsetDays: 5, count: 0, hasSession: false },
        { dateKey: 'd4', offsetDays: 4, count: 2, hasSession: true },
        { dateKey: 'd3', offsetDays: 3, count: 1, hasSession: true },
        { dateKey: 'd2', offsetDays: 2, count: 0, hasSession: false },
        { dateKey: 'd1', offsetDays: 1, count: 1, hasSession: true },
        { dateKey: 'd0', offsetDays: 0, count: 1, hasSession: true },
      ],
      activeDays: 5,
      totalSessions: 6,
      avgPerActiveDay: 1.2,
      busiest: null,
    };
    const runs = activeRuns(cal);
    expect(runs.current).toBe(2); // d1, d0
    expect(runs.longest).toBe(2); // d4-d3 or d1-d0
  });

  it('weekdayDistribution: buckets calendar cells by UTC weekday deterministically', () => {
    const cal = {
      days: [
        { dateKey: '2026-01-18', offsetDays: 2, count: 2, hasSession: true }, // Sunday
        { dateKey: '2026-01-19', offsetDays: 1, count: 1, hasSession: true }, // Monday
        { dateKey: '2026-01-20', offsetDays: 0, count: 0, hasSession: false }, // Tuesday
      ],
      activeDays: 2,
      totalSessions: 3,
      avgPerActiveDay: 1.5,
      busiest: null,
    };
    const buckets = weekdayDistribution(cal);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].label).toBe('Sun'); // getUTCDay: 2026-01-18 is a Sunday
    expect(buckets[0].sessions).toBe(2);
    expect(buckets[1].sessions).toBe(1);
    expect(buckets[2].sessions).toBe(0);
  });
});
