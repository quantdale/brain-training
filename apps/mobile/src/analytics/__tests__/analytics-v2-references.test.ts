/**
 * Campaign 011 W09 — metric equivalence vs authoritative naive references
 * (part 2: workout-analytics, activity-calendar, training-balance + weekly
 * slices, category-comparison DomainInsight reuse, co-occurrence breadth +
 * disclaimer presence, no-fabrication string audit, projection-shim parity
 * through the V2 builders, and a seeded 20k-session scale check).
 *
 * Part 1 lives in `analytics-v2-equivalence.test.ts` (trend/volume/rolling/
 * personal-best/difficulty/metric-trends). Same boundary convention as there:
 * headline windows `[start, now]`, weekly tiles `(end-7d, end]`, session ages
 * `[7k, 7(k+1))`, future-dated rows count nowhere, and calendar totals come
 * from grid cells only.
 */

import { describe, expect, it } from '@jest/globals';

import type {
  DomainRating,
  GameSessionRecord,
  RatingHistoryEntry,
  WorkoutInstance,
} from '@/db';

import {
  activeRuns,
  balanceCoverage,
  balanceEffectiveDomains,
  buildActivityCalendar,
  buildCategoryComparison,
  buildDomainBreadthPerformance,
  buildDomainInsights,
  buildNormalizedBestHistory,
  buildSessionVolume,
  buildTrainingBalance,
  buildWeeklyBalance,
  buildWorkoutAnalytics,
  COOCCURRENCE_CAPTION,
  compareRecentVsLifetime,
  daysSinceLastSession,
  explainMetric,
  monthlyActivity,
  summarizePointTrend,
  weekdayDistribution,
} from '@/analytics';

import { sessionRecordFromProjection, type ProjectedSessionRow } from '../projections';
import {
  buildAccuracyTrend,
  buildReactionTrend,
} from '../metric-trends';
import { buildDifficultyProgression } from '../difficulty-progression';
import { buildGameInsight } from '../game-insights';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const T0 = Date.UTC(2026, 0, 20); // fixed clock: 2026-01-20 (a Tuesday)

let seq = 0;
function mkSession(over: Partial<GameSessionRecord>): GameSessionRecord {
  seq += 1;
  return {
    id: `r2-s${seq}`,
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
    durationMs: 60_000,
    ...over,
  };
}

function mkWorkout(
  date: string,
  status: 'active' | 'completed',
  games = 3,
  done = 0,
): WorkoutInstance {
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

/** Deterministic RNG (mulberry32) — same generator as part 1. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// workout-analytics
// ---------------------------------------------------------------------------

describe('buildWorkoutAnalytics equivalence vs naive run computation', () => {
  function refAnalytics(instances: WorkoutInstance[], lifetimeCompleted: number) {
    // Latest write wins per date.
    const byDate = new Map<string, WorkoutInstance>();
    for (const i of instances) {
      byDate.set(i.date, i);
    }
    const loaded = [...byDate.values()];
    const completedDates = loaded
      .filter((i) => i.status === 'completed')
      .map((i) => i.date)
      .sort();
    const toMs = (k: string) => {
      const [y, m, d] = k.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of completedDates) {
      run = prev !== null && (toMs(d) - toMs(prev)) / DAY === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }
    let current = 0;
    if (completedDates.length > 0) {
      current = 1;
      for (let i = completedDates.length - 2; i >= 0; i -= 1) {
        if ((toMs(completedDates[i + 1]) - toMs(completedDates[i])) / DAY === 1) {
          current += 1;
        } else {
          break;
        }
      }
    }
    return {
      loadedInstances: loaded.length,
      completedInstances: completedDates.length,
      completionRate:
        loaded.length > 0 ? completedDates.length / loaded.length : null,
      gamesAssigned: loaded.reduce((s, i) => s + i.gameIds.length, 0),
      gamesCompleted: loaded.reduce(
        (s, i) => s + Math.min(i.currentIndex, i.gameIds.length),
        0,
      ),
      currentCompletedRun: current,
      longestCompletedRun: longest,
    };
  }

  const fixtures: { name: string; instances: WorkoutInstance[] }[] = [
    { name: 'empty', instances: [] },
    {
      name: 'year-and-month rollover',
      instances: [
        mkWorkout('2025-12-30', 'completed'),
        mkWorkout('2025-12-31', 'completed'),
        mkWorkout('2026-01-01', 'completed'),
        mkWorkout('2026-01-02', 'active', 3, 2), // unfinished today: does not break runs
      ],
    },
    {
      name: 'duplicate dates collapse latest-wins',
      instances: [
        mkWorkout('2026-01-19', 'active', 3, 1),
        mkWorkout('2026-01-19', 'completed'), // later row wins
        mkWorkout('2026-01-18', 'completed'),
      ],
    },
    {
      name: 'gap splits runs',
      instances: [
        mkWorkout('2026-01-12', 'completed'),
        mkWorkout('2026-01-13', 'completed'),
        mkWorkout('2026-01-16', 'completed'),
        mkWorkout('2026-01-17', 'completed'),
        mkWorkout('2026-01-18', 'completed'),
      ],
    },
    {
      name: 'corrupt currentIndex clamps',
      instances: [mkWorkout('2026-01-19', 'active', 2, 9)],
    },
  ];

  for (const fx of fixtures) {
    it(`fixture: ${fx.name}`, () => {
      const got = buildWorkoutAnalytics(fx.instances, 41);
      const want = refAnalytics(fx.instances, 41);
      expect(got.loadedInstances).toBe(want.loadedInstances);
      expect(got.completedInstances).toBe(want.completedInstances);
      expect(got.completionRate).toBe(want.completionRate);
      expect(got.gamesAssigned).toBe(want.gamesAssigned);
      expect(got.gamesCompleted).toBe(want.gamesCompleted);
      expect(got.currentCompletedRun).toBe(want.currentCompletedRun);
      expect(got.longestCompletedRun).toBe(want.longestCompletedRun);
      expect(got.lifetimeCompleted).toBe(41);
    });
  }

  it('only persisted completed status counts (partial play never inflates)', () => {
    const a = buildWorkoutAnalytics([mkWorkout('2026-01-20', 'active', 4, 4)], 0); // fully played, not durably completed
    expect(a.completedInstances).toBe(0);
    expect(a.gamesCompleted).toBe(4);
    expect(a.currentCompletedRun).toBe(0);
    expect(a.completionRate).toBe(0);
  });

  it('date-key arithmetic is timezone-independent (plain UTC parsing, leap-day adjacency)', () => {
    const runs = buildWorkoutAnalytics(
      [
        mkWorkout('2028-02-27', 'completed'),
        mkWorkout('2028-02-28', 'completed'),
        mkWorkout('2028-02-29', 'completed'),
        mkWorkout('2028-03-01', 'completed'),
      ],
      0,
    );
    expect(runs.currentCompletedRun).toBe(4);
    expect(runs.longestCompletedRun).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// activity-calendar
// ---------------------------------------------------------------------------

describe('activity-calendar equivalence vs cell-map reference', () => {
  // Sessions inside, beyond and after the grid.
  const sessions = [
    mkSession({ id: 'in-grid-today', completedAt: T0 }),
    mkSession({ id: 'in-grid-y-1', completedAt: T0 - DAY }),
    mkSession({ id: 'in-grid-y-2', completedAt: T0 - DAY }),
    mkSession({ id: 'old-beyond-grid', completedAt: T0 - 60 * DAY }),
    mkSession({ id: 'corrupt-future', completedAt: T0 + 3 * DAY }),
  ];

  function keyOf(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function refCalendar(list: GameSessionRecord[], dayCount: number, nowMs: number) {
    const counts = new Map<string, number>();
    for (const s of list) {
      counts.set(keyOf(s.completedAt), (counts.get(keyOf(s.completedAt)) ?? 0) + 1);
    }
    const cells: { key: string; offset: number; count: number }[] = [];
    for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
      const key = keyOf(nowMs - offset * DAY);
      cells.push({ key, offset, count: counts.get(key) ?? 0 });
    }
    const total = cells.reduce((s, c) => s + c.count, 0);
    let busiest: { key: string; offset: number; count: number } | null = null;
    for (const c of cells) {
      if (
        busiest === null ||
        c.count > busiest.count ||
        (c.count === busiest.count && c.offset < busiest.offset)
      ) {
        if (c.count > 0) {
          busiest = c;
        }
      }
    }
    return {
      cells,
      total,
      activeDays: cells.filter((c) => c.count > 0).length,
      busiestKey: busiest?.key ?? null,
      busiestOffset: busiest?.offset ?? null,
    };
  }

  it('totalSessions comes from grid cells only (regression: full-history rows used to inflate it)', () => {
    const cal = buildActivityCalendar(sessions, 14, T0);
    expect(cal.days).toHaveLength(14);
    expect(cal.totalSessions).toBe(3); // in-grid only; 60d-old + future rows excluded
    expect(cal.activeDays).toBe(2);
    expect(cal.avgPerActiveDay).toBeCloseTo(1.5, 12);
    // Every displayed number traces to the rendered cells.
    expect(cal.totalSessions).toBe(cal.days.reduce((s, d) => s + d.count, 0));
  });

  it('matches the reference on every fixture × grid size', () => {
    const rngSeeded = mulberry32(99);
    const spread = Array.from({ length: 30 }, (_, i) =>
      mkSession({
        completedAt: T0 - Math.floor(rngSeeded() * 90) * DAY - Math.floor(rngSeeded() * DAY),
      }),
    );
    spread.push(
      mkSession({ completedAt: Date.UTC(2026, 0, 17, 23, 59, 59, 999) }),
      mkSession({ completedAt: Date.UTC(2026, 0, 18, 0, 0, 0, 0) }), // adjacent UTC day
    );
    for (const list of [[], sessions, spread]) {
      for (const dayCount of [1, 7, 14, 90]) {
        const got = buildActivityCalendar(list, dayCount, T0);
        const want = refCalendar(list, dayCount, T0);
        expect(got.totalSessions).toBe(want.total);
        expect(got.activeDays).toBe(want.activeDays);
        expect(got.busiest?.dateKey ?? null).toBe(want.busiestKey);
        expect(got.busiest?.offsetDays ?? null).toBe(want.busiestOffset);
        expect(got.days.map((d) => [d.dateKey, d.offsetDays, d.count])).toEqual(
          want.cells.map((c) => [c.key, c.offset, c.count]),
        );
      }
    }
  });

  it('UTC-midnight instants land in adjacent cells regardless of device timezone', () => {
    const cal = buildActivityCalendar(
      [
        mkSession({ completedAt: Date.UTC(2026, 0, 19, 23, 59, 59, 999) }),
        mkSession({ completedAt: Date.UTC(2026, 0, 20, 0, 0, 0, 0) }),
      ],
      3,
      T0,
    );
    expect(cal.days.map((d) => `${d.dateKey}:${d.count}`)).toEqual([
      '2026-01-18:0',
      '2026-01-19:1',
      '2026-01-20:1',
    ]);
  });

  it('activeRuns matches naive scan; current run ends at the newest cell', () => {
    const cal = buildActivityCalendar(
      [
        mkSession({ completedAt: T0 }),
        mkSession({ completedAt: T0 - DAY }),
        mkSession({ completedAt: T0 - 3 * DAY }),
        mkSession({ completedAt: T0 - 4 * DAY }),
        mkSession({ completedAt: T0 - 5 * DAY }),
      ],
      7,
      T0,
    );
    const flags = cal.days.map((d) => d.hasSession);
    let longest = 0;
    let run = 0;
    for (const f of flags) {
      run = f ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    let current = 0;
    for (let i = flags.length - 1; i >= 0 && flags[i]; i -= 1) {
      current += 1;
    }
    expect(activeRuns(cal)).toEqual({ current, longest });
    expect(activeRuns(cal)).toEqual({ current: 2, longest: 3 });
  });

  it('weekday buckets match getUTCDay references; monthly rollup is honest about partial months', () => {
    const cal = buildActivityCalendar(sessions, 14, T0);
    const wd = weekdayDistribution(cal);
    expect(wd).toHaveLength(7);
    const byLabel = new Map(wd.map((b) => [b.label, b]));
    // 2026-01-20 is a Tuesday; 2026-01-19 a Monday.
    expect(byLabel.get('Tue')).toMatchObject({ weekday: 2, sessions: 1, activeDays: 1 });
    expect(byLabel.get('Mon')).toMatchObject({ weekday: 1, sessions: 2, activeDays: 1 });
    expect(wd.reduce((s, b) => s + b.sessions, 0)).toBe(cal.totalSessions);

    // Grid ending noon Jan 1 covers Dec 30..Jan 1: two calendar months, both partial-ish.
    const decGrid = buildActivityCalendar(
      [mkSession({ completedAt: Date.UTC(2025, 11, 31) })],
      3,
      Date.UTC(2026, 0, 1, 12),
    );
    expect(monthlyActivity(decGrid)).toEqual([
      { monthKey: '2025-12', sessions: 1, activeDays: 1 },
      { monthKey: '2026-01', sessions: 0, activeDays: 0 },
    ]);
  });

  it('daysSinceLastSession ignores corrupt future rows (never negative)', () => {
    // Newest stored row is future-dated; recency must fall back to the newest
    // real session (today → 0), matching the family-wide upper clamp.
    expect(daysSinceLastSession(sessions, T0)).toBe(0);
    expect(daysSinceLastSession([mkSession({ completedAt: T0 - 2 * DAY - 1 })], T0)).toBe(2);
    expect(
      daysSinceLastSession([mkSession({ completedAt: T0 + DAY })], T0),
    ).toBeNull(); // nothing but future rows → no observable history
    expect(daysSinceLastSession([], T0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// training-balance + weekly slices
// ---------------------------------------------------------------------------

describe('training-balance equivalence vs naive groupby', () => {
  const KNOWN: readonly string[] = ['Memory', 'Attention', 'Speed', 'Language'];
  const resolve = (gameId: string) =>
    (({ mem: 'Memory', att: 'Attention', spd: 'Speed' }) as Record<string, string>)[gameId] ??
    null;

  const sessions = [
    mkSession({ gameId: 'mem', completedAt: T0 - DAY }),
    mkSession({ gameId: 'mem', completedAt: T0 - 2 * DAY }),
    mkSession({ gameId: 'att', completedAt: T0 - 3 * DAY }),
    mkSession({ gameId: 'unknown-game', completedAt: T0 - 4 * DAY }),
    mkSession({ gameId: 'mem', completedAt: T0 - 40 * DAY }), // outside 7d window
    mkSession({ gameId: 'att', completedAt: T0 + DAY }), // corrupt future row
  ];

  it('shares, ordering and unmapped accounting match the reference across windows', () => {
    for (const key of ['7d', '30d', 'all'] as const) {
      const got = buildTrainingBalance(sessions, resolve, KNOWN, T0, key);
      const stored = sessions.filter((s) => s.completedAt <= T0);
      const filtered =
        key === 'all'
          ? stored
          : stored.filter((s) => s.completedAt >= T0 - (key === '7d' ? 7 : 30) * DAY);
      const counts = new Map<string, number>();
      let unmapped = 0;
      for (const s of filtered) {
        const d = resolve(s.gameId);
        if (d === null) {
          unmapped += 1;
        } else {
          counts.set(d, (counts.get(d) ?? 0) + 1);
        }
      }
      const mapped = filtered.length - unmapped;
      expect(got.windowSessions).toBe(filtered.length);
      expect(got.mappedSessions).toBe(mapped);
      expect(got.unmappedSessions).toBe(unmapped);
      expect(got.trainedDomains).toBe(counts.size);
      expect(got.untrainedDomains).toEqual(KNOWN.filter((d) => !counts.has(d)));
      const rank = (d: string) => (KNOWN.indexOf(d) === -1 ? KNOWN.length : KNOWN.indexOf(d));
      const wantRows = [...KNOWN]
        .map((domain) => ({
          domain,
          sessions: counts.get(domain) ?? 0,
          share: mapped > 0 ? (counts.get(domain) ?? 0) / mapped : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions || rank(a.domain) - rank(b.domain));
      expect(got.perDomain).toEqual(wantRows);
      expect(got.topDomain).toBe(wantRows.find((r) => r.sessions > 0)?.domain ?? null);
    }
  });

  it('effective domains equal min(1/Σshare², mapped) incl. the evenness clamp', () => {
    const even = buildTrainingBalance(
      [
        mkSession({ gameId: 'mem', completedAt: T0 - DAY }),
        mkSession({ gameId: 'att', completedAt: T0 - DAY }),
        mkSession({ gameId: 'spd', completedAt: T0 - DAY }),
      ],
      resolve,
      KNOWN,
      T0,
      '30d',
    );
    expect(balanceEffectiveDomains(even)).toBeCloseTo(3, 12); // perfectly even → exactly N
    const solo = buildTrainingBalance(
      [mkSession({ gameId: 'mem', completedAt: T0 - DAY })],
      resolve,
      KNOWN,
      T0,
      '30d',
    );
    expect(balanceEffectiveDomains(solo)).toBeCloseTo(1, 12);
    expect(balanceEffectiveDomains(buildTrainingBalance([], resolve, KNOWN, T0, '30d'))).toBe(0);
    expect(balanceCoverage(even, KNOWN)).toBeCloseTo(3 / 4, 12);
    expect(balanceCoverage(even, [])).toBe(0);
  });

  it('weekly slices tile right-closed: shared edges owned by the newer slice', () => {
    const edgeRows = [
      mkSession({ gameId: 'mem', completedAt: T0 }), // newest slice owns t == now
      mkSession({ gameId: 'mem', completedAt: T0 - WEEK }), // slice w=1 owns the shared edge
      mkSession({ gameId: 'att', completedAt: T0 - DAY }),
      mkSession({ gameId: 'spd', completedAt: T0 - WEEK - DAY }),
      mkSession({ gameId: 'mem', completedAt: T0 + 3600_000 }), // future: nowhere
      mkSession({ gameId: 'att', completedAt: T0 - 3 * WEEK - 1 }), // predates history
    ];
    const slices = buildWeeklyBalance(edgeRows, resolve, KNOWN, T0, 3);
    expect(slices.map((s) => s.endOffsetDays)).toEqual([14, 7, 0]); // oldest first
    expect(slices[2].sessions).toBe(2); // 'now' + inside week 0
    expect(slices[1].sessions).toBe(2); // shared edge + inside week 1
    expect(slices[0].sessions).toBe(0);
    // Sum invariant: Σ slices == rows inside the tiled history (now−21d, now].
    expect(slices.reduce((s, x) => s + x.sessions, 0)).toBe(
      edgeRows.filter((s) => s.completedAt > T0 - 3 * WEEK && s.completedAt <= T0).length,
    );
    // Canonical domain order preserved per slice (stable stacked colors).
    expect(slices[2].perDomain.map((d) => d.domain)).toEqual([...KNOWN]);
  });

  it('weekly slice shares match a naive per-slice groupby on randomized fixtures', () => {
    const rng = mulberry32(4242);
    const bulk = Array.from({ length: 200 }, () =>
      mkSession({
        gameId: ['mem', 'att', 'spd', 'zz'][Math.floor(rng() * 4)],
        completedAt: T0 - Math.floor(rng() * 25) * DAY - Math.floor(rng() * DAY),
        normalizedResult: rng(),
      }),
    );
    const slices = buildWeeklyBalance(bulk, resolve, KNOWN, T0, 4);
    for (let w = 0; w < 4; w += 1) {
      const end = T0 - w * WEEK;
      // Tiles never extend past now, so every member is storable evidence.
      const members = bulk.filter((s) => s.completedAt > end - WEEK && s.completedAt <= end);
      const slice = slices[3 - w]; // oldest first
      expect(slice.sessions).toBe(members.length);
      for (const entry of slice.perDomain) {
        const n = members.filter((s) => resolve(s.gameId) === entry.domain).length;
        expect(entry.sessions).toBe(n);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// category-comparison: DomainInsight reuse proof + naive session stats
// ---------------------------------------------------------------------------

describe('category-comparison reuses DomainInsight verbatim and groups sessions correctly', () => {
  const KNOWN = ['Memory', 'Attention', 'Speed'] as const;
  const resolve = (gameId: string) =>
    (({ mem: 'Memory', att: 'Attention' }) as Record<string, string>)[gameId] ?? null;

  const ratings: DomainRating[] = [
    { domain: 'Memory', rating: 1020, sessions: 3, updatedAt: T0 - 2 * DAY },
    { domain: 'Speed', rating: 980, sessions: 1, updatedAt: T0 - 40 * DAY },
  ];
  const history: RatingHistoryEntry[] = [
    { id: 1, sessionId: 'x', domain: 'Memory', delta: 20, ratingAfter: 1010, createdAt: T0 - 10 * DAY },
    { id: 2, sessionId: 'y', domain: 'Memory', delta: 10, ratingAfter: 1020, createdAt: T0 - DAY },
    { id: 3, sessionId: 'z', domain: 'Speed', delta: -20, ratingAfter: 980, createdAt: T0 - 40 * DAY },
  ];
  const sessions = [
    mkSession({ gameId: 'mem', completedAt: T0 - DAY, normalizedResult: 0.8 }),
    mkSession({ gameId: 'mem', completedAt: T0 - 2 * DAY, normalizedResult: 0.6 }),
    mkSession({ gameId: 'att', completedAt: T0 - 3 * DAY, normalizedResult: 0.9 }),
    mkSession({ gameId: 'unmapped', completedAt: T0 - DAY }),
    mkSession({ gameId: 'mem', completedAt: T0 - 45 * DAY, normalizedResult: 1 }), // outside 30d
  ];

  function build() {
    const insights = buildDomainInsights(ratings, KNOWN, history, T0, '30d');
    const cmp = buildCategoryComparison({
      insights,
      sessions,
      resolveDomain: resolve,
      nowMs: T0,
      windowKey: '30d',
    });
    return { insights, cmp };
  }

  it('rating/status/movement/direction columns are the insight values, byte for byte', () => {
    const { insights, cmp } = build();
    expect(cmp.rows).toHaveLength(insights.length);
    for (const insight of insights) {
      const row = cmp.rows.find((r) => r.domain === insight.domain)!;
      expect(row.rating).toBe(insight.rating);
      expect(row.status).toBe(insight.status);
      expect(row.movement).toBe(insight.windowMovement);
      expect(row.direction).toBe(insight.direction);
    }
  });

  it('session stats and ordering match a naive groupby (sessions desc, then avg, then canonical)', () => {
    const { cmp } = build();
    const inWindow = sessions.filter(
      (s) => s.completedAt <= T0 && s.completedAt >= T0 - 30 * DAY,
    );
    const byDomain = new Map<string, GameSessionRecord[]>();
    for (const s of inWindow) {
      const d = resolve(s.gameId);
      if (d === null) {
        continue;
      }
      byDomain.set(d, [...(byDomain.get(d) ?? []), s]);
    }
    expect(cmp.mappedSessions).toBe(3); // unmapped game never attributed
    const memory = cmp.rows.find((r) => r.domain === 'Memory')!;
    const memList = byDomain.get('Memory')!;
    expect(memory.sessions).toBe(memList.length);
    expect(memory.avgNormalized!).toBeCloseTo(
      memList.reduce((s, x) => s + x.normalizedResult, 0) / memList.length,
      12,
    );
    expect(memory.bestNormalized!).toBe(Math.max(...memList.map((s) => s.normalizedResult)));
    expect(memory.lastCompletedAt!).toBe(Math.max(...memList.map((s) => s.completedAt)));
    expect(cmp.rows.find((r) => r.domain === 'Speed')).toMatchObject({
      sessions: 0,
      avgNormalized: null,
      bestNormalized: null,
      lastCompletedAt: null,
    });
    // Ordering: Memory (2 sessions) before Attention (1); unseen domain last.
    expect(cmp.rows.map((r) => r.domain)).toEqual(['Memory', 'Attention', 'Speed']);
  });
});

// ---------------------------------------------------------------------------
// co-occurrence breadth + mandatory disclaimer
// ---------------------------------------------------------------------------

describe('cooccurrence breadth equivalence vs naive day grouping (+ disclaimer presence)', () => {
  const resolve = (gameId: string) =>
    (({ mem: 'Memory', att: 'Attention' }) as Record<string, string>)[gameId] ?? null;

  it('matches the naive day→domains map incl. mixed and unmapped-only days', () => {
    const sessions = [
      mkSession({ gameId: 'mem', completedAt: Date.UTC(2026, 0, 18, 9), normalizedResult: 0.6 }),
      mkSession({ gameId: 'att', completedAt: Date.UTC(2026, 0, 18, 15), normalizedResult: 0.8 }),
      mkSession({ gameId: 'zz', completedAt: Date.UTC(2026, 0, 18, 16) }), // mixed day stays considered
      mkSession({ gameId: 'zz', completedAt: Date.UTC(2026, 0, 19, 10) }), // unmapped-only day
      mkSession({ gameId: 'mem', completedAt: Date.UTC(2026, 0, 20, 2), normalizedResult: 0.7 }),
      mkSession({ gameId: 'mem', completedAt: Date.UTC(2026, 0, 20, 2) }), // duplicate timestamp
    ];
    const got = buildDomainBreadthPerformance(sessions, resolve);

    // Reference: group by UTC day over mapped sessions only.
    const domPerDay = new Map<string, Set<string>>();
    const valsPerDay = new Map<string, number[]>();
    const allKeys = new Set<string>();
    for (const s of sessions) {
      const key = new Date(s.completedAt).toISOString().slice(0, 10);
      allKeys.add(key);
      const d = resolve(s.gameId);
      if (d === null) {
        continue;
      }
      domPerDay.set(key, (domPerDay.get(key) ?? new Set()).add(d));
      valsPerDay.set(key, [...(valsPerDay.get(key) ?? []), s.normalizedResult]);
    }
    expect(got.daysConsidered).toBe(domPerDay.size);
    expect(got.unmappedDays).toBe(allKeys.size - domPerDay.size);

    const breadthAgg = new Map<number, { days: Set<string>; sessions: number; sum: number }>();
    for (const [key, doms] of domPerDay) {
      const b = doms.size;
      const agg = breadthAgg.get(b) ?? { days: new Set<string>(), sessions: 0, sum: 0 };
      agg.days.add(key);
      const vals = valsPerDay.get(key)!;
      agg.sessions += vals.length;
      agg.sum += vals.reduce((a, x) => a + x, 0);
      breadthAgg.set(b, agg);
    }
    const wantGroups = [...breadthAgg.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([breadth, agg]) => ({
        breadth,
        days: agg.days.size,
        sessions: agg.sessions,
        avgNormalized: agg.sum / agg.sessions,
      }));
    expect(got.groups).toEqual(wantGroups);
  });

  it('UTC midnight split puts same-evening sessions into different breadth days deterministically', () => {
    const view = buildDomainBreadthPerformance(
      [
        mkSession({ gameId: 'mem', completedAt: Date.UTC(2026, 0, 19, 23, 59, 59, 999) }),
        mkSession({ gameId: 'att', completedAt: Date.UTC(2026, 0, 20, 0, 0, 0, 0) }),
      ],
      resolve,
    );
    // Two distinct UTC days, each with breadth 1 — no phantom breadth-2 day.
    expect(view.groups).toEqual([{ breadth: 1, days: 2, sessions: 2, avgNormalized: 0.5 }]);
  });

  it('the mandatory non-causal disclaimer ships and is non-empty', () => {
    expect(COOCCURRENCE_CAPTION.length).toBeGreaterThan(20);
    expect(COOCCURRENCE_CAPTION).toMatch(/cause/i);
    expect(explainMetric('cooccurrence')).toMatch(/cause and effect/i);
  });
});

// ---------------------------------------------------------------------------
// no-fabrication string audit (constitution §4: no efficacy language)
// ---------------------------------------------------------------------------

describe('no-fabrication audit of Progress presentation strings', () => {
  // Strong efficacy/clinical vocabulary that must never appear: these would
  // turn training records into cognitive-efficacy claims. Factual movement
  // words ("up", "higher", "lower is faster") are allowed.
  const FORBIDDEN =
    /(clin\w+|therapeut\w+|cur(?:e|es|ed|ing)\b|heal\w*|prevents?\b|proven\b|scientifically\b|efficac\w+|smarter\b|\bIQ\b|brain health|medical\b|diagnos\w+)/i;

  const KEYS = [
    'composite',
    'domain-rating',
    'domain-movement',
    'domain-best',
    'avg-normalized',
    'recent-form',
    'best-normalized',
    'score',
    'accuracy',
    'reaction',
    'difficulty',
    'duration',
    'balance',
    'activity-calendar',
    'recency',
    'recent-vs-lifetime',
    'trend-summary',
    'volume',
    'accuracy-trend',
    'reaction-trend',
    'difficulty-progression',
    'personal-best-history',
    'rolling-average',
    'category-comparison',
    'workout-completion',
    'cooccurrence',
    'diversity',
    'activity-runs',
    'weekday-pattern',
  ] as const;

  it('every metric key has a substantive, neutral derivation note', () => {
    for (const key of KEYS) {
      const note = explainMetric(key);
      expect(note.length).toBeGreaterThan(20);
      expect(note).not.toMatch(FORBIDDEN);
    }
  });

  it('key notes state their derivations explicitly (traceability contract)', () => {
    expect(explainMetric('difficulty-progression')).toMatch(/neutrally|not a better or worse/i);
    expect(explainMetric('volume')).toMatch(/preceding window of equal length/i);
    expect(explainMetric('workout-completion')).toMatch(/persisted workout status/i);
    expect(explainMetric('composite')).toMatch(/average/i);
  });
});

// ---------------------------------------------------------------------------
// projection-shim parity through the V2 builders (queries fast path ≡ legacy)
// ---------------------------------------------------------------------------

describe('projection shim records drive identical builder outputs to real blobs', () => {
  interface Case {
    name: string;
    projected: Partial<ProjectedSessionRow>;
    fullBlob: { rawResult?: Record<string, unknown> | null; difficulty?: Record<string, unknown> | null };
  }

  const cases: Case[] = [
    { name: 'no metrics', projected: {}, fullBlob: {} },
    {
      name: 'score via points field (SQL resolved priority)',
      projected: { mScore: 55 },
      fullBlob: { rawResult: { points: 55 } },
    },
    {
      name: 'unclamped accuracy',
      projected: { mAccuracy: 1.5 },
      fullBlob: { rawResult: { accuracy: 1.5 } },
    },
    {
      name: 'reaction mean+best collapses to mean',
      projected: { mReactionMs: 400 },
      fullBlob: { rawResult: { avgResponseMs: 400, fastestReactionMs: 300 } },
    },
    {
      name: 'named difficulty level',
      projected: { mDifficultyLevel: 'hard' },
      fullBlob: { difficulty: { level: 'hard' } },
    },
    {
      name: 'numeric difficulty rating',
      projected: { mDifficultyRating: 0.65 },
      fullBlob: { difficulty: { challengeRating: 0.65 } },
    },
  ];

  function pair(c: Case): { fast: GameSessionRecord; legacy: GameSessionRecord } {
    const base: Partial<ProjectedSessionRow> = {
      id: 'p1',
      gameId: 'memory-match',
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 42,
      normalizedResult: 0.72,
      xp: 14,
      startedAt: T0 - 90_000,
      completedAt: T0 - 50_000,
      durationMs: 40_000,
      // Real projection rows always carry explicit NULL-able columns; the shim
      // mapping distinguishes "column absent" from "column NULL", so the
      // fixture must mirror the SQL shape exactly.
      mScore: null,
      mAccuracy: null,
      mReactionMs: null,
      mDifficultyRating: null,
      mDifficultyLevel: null,
    };
    const fast = sessionRecordFromProjection({
      ...base,
      ...c.projected,
    } as ProjectedSessionRow);
    const legacyBase = sessionRecordFromProjection(base as ProjectedSessionRow);
    const legacy: GameSessionRecord = {
      ...legacyBase,
      rawResult: (c.fullBlob.rawResult ?? null) as GameSessionRecord['rawResult'],
      difficulty: (c.fullBlob.difficulty ?? null) as GameSessionRecord['difficulty'],
    };
    return { fast, legacy };
  }

  for (const c of cases) {
    it(`${c.name}: all builders agree on both paths`, () => {
      const { fast, legacy } = pair(c);
      const resolve = (g: string) => (g === 'memory-match' ? 'Memory' : null);

      // Single-record builders must be identical between paths.
      expect(buildGameInsight('memory-match', [fast])).toEqual(
        buildGameInsight('memory-match', [legacy]),
      );
      expect(buildAccuracyTrend([fast])).toEqual(buildAccuracyTrend([legacy]));
      expect(buildReactionTrend([fast])).toEqual(buildReactionTrend([legacy]));
      expect(buildDifficultyProgression([fast])).toEqual(
        buildDifficultyProgression([legacy]),
      );
      expect(buildNormalizedBestHistory([fast], T0)).toEqual(
        buildNormalizedBestHistory([legacy], T0),
      );
      expect(compareRecentVsLifetime([fast], '30d', T0)).toEqual(
        compareRecentVsLifetime([legacy], '30d', T0),
      );
      expect(summarizePointTrend([{ t: fast.completedAt, value: fast.normalizedResult }])).toEqual(
        summarizePointTrend([{ t: legacy.completedAt, value: legacy.normalizedResult }]),
      );
      expect(buildDomainBreadthPerformance([fast], resolve)).toEqual(
        buildDomainBreadthPerformance([legacy], resolve),
      );
      expect(buildSessionVolume([fast], T0, '30d').windowSessions).toBe(
        buildSessionVolume([legacy], T0, '30d').windowSessions,
      );

      // Mixed two-record list: metric series are the union of both paths'.
      const accValues = [...buildAccuracyTrend([fast]).series, ...buildAccuracyTrend([legacy]).series]
        .map((p) => p.value)
        .sort((a, b) => a - b);
      expect(buildAccuracyTrend([fast, legacy]).series.map((p) => p.value).sort((a, b) => a - b)).toEqual(accValues);
    });
  }
});

// ---------------------------------------------------------------------------
// scale: 20k seeded sessions
// ---------------------------------------------------------------------------

describe('scale @20k seeded sessions (correctness + finiteness, no timing assertions)', () => {
  function generateScale(seed: number, count: number): GameSessionRecord[] {
    const rng = mulberry32(seed);
    const games = ['mem', 'att', 'spd', 'lang', 'num', 'vis'];
    const out: GameSessionRecord[] = [];
    for (let i = 0; i < count; i += 1) {
      const ageDays = rng() * 400; // ~400 days of history
      const t = Math.floor(T0 - ageDays * DAY - rng() * DAY);
      out.push(
        mkSession({
          gameId: games[Math.floor(rng() * games.length)],
          completedAt: t,
          startedAt: t - 30_000,
          normalizedResult: rng(),
          rawResult:
            rng() < 0.7
              ? {
                  score: Math.floor(rng() * 500),
                  accuracy: rng(),
                  avgResponseMs: 250 + Math.floor(rng() * 400),
                }
              : {},
          difficulty: rng() < 0.8 ? { challengeRating: rng() } : { level: 'hard' },
          durationMs: 20_000 + Math.floor(rng() * 100_000),
        }),
      );
    }
    return out;
  }

  it('every V2 view agrees with efficient references and leaks no NaN/±Infinity', () => {
    const started = Date.now();
    const sessions = generateScale(20260821, 20_000);

    // Volume @30d vs direct counts.
    const vol = buildSessionVolume(sessions, T0, '30d');
    const inWindowCount = sessions.filter(
      (s) => s.completedAt <= T0 && s.completedAt >= T0 - 30 * DAY,
    ).length;
    expect(vol.windowSessions).toBe(inWindowCount);
    expect(vol.previousWindowSessions).toBe(
      sessions.filter((s) => s.completedAt < T0 - 30 * DAY && s.completedAt > T0 - 60 * DAY)
        .length,
    );

    // Calendar @90d vs map counts. The grid is keyed by UTC day (the oldest
    // cell is the whole day containing now−89d), so the reference must use
    // day-key membership, not a raw 90·DAY ms window.
    const cal = buildActivityCalendar(sessions, 90, T0);
    const gridKeys = new Set(cal.days.map((d) => d.dateKey));
    const dayCounts = new Map<string, number>();
    for (const s of sessions) {
      const k = new Date(s.completedAt).toISOString().slice(0, 10);
      if (gridKeys.has(k)) {
        dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
      }
    }
    const windowTotal = [...dayCounts.values()].reduce((a, b) => a + b, 0);
    expect(cal.totalSessions).toBe(windowTotal);
    expect(cal.activeDays).toBe(dayCounts.size);

    // Balance + weekly history vs counts.
    const resolve = (g: string) =>
      (({
        mem: 'Memory',
        att: 'Attention',
        spd: 'Speed',
        lang: 'Language',
        num: 'Memory',
        vis: 'Attention',
      }) as Record<string, string>)[g] ?? null;
    // Balance @30d vs its own ms-window count (the balance window is the
    // half-open-start [now−30d, now] range, not the calendar grid).
    const KNOWN = ['Memory', 'Attention', 'Speed', 'Language'] as const;
    const bal = buildTrainingBalance(sessions, resolve, KNOWN, T0, '30d');
    const balanceWindowCount = sessions.filter(
      (s) => s.completedAt <= T0 && s.completedAt >= T0 - 30 * DAY,
    ).length;
    expect(bal.mappedSessions + bal.unmappedSessions).toBe(balanceWindowCount);
    const slices = buildWeeklyBalance(sessions, resolve, KNOWN, T0, 8);
    const historyTotal = sessions.filter(
      (s) => s.completedAt <= T0 && s.completedAt > T0 - 8 * WEEK,
    ).length;
    expect(slices.reduce((a, s) => a + s.sessions, 0)).toBe(historyTotal);

    // PB chain: for 20k uniform draws the expected record count is
    // H_n = ln(20000) + γ ≈ 10.5, so a small chain is CORRECT — assert the
    // chain properties instead of a magic event count.
    const pb = buildNormalizedBestHistory(sessions, T0);
    expect(pb.events.length).toBeGreaterThanOrEqual(3);
    const globalBest = sessions.reduce((m, s) => Math.max(m, s.normalizedResult), -Infinity);
    expect(pb.current?.value).toBe(globalBest);
    for (let i = 1; i < pb.events.length; i += 1) {
      expect(pb.events[i].value).toBeGreaterThan(pb.events[i - 1].value);
    }
    expect(pb.standingDays).toBeGreaterThanOrEqual(0);
    const ordered = sessions
      .slice()
      .sort((a, b) => a.completedAt - b.completedAt)
      .map((s) => ({ t: s.completedAt, value: s.normalizedResult }));
    const trend = summarizePointTrend(ordered);
    if (trend.slopePerDay !== null) {
      expect(Math.abs(trend.slopePerDay)).toBeLessThan(1e9);
    }

    // Finiteness sweep over displayed aggregates.
    for (const g of bal.perDomain) {
      expect(Number.isFinite(g.share)).toBe(true);
    }
    for (const n of [...vol.weeklyCounts, ...cal.days.map((d) => d.count)]) {
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(trend.mean === null || Number.isFinite(trend.mean)).toBe(true);
    expect(Number.isFinite(balanceEffectiveDomains(bal))).toBe(true);

    // Informational duration log (never asserted — CI hosts vary).
    console.log(`[W09] 20k-session aggregate pass took ${Date.now() - started}ms`);
  });
});
