/**
 * Campaign 011 W09 — metric equivalence vs authoritative naive references
 * (part 1: trend-summary, volume-view, rolling-windows, personal-best,
 * difficulty-progression, metric-trends).
 *
 * Every Campaign 010 metric builder is compared against an independently
 * written, obviously-correct reference across fixture classes: empty · single
 * session · duplicate timestamps · same-day bursts · UTC-midnight edges ·
 * missing accuracy/reaction fields · forced outcomes · mixed game versions ·
 * mixed difficulty versions · imported historical data (including corrupt
 * future-dated rows). Part 2 lives in `analytics-v2-references.test.ts`.
 *
 * Boundary convention pinned here (campaign 011, decided once for the whole
 * analytics family): windows are measured in session age. Filters and
 * headline windows are `[start, now]` (shared `windows.ts` helpers); the
 * preceding equal-length window is the half-open age band `(w, 2w)` days —
 * the shared edge at exactly `now-w` belongs to the current window and the
 * outer edge at exactly `now-2w` belongs to older history; weekly tiles are
 * age bands `[7k, 7(k+1))`; future-dated rows count nowhere.
 */

import { describe, expect, it } from '@jest/globals';

import type { GameSessionRecord } from '@/db';

import {
  buildAccuracyTrend,
  buildDifficultyProgression,
  buildPersonalBestHistory,
  buildReactionTrend,
  buildRollingAverageSeries,
  buildScoreBestHistory,
  buildSessionVolume,
  compareRates,
  normalizedBestPoints,
  rollingAverages,
  scoreBestPoints,
  summarizePointTrend,
  summarizeTrend,
} from '@/analytics';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const T0 = Date.UTC(2026, 0, 20); // fixed clock: 2026-01-20T00:00:00Z

/** Deterministic RNG (mulberry32) so randomized fixtures replay exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seq = 0;
function mkSession(over: Partial<GameSessionRecord>): GameSessionRecord {
  seq += 1;
  return {
    id: `eq-s${seq}`,
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

/** Fixture class: a named scenario exercising one adversarial shape. */
interface FixtureClass {
  name: string;
  sessions: GameSessionRecord[];
}

/** Build every fixture class deterministically from `seed`. */
function buildFixtureClasses(seed: number): FixtureClass[] {
  const rng = mulberry32(seed);
  const rand = (lo = 0, hi = 1) => lo + rng() * (hi - lo);

  const single = [mkSession({ completedAt: T0 - 3 * DAY, normalizedResult: 0.42 })];

  const duplicateTimestamps = Array.from({ length: 12 }, (_, i) =>
    mkSession({ completedAt: T0 - DAY, normalizedResult: i / 12 }),
  );

  const sameDayBurst = Array.from({ length: 40 }, (_, i) =>
    mkSession({
      completedAt: Date.UTC(2026, 0, 19, 8) + Math.floor(rand(0, 12 * 3600_000)),
      normalizedResult: rand(),
      gameId: i % 2 === 0 ? 'g-a' : 'g-b',
    }),
  );

  // Instants hugging UTC midnights: 23:59:59.999 vs 00:00:00.001 must land in
  // adjacent UTC day buckets regardless of the device timezone.
  const utcMidnightEdges = [
    Date.UTC(2026, 0, 17, 23, 59, 59, 999),
    Date.UTC(2026, 0, 18, 0, 0, 0, 0),
    Date.UTC(2026, 0, 18, 0, 0, 0, 1),
    Date.UTC(2026, 0, 18, 23, 59, 59, 999),
    Date.UTC(2026, 0, 19, 0, 0, 1),
  ].map((t, i) => mkSession({ completedAt: t, normalizedResult: (i + 1) / 6 }));

  const missingMetrics = Array.from({ length: 24 }, (_, i) =>
    mkSession({
      completedAt: T0 - (i + 1) * 3600_000,
      normalizedResult: rand(),
      rawResult: i % 3 === 0 ? {} : { accuracy: rand(), avgResponseMs: 300 + i },
      difficulty: i % 4 === 0 ? undefined : { challengeRating: rand() },
    }),
  );

  const forcedOutcomes = Array.from({ length: 10 }, (_, i) =>
    mkSession({
      completedAt: T0 - i * DAY - 1000,
      normalizedResult: i % 2 === 0 ? 1 : 0, // force-win / force-loss extremes
      durationMs: 0,
    }),
  );

  const mixedVersions = Array.from({ length: 16 }, (_, i) =>
    mkSession({
      completedAt: T0 - i * DAY - 2000,
      gameVersion: 1000000 + i,
      generatorVersion: 2000000 + (i % 3),
      scoringVersion: 3000000 + (i % 2),
      normalizedResult: rand(),
    }),
  );

  // Imported history: years-old rows, unsorted, plus one corrupt future-dated
  // row (import artifact / clock skew) that no windowed view may count.
  const importedHistory = [
    Date.UTC(2019, 5, 10),
    Date.UTC(2020, 11, 31, 23, 59, 59),
    Date.UTC(2021, 0, 1),
    T0 - 300 * DAY,
    T0 - 45 * DAY,
    T0 - 2 * DAY,
    T0 + 5 * DAY, // corrupt: after "now"
  ].map((t, i) => mkSession({ completedAt: t, normalizedResult: (i % 5) / 5 }));

  return [
    { name: 'empty', sessions: [] },
    { name: 'single', sessions: single },
    { name: 'duplicate-timestamps', sessions: duplicateTimestamps },
    { name: 'same-day-burst', sessions: sameDayBurst },
    { name: 'utc-midnight-edges', sessions: utcMidnightEdges },
    { name: 'missing-metrics', sessions: missingMetrics },
    { name: 'forced-outcomes', sessions: forcedOutcomes },
    { name: 'mixed-versions', sessions: mixedVersions },
    { name: 'imported-history', sessions: importedHistory },
  ];
}

const FIXTURES = buildFixtureClasses(1109);

// ---------------------------------------------------------------------------
// Naive references (independent implementations, plain and slow on purpose).
// ---------------------------------------------------------------------------

function refMean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

function refSummary(values: number[]) {
  const n = values.length;
  const mean = refMean(values);
  let varianceSum = 0;
  for (const v of values) {
    varianceSum += (v - (mean ?? 0)) * (v - (mean ?? 0));
  }
  const stdDev = n >= 2 ? Math.sqrt(varianceSum / n) : null;
  let consistency: number | null = null;
  if (stdDev !== null) {
    if (stdDev === 0) {
      consistency = 1;
    } else if (mean !== 0 && mean !== null) {
      consistency = Math.max(0, Math.min(1, 1 - stdDev / Math.abs(mean)));
    }
  }
  return {
    count: n,
    first: n > 0 ? values[0] : null,
    last: n > 0 ? values[n - 1] : null,
    delta: n >= 2 ? values[n - 1] - values[0] : null,
    minimum: n > 0 ? values.reduce((m, v) => Math.min(m, v), Infinity) : null,
    maximum: n > 0 ? values.reduce((m, v) => Math.max(m, v), -Infinity) : null,
    mean,
    stdDev,
    consistency,
    direction:
      n < 2 || values[n - 1] === values[0]
        ? ('flat' as const)
        : values[n - 1] > values[0]
          ? ('up' as const)
          : ('down' as const),
  };
}

/** Closed-form least-squares slope with x in days since the first point. */
function refSlopePerDay(points: { t: number; value: number }[]): number | null {
  if (points.length < 2) {
    return null;
  }
  const t0 = points[0].t;
  const spanDays = (points[points.length - 1].t - t0) / DAY;
  if (spanDays <= 0) {
    return null;
  }
  const xs = points.map((p) => (p.t - t0) / DAY);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  return den > 0 ? num / den : null;
}

/** Volume reference phrased purely in session ages (decided convention). */
function refVolume(sessions: readonly GameSessionRecord[], nowMs: number, days: number) {
  const current = sessions.filter((s) => {
    const age = nowMs - s.completedAt;
    return age >= 0 && age <= days * DAY;
  });
  const previous = sessions.filter((s) => {
    const age = nowMs - s.completedAt;
    return age > days * DAY && age < 2 * days * DAY;
  });
  const buckets = new Map<number, number>();
  for (const s of current) {
    const b = Math.floor((nowMs - s.completedAt) / WEEK);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const weeklyCounts: number[] = [];
  for (let b = Math.ceil(days / 7) - 1; b >= 0; b -= 1) {
    weeklyCounts.push(buckets.get(b) ?? 0);
  }
  const activeDays = new Set(current.map((s) => s.completedAt)).size; // refined below
  return { currentCount: current.length, previousCount: previous.length, weeklyCounts, activeDays };
}

function refRolling(values: number[], n: number): (number | null)[] {
  return values.map((_, i) =>
    i >= n - 1 && n >= 1
      ? values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n
      : null,
  );
}

// ---------------------------------------------------------------------------
// trend-summary
// ---------------------------------------------------------------------------

describe('summarizeTrend equivalence vs naive reference (all fixture value series)', () => {
  for (const fx of FIXTURES) {
    it(`fixture: ${fx.name}`, () => {
      const values = fx.sessions.map((s) => s.normalizedResult);
      const got = summarizeTrend(values);
      const want = refSummary(values);
      expect(got.count).toBe(want.count);
      expect(got.first).toBe(want.first);
      expect(got.last).toBe(want.last);
      expect(got.delta).toBe(want.delta);
      if (want.minimum === null) {
        expect(got.minimum).toBeNull();
      } else {
        expect(got.minimum).toBeCloseTo(want.minimum, 12);
      }
      if (want.maximum === null) {
        expect(got.maximum).toBeNull();
      } else {
        expect(got.maximum).toBeCloseTo(want.maximum, 12);
      }
      if (want.mean === null) {
        expect(got.mean).toBeNull();
      } else {
        expect(got.mean).toBeCloseTo(want.mean, 12);
      }
      if (want.stdDev === null) {
        expect(got.stdDev).toBeNull();
      } else {
        expect(got.stdDev).toBeCloseTo(want.stdDev, 12);
      }
      if (want.consistency === null) {
        expect(got.consistency).toBeNull();
      } else {
        expect(got.consistency).toBeCloseTo(want.consistency, 12);
      }
      expect(got.direction).toBe(want.direction);
      expect(got.slopePerDay).toBeNull(); // value-only summary never invents a slope
    });
  }

  it('consistency corner cases: flat series is 1, zero-mean spread is null', () => {
    expect(summarizeTrend([3, 3, 3]).consistency).toBe(1);
    expect(summarizeTrend([-1, 1]).consistency).toBeNull();
    expect(summarizeTrend([5]).consistency).toBeNull();
  });

  it('slopePerDay matches the closed form and degrades to null on zero spans', () => {
    const pts = [
      { t: T0, value: 0.5 },
      { t: T0 + DAY, value: 0.7 },
      { t: T0 + 2 * DAY, value: 0.9 },
    ];
    expect(summarizePointTrend(pts).slopePerDay).toBeCloseTo(refSlopePerDay(pts)!, 12);
    // All points share one timestamp: no time axis, no slope.
    expect(
      summarizePointTrend([
        { t: T0, value: 0.5 },
        { t: T0, value: 0.9 },
      ]).slopePerDay,
    ).toBeNull();
    expect(summarizePointTrend([]).slopePerDay).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// volume-view: exact boundary pins + reference equivalence
// ---------------------------------------------------------------------------

describe('buildSessionVolume boundary convention (pinned at exact instants)', () => {
  const now = T0;
  function at(ms: number): GameSessionRecord[] {
    return [mkSession({ completedAt: ms })];
  }

  it('upper edge: t == now counts; anything after now is ignored', () => {
    expect(buildSessionVolume(at(now), now, '30d').windowSessions).toBe(1);
    expect(buildSessionVolume(at(now + 1), now, '30d').windowSessions).toBe(0);
    // Future-dated rows also stay out of the all-time branch.
    expect(buildSessionVolume(at(now + 1), now, 'all').windowSessions).toBe(0);
    expect(buildSessionVolume(at(now), now, 'all').windowSessions).toBe(1);
  });

  it('shared edge at exactly now-w belongs to the current window only', () => {
    const v = buildSessionVolume(at(now - 30 * DAY), now, '30d');
    expect(v.windowSessions).toBe(1);
    expect(v.previousWindowSessions).toBe(0);
  });

  it('previous window holds ages strictly inside (w, 2w) days', () => {
    const justInside = buildSessionVolume(at(now - 30 * DAY - 1), now, '30d');
    expect(justInside.windowSessions).toBe(0);
    expect(justInside.previousWindowSessions).toBe(1);

    const justOutside = buildSessionVolume(at(now - 60 * DAY + 1), now, '30d');
    expect(justOutside.previousWindowSessions).toBe(1);
  });

  it("outer edge at exactly now-2w belongs to older history (regression: campaign 010 counted it)", () => {
    const v = buildSessionVolume(at(now - 60 * DAY), now, '30d');
    expect(v.windowSessions).toBe(0);
    expect(v.previousWindowSessions).toBe(0); // was 2 pre-fix alongside the 40d row
  });

  it('weeklyCounts always sum to windowSessions across bounded windows', () => {
    for (const key of ['7d', '30d', '90d'] as const) {
      for (const fx of FIXTURES) {
        const v = buildSessionVolume(fx.sessions, T0, key);
        const sum = v.weeklyCounts.reduce((a, b) => a + b, 0);
        expect(sum).toBe(v.windowSessions);
      }
    }
  });
});

describe('buildSessionVolume equivalence vs age-based reference (fixtures × windows)', () => {
  for (const fx of FIXTURES) {
    for (const key of ['7d', '30d', '90d'] as const) {
      it(`fixture: ${fx.name} · ${key}`, () => {
        const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
        const got = buildSessionVolume(fx.sessions, T0, key);
        const want = refVolume(fx.sessions, T0, days);
        expect(got.windowSessions).toBe(want.currentCount);
        expect(got.previousWindowSessions).toBe(want.previousCount);
        expect(got.weeklyCounts).toEqual(want.weeklyCounts);
        expect(got.deltaSessions).toBe(want.currentCount - want.previousCount);
        // activeDays: distinct UTC date keys among in-window sessions.
        const keys = new Set(
          fx.sessions
            .filter((s) => s.completedAt <= T0 && s.completedAt >= T0 - days * DAY)
            .map((s) => new Date(s.completedAt).toISOString().slice(0, 10)),
        );
        expect(got.activeDays).toBe(keys.size);
        expect(got.perWeek).toBeCloseTo(want.currentCount / (days / 7), 12);
        expect(got.direction).toBe(
          want.currentCount === want.previousCount
            ? 'flat'
            : want.currentCount > want.previousCount
              ? 'up'
              : 'down',
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// rolling-windows
// ---------------------------------------------------------------------------

describe('rollingAverages equivalence vs brute-force slices', () => {
  it('matches the naive sliding mean for n = 1, 2, 5', () => {
    const values = FIXTURES[3].sessions.map((s) => s.normalizedResult); // burst series
    for (const n of [1, 2, 5]) {
      expect(rollingAverages(values, n)).toEqual(refRolling(values, n));
    }
  });

  it('n < 1 yields all nulls; empty and single inputs behave', () => {
    expect(rollingAverages([4, 7], 0)).toEqual([null, null]);
    expect(rollingAverages([], 3)).toEqual([]);
    expect(rollingAverages([5], 1)).toEqual([5]);
    expect(rollingAverages([5], 2)).toEqual([null]);
  });

  it('buildRollingAverageSeries keeps only full-window points with original timestamps', () => {
    const pts = [
      { t: T0, value: 1 },
      { t: T0 + 1, value: 2 },
      { t: T0 + 2, value: 3 },
    ];
    expect(buildRollingAverageSeries(pts, 2)).toEqual([
      { t: T0 + 1, value: 1.5 },
      { t: T0 + 2, value: 2.5 },
    ]);
    expect(buildRollingAverageSeries([], 2)).toEqual([]);
  });

  it('compareRates matches the naive rate computation (incl. one-week floor)', () => {
    const sessions = FIXTURES[8].sessions; // imported history incl. future row
    for (const key of ['7d', '30d', '90d', 'all'] as const) {
      const got = compareRates(sessions, T0, key);
      const stored = sessions.filter((s) => s.completedAt <= T0);
      const first = stored.reduce((m, s) => Math.min(m, s.completedAt), Infinity);
      const lifetimeWeeks = Math.max(1, (T0 - first) / WEEK);
      const lifetimePerWeek = stored.length / lifetimeWeeks;
      if (key === 'all') {
        expect(got.recentPerWeek).toBeNull();
        expect(got.lifetimePerWeek).toBeCloseTo(lifetimePerWeek, 12);
        expect(got.deltaPerWeek).toBeNull();
      } else {
        const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
        const recent = stored.filter((s) => s.completedAt >= T0 - days * DAY).length;
        const recentPerWeek = recent / (days / 7);
        expect(got.recentPerWeek).toBeCloseTo(recentPerWeek, 12);
        expect(got.lifetimePerWeek).toBeCloseTo(lifetimePerWeek, 12);
        expect(got.deltaPerWeek).toBeCloseTo(recentPerWeek - lifetimePerWeek, 12);
      }
    }
    expect(compareRates([], T0, '30d')).toEqual({
      recentPerWeek: null,
      lifetimePerWeek: null,
      deltaPerWeek: null,
    });
  });
});

// ---------------------------------------------------------------------------
// personal-best chains
// ---------------------------------------------------------------------------

describe('buildPersonalBestHistory equivalence vs strict-improvement scan', () => {
  function refChain(points: { t: number; value: number; sessionId?: string | null }[]) {
    const ordered = points.slice().sort((a, b) => a.t - b.t);
    // Same tie rule as production: one candidate per instant (its maximum),
    // first row winning exact duplicates, so the chain is order-invariant.
    const perInstant: typeof ordered = [];
    for (const p of ordered) {
      const prev = perInstant[perInstant.length - 1];
      if (prev && prev.t === p.t) {
        if (p.value > prev.value) {
          perInstant[perInstant.length - 1] = p;
        }
      } else {
        perInstant.push(p);
      }
    }
    const events: { t: number; value: number; sessionId: string | null }[] = [];
    let best = -Infinity;
    for (const p of perInstant) {
      if (p.value > best) {
        best = p.value;
        events.push({ t: p.t, value: p.value, sessionId: p.sessionId ?? null });
      }
    }
    return events;
  }

  it('chain equals the naive scan on every fixture (shuffled input order too)', () => {
    const rng = mulberry32(77);
    for (const fx of FIXTURES) {
      if (fx.sessions.length === 0) {
        continue;
      }
      const points = normalizedBestPoints(fx.sessions);
      const shuffled = points.slice();
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const want = refChain(points);
      const got = buildPersonalBestHistory(shuffled, T0);
      expect(got.events).toEqual(want);
      expect(got.timesBeaten).toBe(Math.max(0, want.length - 1));
      expect(got.current?.value).toBe(
        want.length > 0 ? want[want.length - 1].value : null,
      );
      expect(got.previous?.value ?? null).toBe(
        want.length > 1 ? want[want.length - 2].value : null,
      );
    }
  });

  it('ties keep the earliest holder; standingDays floors and clamps at zero', () => {
    const h = buildPersonalBestHistory(
      [
        { t: T0 - 2 * DAY, value: 0.5 },
        { t: T0 - DAY, value: 0.5 }, // tie: no event
        { t: T0 - 3600_000, value: 0.6 },
      ],
      T0,
    );
    expect(h.events.map((e) => e.t)).toEqual([T0 - 2 * DAY, T0 - 3600_000]);
    expect(h.standingDays).toBe(0); // 1 hour < 1 day

    const past = buildPersonalBestHistory([{ t: T0 - 2 * DAY, value: 0.5 }], T0);
    expect(past.standingDays).toBe(2);

    // Corrupt future-dated best: floor clamps the negative age at 0.
    const future = buildPersonalBestHistory([{ t: T0 + DAY, value: 0.9 }], T0);
    expect(future.standingDays).toBe(0);
  });

  it('negative first values still open the chain (best starts at -Infinity)', () => {
    const h = buildPersonalBestHistory(
      [
        { t: 1, value: -5 },
        { t: 2, value: -3 },
      ],
      T0,
    );
    expect(h.events.map((e) => e.value)).toEqual([-5, -3]);
  });

  it('score-based chains skip sessions without a persisted score', () => {
    const sessions = [
      mkSession({ id: 'no-score', rawResult: {} }),
      mkSession({ id: 'scored', rawResult: { score: 120 } }),
      mkSession({ id: 'string-score', rawResult: { score: 'NaN?' } }),
    ];
    expect(scoreBestPoints(sessions).map((p) => p.sessionId)).toEqual(['scored']);
    expect(buildScoreBestHistory(sessions, T0)?.events.map((e) => e.value)).toEqual([120]);
    expect(buildScoreBestHistory([mkSession({ rawResult: {} })], T0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// difficulty-progression (neutrality + extraction)
// ---------------------------------------------------------------------------

describe('buildDifficultyProgression equivalence vs naive extraction table', () => {
  /** Independent extraction table mirroring the SDK mapping. */
  function refExtract(difficulty: unknown): number | null {
    if (difficulty == null || typeof difficulty !== 'object') {
      return null;
    }
    const d = difficulty as Record<string, unknown>;
    if (typeof d.challengeRating === 'number' && Number.isFinite(d.challengeRating)) {
      return Math.min(1, Math.max(0, d.challengeRating));
    }
    const table: Record<string, number> = { easy: 0.2, normal: 0.5, hard: 0.8, expert: 0.95 };
    if (typeof d.level === 'string' && d.level in table) {
      return table[d.level];
    }
    return null;
  }

  function refProgression(sessions: GameSessionRecord[]) {
    const ordered = sessions.slice().sort((a, b) => a.completedAt - b.completedAt);
    const series = ordered
      .map((s) => ({ t: s.completedAt, value: refExtract(s.difficulty) }))
      .filter((p): p is { t: number; value: number } => p.value !== null);
    if (series.length === 0) {
      return { available: false, count: 0, series: [] };
    }
    const values = series.map((p) => p.value);
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return {
      available: true,
      count: values.length,
      series,
      first: values[0],
      latest: values[values.length - 1],
      peak: values.reduce((m, v) => Math.max(m, v), -Infinity),
      delta: values.length >= 2 ? values[values.length - 1] - values[0] : null,
      atOrAboveMedianShare: values.filter((v) => v >= median).length / values.length,
    };
  }

  it('matches the reference on every fixture class', () => {
    for (const fx of FIXTURES) {
      const got = buildDifficultyProgression(fx.sessions);
      const want = refProgression(fx.sessions);
      expect(got.available).toBe(want.available);
      expect(got.count).toBe(want.count);
      expect(got.series).toEqual(want.series);
      if (want.available) {
        expect(got.first).toBe(want.first);
        expect(got.latest).toBe(want.latest);
        expect(got.peak).toBeCloseTo(want.peak!, 12);
        expect(got.delta).toBe(want.delta);
        expect(got.atOrAboveMedianShare).toBeCloseTo(want.atOrAboveMedianShare!, 12);
        expect(got.atOrAboveMedianShare!).toBeGreaterThanOrEqual(0.5); // ≥ median share by construction
        // Neutrality: the view reports direction but never a success verdict.
        expect(Object.keys(got)).not.toContain('improved');
      }
    }
  });

  it('named levels map through the SDK table; adaptive level yields nothing without a rating', () => {
    const sessions = [
      mkSession({ difficulty: { level: 'easy' } }),
      mkSession({ difficulty: { level: 'normal' } }),
      mkSession({ difficulty: { level: 'hard' } }),
      mkSession({ difficulty: { level: 'expert' } }),
      mkSession({ difficulty: { level: 'adaptive' } }), // no DEFAULT_CHALLENGE_RATINGS entry
      mkSession({ difficulty: { challengeRating: 1.7 } }), // clamped
      mkSession({ difficulty: { challengeRating: -3 } }), // clamped
      mkSession({ difficulty: 'easy' }), // bare named string maps like the object form
    ];
    const got = buildDifficultyProgression(sessions);
    expect(got.series.map((p) => p.value)).toEqual([0.2, 0.5, 0.8, 0.95, 1, 0, 0.2]);
    expect(got.count).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// metric-trends availability gating
// ---------------------------------------------------------------------------

describe('metric-trends gating + series equivalence', () => {
  it('unavailable when no session carries the field (never fabricates)', () => {
    for (const sessions of [[], FIXTURES[0].sessions, [mkSession({ rawResult: {} })]]) {
      for (const trend of [buildAccuracyTrend(sessions), buildReactionTrend(sessions)]) {
        expect(trend).toEqual({
          available: false,
          count: 0,
          series: [],
          first: null,
          last: null,
          delta: null,
          mean: null,
          recentMean: null,
          direction: 'flat',
        });
      }
    }
  });

  it('accuracy series equals the naive chronological extraction; recentMean is last-5 mean', () => {
    const sessions = FIXTURES[5].sessions; // missing-metrics mix
    const want = sessions
      .slice()
      .sort((a, b) => a.completedAt - b.completedAt)
      .map((s) => ({
        t: s.completedAt,
        acc: (s.rawResult as Record<string, unknown> | null)?.['accuracy'] ?? null,
      }))
      .filter((p): p is { t: number; acc: number } => typeof p.acc === 'number');
    // Fixture accuracy values are already in [0,1]; production clamps anyway.
    const got = buildAccuracyTrend(sessions);
    expect(got.available).toBe(true);
    expect(got.count).toBe(want.length);
    expect(got.series).toEqual(want.map(({ t, acc }) => ({ t, value: acc })));
    const vals = want.map((p) => p.acc);
    expect(got.mean).toBeCloseTo(refMean(vals)!, 12);
    expect(got.recentMean).toBeCloseTo(refMean(vals.slice(-5))!, 12);
    expect(got.delta).toBe(vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null);
  });

  it('reaction priority prefers a mean field over a best field', () => {
    const sessions = [
      mkSession({ rawResult: { fastestReactionMs: 100, avgResponseMs: 400 } }),
      mkSession({ rawResult: { bestReactionMs: 150 } }),
      mkSession({ rawResult: { medianReactionMs: 250, fastestResponseMs: 90 } }),
    ];
    const got = buildReactionTrend(sessions);
    expect(got.series.map((p) => p.value)).toEqual([400, 150, 250]);
  });

  it('input order never changes the (t, value) multiset; duplicates preserved', () => {
    const sessions = FIXTURES[2].sessions.concat(FIXTURES[5].sessions);
    const keyed = (series: { t: number; value: number }[]) =>
      series.map((p) => `${p.t}:${p.value}`).sort().join('|');
    const a = buildAccuracyTrend(sessions);
    const b = buildAccuracyTrend(sessions.slice().reverse());
    expect(keyed(a.series)).toBe(keyed(b.series));
    expect(a.count).toBe(b.count);
    // Determinism: identical input, identical output.
    expect(buildAccuracyTrend(sessions)).toEqual(a);
  });
});
