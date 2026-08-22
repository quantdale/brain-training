/**
 * W08 adversarial validation for the Advanced Personalization V2 signal layer.
 *
 * Strategy: every signal function is mirrored by a NAIVE, independent
 * reference implementation written straight from the documented spec (see
 * `signals.ts` header comments and the published tuning constants). A seeded
 * mulberry32 sweep generates ~200 randomized evidence snapshots (with and
 * without an injected clock) and asserts production output equals the
 * references everywhere. Dedicated edge fixtures then pin the documented
 * corner cases: empty history, a single session, identical ratings,
 * missing/corrupt metric fields (sanitize-path), future timestamps, the
 * stale-window boundary, and a rating sitting exactly at INITIAL_RATING.
 *
 * These tests intentionally re-derive the math instead of calling the
 * production helpers, so a regression in `signals.ts` cannot silently
 * redefine its own oracle.
 */

import { describe, expect, it } from '@jest/globals';
import type { GameDefinition } from '@/sdk';

import { buildPersonalizationContext } from '../context';
import {
  DAY_MS,
  FATIGUE_FREE_SESSIONS,
  FATIGUE_RECENT_SESSIONS,
  FIT_BAND,
  FORM_SESSIONS,
  MIN_TREND_SESSIONS,
  NOVELTY_MAX_SESSIONS,
  PB_PROXIMITY_GAP,
  STALE_DOMAIN_DAYS,
  TREND_SATURATION,
  UNDERTRAINED_MIN_SESSIONS,
  WEAK_DOMAIN_RATING_THRESHOLD,
  WEAKNESS_FULL_AT_DROP,
  computeDomainSignals,
  computeGameEvidence,
  difficultyFitValue,
  fatigueValue,
  isDomainStale,
  daysSinceUpdate,
  noveltyValue,
  personalBestProximityValue,
  trendValue,
  undertrainingValue,
  type DomainSignalSummary,
  type GameEvidence,
} from '../signals';
import type {
  DomainRatingView,
  GameAggregateView,
  PersonalizationContext,
  RecentSessionView,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32); the whole sweep hangs off one seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: GameDefinition['primaryCategory'][] = [
  'Memory',
  'Attention',
  'Speed',
  'Math',
  'Language',
  'Logic & Problem Solving',
  'Flexibility',
  'Spatial',
];

function makeGame(
  id: string,
  primaryCategory: GameDefinition['primaryCategory'],
): GameDefinition {
  return {
    id,
    name: id,
    primaryCategory,
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: null,
    contentVersion: null,
    hasTutorial: false,
  };
}

const NOW_MS = 1_700_000_000_000;

function expectClose(actual: number, expected: number): void {
  expect(actual).toBeCloseTo(expected, 12);
}

// ---------------------------------------------------------------------------
// Naive reference implementations (spec-derived, independent of signals.ts)
// ---------------------------------------------------------------------------

interface RefDomainSummary {
  rating: number;
  sessions: number;
  weak: boolean;
  weakness: number;
  stale: boolean;
  staleness: number;
  daysSinceUpdate: number | null;
}

/** Reference staleness: strict `>` horizon, opt-in clock, numeric timestamp. */
function refIsStale(
  updatedAt: number | undefined,
  nowMs: number | undefined,
  staleDays: number,
): boolean {
  if (nowMs === undefined || updatedAt === undefined) {
    return false;
  }
  return nowMs - updatedAt > staleDays * DAY_MS;
}

/** Whole floored days since update; null when clock or timestamp is missing. */
function refDaysSince(
  updatedAt: number | undefined,
  nowMs: number | undefined,
): number | null {
  if (nowMs === undefined || updatedAt === undefined) {
    return null;
  }
  return Math.floor((nowMs - updatedAt) / DAY_MS);
}

function clampTo01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/** Last row per domain wins; missing optional fields default (sessions 0). */
function refDomainSignals(
  ratings: readonly DomainRatingView[],
  nowMs: number | undefined,
  staleDays: number,
): Map<string, RefDomainSummary> {
  const out = new Map<string, RefDomainSummary>();
  for (const row of ratings) {
    const weak = row.rating < 1000; // INITIAL_RATING threshold, strict <
    const weakness = weak
      ? clampTo01((1000 - row.rating) / 200) // WEAKNESS_FULL_AT_DROP = 200
      : 0;
    const stale = refIsStale(row.updatedAt, nowMs, staleDays);
    const age = refDaysSince(row.updatedAt, nowMs);
    const staleness =
      stale && age !== null ? clampTo01((age - staleDays) / staleDays) : 0;
    out.set(row.domain, {
      rating: row.rating,
      sessions: row.sessions ?? 0,
      weak,
      weakness,
      stale,
      staleness,
      daysSinceUpdate: age,
    });
  }
  return out;
}

/** Unseen domain ⇒ maximally undertrained; linear decay to 0 at 3 sessions. */
function refUndertraining(summary: RefDomainSummary | undefined): number {
  const sessions = summary ? summary.sessions : 0;
  return clampTo01(1 - sessions / 3); // UNDERTRAINED_MIN_SESSIONS = 3
}

interface RawEvidenceInput {
  gameId: string;
  aggregates: readonly GameAggregateView[];
  recentSessions: readonly RecentSessionView[];
}

/** First 5 newest sessions of the game form the sample; window = first 10. */
function refEvidence(input: RawEvidenceInput): GameEvidence {
  const form = input.recentSessions
    .filter((s) => s.gameId === input.gameId)
    .slice(0, 5); // FORM_SESSIONS = 5
  const window = input.recentSessions.slice(0, 10); // FATIGUE_RECENT_SESSIONS
  let recentPlays = 0;
  for (const s of window) {
    if (s.gameId === input.gameId) {
      recentPlays += 1;
    }
  }
  const aggregate = input.aggregates.find((a) => a.gameId === input.gameId);
  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    gameId: input.gameId,
    lifetimeSessions: aggregate ? aggregate.count : form.length,
    recentPlays,
    formSessions: form.length,
    recentFormNormalized: mean(form.map((s) => s.normalizedResult)),
    recentBestNormalized:
      form.length === 0
        ? null
        : form.reduce((m, s) => Math.max(m, s.normalizedResult), -Infinity),
    lifetimeAvgNormalized: aggregate ? aggregate.avgNormalized : null,
    bestNormalized: aggregate ? aggregate.bestNormalized : null,
  };
}

function refNovelty(ev: GameEvidence): number {
  return clampTo01(1 - ev.lifetimeSessions / 3); // NOVELTY_MAX_SESSIONS = 3
}

function refFatigue(ev: GameEvidence): number {
  if (ev.recentPlays <= 2) {
    return 0; // FATIGUE_FREE_SESSIONS = 2
  }
  return clampTo01((ev.recentPlays - 2) / 8); // span 10 - 2
}

function refTrend(ev: GameEvidence): number {
  if (
    ev.recentFormNormalized === null ||
    ev.lifetimeAvgNormalized === null ||
    ev.formSessions < 3 ||
    ev.lifetimeSessions < 3
  ) {
    return 0;
  }
  return clampTo01(
    (ev.recentFormNormalized - ev.lifetimeAvgNormalized) / 0.2,
  ); // TREND_SATURATION = 0.2
}

function refPbProximity(ev: GameEvidence): number {
  if (
    ev.recentBestNormalized === null ||
    ev.bestNormalized === null ||
    ev.formSessions === 0
  ) {
    return 0;
  }
  const gap = ev.bestNormalized - ev.recentBestNormalized;
  if (gap < 0 || gap > 0.15) {
    return 0; // PB_PROXIMITY_GAP = 0.15; beaten-best is not proximity
  }
  return clampTo01(1 - gap / 0.15);
}

function refDifficultyFit(ev: GameEvidence): number {
  const x = ev.recentFormNormalized;
  if (x === null || ev.formSessions === 0) {
    return 0;
  }
  // Trapezoid: dead below 0.3 / above 0.9 (bounds excluded), ramps between.
  if (x <= 0.3 || x >= 0.9) {
    return 0;
  }
  if (x < 0.45) {
    return (x - 0.3) / 0.15;
  }
  if (x <= 0.75) {
    return 1;
  }
  return (0.9 - x) / 0.15;
}

// ---------------------------------------------------------------------------
// Randomized fixture sweep
// ---------------------------------------------------------------------------

interface Scenario {
  label: string;
  useClock: boolean;
  staleDays: number;
  ratings: DomainRatingView[];
  aggregates: GameAggregateView[];
  recentSessions: RecentSessionView[];
  games: GameDefinition[];
}

const SWEEP_SEED = 20260821;
const SCENARIO_COUNT = 200;

function buildScenarios(): Scenario[] {
  const rand = mulberry32(SWEEP_SEED);
  const scenarios: Scenario[] = [];
  const pick = <T>(xs: readonly T[]): T =>
    xs[Math.floor(rand() * xs.length)] as T;

  for (let i = 0; i < SCENARIO_COUNT; i += 1) {
    const useClock = rand() < 0.6;
    const staleDays = rand() < 0.8 ? 30 : 7;

    // Ratings: 0..9 rows over the 8 canonical domains, occasional duplicates
    // (last-wins) and optional-field omissions.
    const ratings: DomainRatingView[] = [];
    const ratingCount = Math.floor(rand() * 10);
    for (let r = 0; r < ratingCount; r += 1) {
      const row: DomainRatingView = {
        domain: pick(CATEGORIES),
        rating: Math.round(600 + rand() * 900), // straddles 1000 generously
      };
      if (rand() < 0.85) {
        row.sessions = Math.floor(rand() * 18);
      }
      if (rand() < 0.85) {
        // Mostly past timestamps; ~10% land in the future on purpose.
        const past = rand() < 0.9;
        const offsetDays = rand() * (past ? 70 : -12);
        row.updatedAt = NOW_MS - Math.floor(offsetDays * DAY_MS);
      }
      ratings.push(row);
    }

    // Games: up to 6, categories drawn at random (imbalance is fine).
    const gameCount = Math.floor(rand() * 7);
    const games: GameDefinition[] = [];
    for (let g = 0; g < gameCount; g += 1) {
      games.push(makeGame(`g${g}`, pick(CATEGORIES)));
    }

    // Aggregates: sparse, sometimes inconsistent (best < avg is tolerated by
    // the spec — the signals never assume consistency between the two).
    const aggregates: GameAggregateView[] = [];
    for (const game of games) {
      if (rand() < 0.55) {
        aggregates.push({
          gameId: game.id,
          count: Math.floor(rand() * 26),
          avgNormalized: Math.round(rand() * 100) / 100,
          bestNormalized: Math.round(rand() * 100) / 100,
          lastCompletedAt: NOW_MS - Math.floor(rand() * 40 * DAY_MS),
        });
      }
    }

    // Recent sessions: 0..40, newest-first timestamps (occasional exact
    // duplicates — the db allows same-ms completions), uniform game spread
    // plus bursts so fatigue actually fires.
    const sessionCount = Math.floor(rand() * 41);
    const recentSessions: RecentSessionView[] = [];
    const burstGame = games.length > 0 ? pick(games).id : 'g0';
    for (let s = 0; s < sessionCount; s += 1) {
      const gameId =
        games.length === 0
          ? 'g0'
          : rand() < 0.35
            ? burstGame
            : pick(games).id;
      recentSessions.push({
        gameId,
        normalizedResult: Math.round(rand() * 100) / 100,
        completedAt:
          NOW_MS -
          s * (3600_000 + Math.floor(rand() * 3_600_000)) -
          Math.floor(rand() * 60_000),
      });
    }

    scenarios.push({
      label: `sweep#${i} (clock=${useClock}, staleDays=${staleDays}, ratings=${ratings.length}, games=${games.length}, sessions=${sessionCount})`,
      useClock,
      staleDays,
      ratings,
      aggregates,
      recentSessions,
      games,
    });
  }
  return scenarios;
}

const SCENARIOS = buildScenarios();

describe('signal sweep vs naive references (mulberry32, seeded)', () => {
  for (const scenario of SCENARIOS) {
    it(scenario.label, () => {
      const context: PersonalizationContext = buildPersonalizationContext({
        ratings: scenario.ratings,
        aggregates: scenario.aggregates,
        recentSessions: scenario.recentSessions,
        ...(scenario.useClock ? { nowMs: NOW_MS } : {}),
        staleDays: scenario.staleDays,
      });

      // --- domain-level signals -------------------------------------------
      const real = computeDomainSignals(scenario.ratings, {
        nowMs: scenario.useClock ? NOW_MS : undefined,
        staleDays: scenario.staleDays,
      });
      const expected = refDomainSignals(
        scenario.ratings,
        scenario.useClock ? NOW_MS : undefined,
        scenario.staleDays,
      );
      expect(real.size).toBe(expected.size);
      for (const [domain, exp] of expected) {
        const got: DomainSignalSummary | undefined = real.get(domain);
        expect(got).toBeDefined();
        if (!got) {
          continue;
        }
        expect(got.domain).toBe(domain);
        expect(got.seen).toBe(true);
        expect(got.rating).toBe(exp.rating);
        expect(got.sessions).toBe(exp.sessions);
        expect(got.weak).toBe(exp.weak);
        expectClose(got.weakness, exp.weakness);
        expect(got.stale).toBe(exp.stale);
        expectClose(got.staleness, exp.staleness);
        expect(got.daysSinceUpdate).toBe(exp.daysSinceUpdate);

        // Undertraining, seen-domain branch.
        expectClose(undertrainingValue(got), refUndertraining(exp));
      }

      // Undertraining, UNSEEN-domain branch (domains without a rating row):
      // every canonical category missing from the rating rows must read 1.0.
      for (const category of CATEGORIES) {
        if (!expected.has(category)) {
          expectClose(undertrainingValue(real.get(category)), 1);
          expectClose(undertrainingValue(undefined), 1);
        }
      }

      // --- game-level evidence + per-game signals --------------------------
      for (const game of scenario.games) {
        const evidence = computeGameEvidence(game.id, context);
        const ref = refEvidence({
          gameId: game.id,
          aggregates: scenario.aggregates,
          recentSessions: scenario.recentSessions,
        });
        expect(evidence.lifetimeSessions).toBe(ref.lifetimeSessions);
        expect(evidence.recentPlays).toBe(ref.recentPlays);
        expect(evidence.formSessions).toBe(ref.formSessions);
        if (ref.recentFormNormalized === null) {
          expect(evidence.recentFormNormalized).toBeNull();
        } else {
          expectClose(evidence.recentFormNormalized ?? -1, ref.recentFormNormalized);
        }
        if (ref.recentBestNormalized === null) {
          expect(evidence.recentBestNormalized).toBeNull();
        } else {
          expectClose(evidence.recentBestNormalized ?? -1, ref.recentBestNormalized);
        }
        if (ref.lifetimeAvgNormalized === null) {
          expect(evidence.lifetimeAvgNormalized).toBeNull();
        } else {
          expectClose(evidence.lifetimeAvgNormalized ?? -1, ref.lifetimeAvgNormalized);
        }
        if (ref.bestNormalized === null) {
          expect(evidence.bestNormalized).toBeNull();
        } else {
          expectClose(evidence.bestNormalized ?? -1, ref.bestNormalized);
        }

        expectClose(noveltyValue(evidence), refNovelty(ref));
        expectClose(fatigueValue(evidence), refFatigue(ref));
        expectClose(trendValue(evidence), refTrend(ref));
        expectClose(personalBestProximityValue(evidence), refPbProximity(ref));
        expectClose(difficultyFitValue(evidence), refDifficultyFit(ref));

        // Every returned strength stays inside the documented [0, 1] band.
        for (const value of [
          noveltyValue(evidence),
          fatigueValue(evidence),
          trendValue(evidence),
          personalBestProximityValue(evidence),
          difficultyFitValue(evidence),
        ]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Edge fixtures
// ---------------------------------------------------------------------------

describe('edge: empty history', () => {
  const context = buildPersonalizationContext({});
  const evidence = computeGameEvidence('g-any', context);

  it('yields zero evidence and prior-free boosts only', () => {
    expect(evidence.lifetimeSessions).toBe(0);
    expect(evidence.recentPlays).toBe(0);
    expect(evidence.formSessions).toBe(0);
    expect(evidence.recentFormNormalized).toBeNull();
    expect(evidence.recentBestNormalized).toBeNull();
    expect(evidence.lifetimeAvgNormalized).toBeNull();
    expect(evidence.bestNormalized).toBeNull();

    expect(noveltyValue(evidence)).toBe(1); // never played ⇒ full discovery
    expect(fatigueValue(evidence)).toBe(0);
    expect(trendValue(evidence)).toBe(0);
    expect(personalBestProximityValue(evidence)).toBe(0);
    expect(difficultyFitValue(evidence)).toBe(0);
    expect(computeDomainSignals([])).toEqual(new Map());
    expect(computeDomainSignals([], {}).size).toBe(0);
  });

  it('is never stale without an injected clock', () => {
    expect(isDomainStale(NOW_MS - 400 * DAY_MS, undefined)).toBe(false);
    expect(daysSinceUpdate(NOW_MS - 400 * DAY_MS, undefined)).toBeNull();
  });
});

describe('edge: exactly one session', () => {
  const context = buildPersonalizationContext({
    recentSessions: [
      { gameId: 'g-one', normalizedResult: 0.6, completedAt: NOW_MS },
    ],
    nowMs: NOW_MS,
  });
  const evidence = computeGameEvidence('g-one', context);

  it('forms a 1-sample form but fires no multi-session signals', () => {
    expect(evidence.formSessions).toBe(1);
    expect(evidence.lifetimeSessions).toBe(1); // session-list fallback
    expect(evidence.recentFormNormalized).toBe(0.6);
    expect(evidence.recentBestNormalized).toBe(0.6);

    expect(noveltyValue(evidence)).toBeCloseTo(1 - 1 / NOVELTY_MAX_SESSIONS, 12);
    expect(fatigueValue(evidence)).toBe(0); // 1 play ≤ free allowance
    expect(trendValue(evidence)).toBe(0); // needs MIN_TREND_SESSIONS on both sides
    expect(personalBestProximityValue(evidence)).toBe(0); // no aggregate best
    expect(difficultyFitValue(evidence)).toBeCloseTo(
      refDifficultyFit(evidence),
      12,
    );
    expect(difficultyFitValue(evidence)).toBeGreaterThan(0); // 0.6 sits in-band
  });

  it('leaves other games untouched', () => {
    const ghost = computeGameEvidence('g-ghost', context);
    expect(ghost.formSessions).toBe(0);
    expect(ghost.recentPlays).toBe(0);
  });
});

describe('edge: identical ratings everywhere', () => {
  const ratings = CATEGORIES.map((domain) => ({
    domain,
    rating: 1250,
    sessions: 5,
    updatedAt: NOW_MS,
  }));

  it('treats all domains symmetrically below the weak threshold rules', () => {
    const signals = computeDomainSignals(ratings, { nowMs: NOW_MS });
    for (const category of CATEGORIES) {
      const summary = signals.get(category);
      expect(summary?.weak).toBe(false);
      expect(summary?.weakness).toBe(0);
      expect(summary?.stale).toBe(false);
      expect(summary?.staleness).toBe(0);
    }
  });

  it('marks every domain equally weak when the shared rating declines', () => {
    const declined = ratings.map((row) => ({ ...row, rating: 907 }));
    const signals = computeDomainSignals(declined, { nowMs: NOW_MS });
    for (const category of CATEGORIES) {
      const summary = signals.get(category);
      expect(summary?.weak).toBe(true);
      expect(summary?.weakness).toBeCloseTo((1000 - 907) / WEAKNESS_FULL_AT_DROP, 12);
    }
  });

  it('keeps all domains fresh when every updatedAt is identical and recent', () => {
    const signals = computeDomainSignals(ratings, { nowMs: NOW_MS + DAY_MS });
    for (const summary of signals.values()) {
      expect(summary.daysSinceUpdate).toBe(1);
      expect(summary.stale).toBe(false);
    }
  });
});

describe('edge: missing/corrupt metric fields (sanitize path)', () => {
  it('drops malformed rating rows and keeps well-formed ones', () => {
    const garbage = [
      { domain: '', rating: 900 }, // empty domain
      { domain: 'Memory', rating: Number.NaN }, // corrupt rating
      { domain: 'Attention', rating: undefined }, // missing rating
      null, // not a row at all
      { domain: 'Speed', rating: 1100, sessions: 2, updatedAt: NOW_MS },
    ] as unknown as DomainRatingView[];
    const context = buildPersonalizationContext({ ratings: garbage, nowMs: NOW_MS });
    expect([...context.ratingByDomain.keys()]).toEqual(['Speed']);

    // The unsanitized kernel tolerates the same garbage without throwing;
    // NaN simply never compares as weak/stale (documented fallback).
    expect(() => computeDomainSignals(garbage, { nowMs: NOW_MS })).not.toThrow();
  });

  it('drops malformed aggregate rows wholesale (no partial salvage)', () => {
    const garbageAggregates = [
      {
        gameId: 'g-bad',
        count: 9,
        avgNormalized: Number.NaN, // any corrupt field kills the row
        bestNormalized: 0.5,
        lastCompletedAt: NOW_MS,
      },
      {
        gameId: 'g-good',
        count: 4,
        avgNormalized: 0.4,
        bestNormalized: 0.6,
        lastCompletedAt: NOW_MS,
      },
    ] as unknown as GameAggregateView[];
    const context = buildPersonalizationContext({
      aggregates: garbageAggregates,
      recentSessions: [
        { gameId: 'g-bad', normalizedResult: 0.7, completedAt: NOW_MS },
      ],
      nowMs: NOW_MS,
    });

    const bad = computeGameEvidence('g-bad', context);
    expect(bad.lifetimeAvgNormalized).toBeNull(); // aggregate gone…
    expect(bad.bestNormalized).toBeNull();
    expect(bad.lifetimeSessions).toBe(1); // …session-list fallback takes over
    expect(noveltyValue(bad)).toBeCloseTo(1 - 1 / NOVELTY_MAX_SESSIONS, 12);

    const good = computeGameEvidence('g-good', context);
    expect(good.lifetimeAvgNormalized).toBe(0.4);
  });

  it('skips malformed sessions and clamps surviving results into [0, 1]', () => {
    const sessions = [
      { gameId: 42, normalizedResult: 0.5, completedAt: NOW_MS }, // non-string id
      { gameId: 'g-x', normalizedResult: 'high', completedAt: NOW_MS }, // corrupt result
      { gameId: 'g-x', normalizedResult: 0.5, completedAt: Number.NaN }, // corrupt clock
      { gameId: 'g-x', normalizedResult: -0.5, completedAt: NOW_MS }, // clamped low
      { gameId: 'g-x', normalizedResult: 1.7, completedAt: NOW_MS }, // clamped high
    ] as unknown as RecentSessionView[];
    const context = buildPersonalizationContext({ recentSessions: sessions });
    expect(context.recentSessions.map((s) => s.normalizedResult)).toEqual([0, 1]);

    const evidence = computeGameEvidence('g-x', context);
    expect(evidence.formSessions).toBe(2);
    expect(evidence.recentFormNormalized).toBe(0.5);
    expect(evidence.recentBestNormalized).toBe(1);
  });

  it('never throws when the whole pipeline meets garbage', () => {
    const garbageRatings = [{ domain: 7, rating: {} }] as unknown as DomainRatingView[];
    const garbageAggregates = ['nope'] as unknown as GameAggregateView[];
    const garbageSessions = [17, null] as unknown as RecentSessionView[];
    expect(() => {
      const context = buildPersonalizationContext({
        ratings: garbageRatings,
        aggregates: garbageAggregates,
        recentSessions: garbageSessions,
        nowMs: NOW_MS,
      });
      const scored = computeGameEvidence('g-any', context);
      expect(Number.isFinite(noveltyValue(scored))).toBe(true);
      expect(Number.isFinite(difficultyFitValue(scored))).toBe(true);
      expect(computeDomainSignals(garbageRatings, { nowMs: NOW_MS })).toBeDefined();
    }).not.toThrow();
  });
});

describe('edge: future timestamps', () => {
  const futureUpdatedAt = NOW_MS + 5 * DAY_MS;

  it('never marks a future-updated rating stale (strict > comparison)', () => {
    expect(isDomainStale(futureUpdatedAt, NOW_MS)).toBe(false);
    const summary = computeDomainSignals(
      [{ domain: 'Memory', rating: 1200, updatedAt: futureUpdatedAt }],
      { nowMs: NOW_MS },
    ).get('Memory');
    expect(summary?.stale).toBe(false);
    expect(summary?.staleness).toBe(0);
    expect(summary?.daysSinceUpdate).toBe(-5); // honest negative age, unused
  });

  it('keeps future-completed sessions and computes signals normally', () => {
    const context = buildPersonalizationContext({
      recentSessions: [
        { gameId: 'g-future', normalizedResult: 0.66, completedAt: NOW_MS + DAY_MS },
        { gameId: 'g-future', normalizedResult: 0.5, completedAt: NOW_MS },
      ],
      nowMs: NOW_MS,
    });
    const evidence = computeGameEvidence('g-future', context);
    expect(evidence.formSessions).toBe(2);
    expect(evidence.recentFormNormalized).toBeCloseTo(0.58, 12);
    expect(difficultyFitValue(evidence)).toBeCloseTo(
      refDifficultyFit(evidence),
      12,
    );
  });
});

describe('edge: rating exactly at INITIAL_RATING (1000)', () => {
  it('is NOT weak — only actively declined ratings are favored', () => {
    // Pins the kernel constant to the documented INITIAL_RATING in
    // src/db/rating.ts (the cross-module lock itself lives in the legacy
    // personalize suite).
    expect(WEAK_DOMAIN_RATING_THRESHOLD).toBe(1000);
    const summary = computeDomainSignals([
      { domain: 'Math', rating: WEAK_DOMAIN_RATING_THRESHOLD, sessions: 3 },
    ]).get('Math');
    expect(summary?.weak).toBe(false);
    expect(summary?.weakness).toBe(0);
  });

  it('flips weak one tick below the threshold', () => {
    const summary = computeDomainSignals([
      { domain: 'Math', rating: WEAK_DOMAIN_RATING_THRESHOLD - 1, sessions: 3 },
    ]).get('Math');
    expect(summary?.weak).toBe(true);
    expect(summary?.weakness).toBeCloseTo(1 / WEAKNESS_FULL_AT_DROP, 12);
  });
});

describe('edge: stale-window boundary (mirrors db isRatingStale)', () => {
  it('exact horizon is fresh, one ms past is stale', () => {
    const exactly = NOW_MS - STALE_DOMAIN_DAYS * DAY_MS;
    const oneMsPast = exactly - 1;
    expect(isDomainStale(exactly, NOW_MS)).toBe(false);
    expect(isDomainStale(oneMsPast, NOW_MS)).toBe(true);

    const summaries = computeDomainSignals(
      [
        { domain: 'Memory', rating: 1200, updatedAt: exactly },
        { domain: 'Speed', rating: 1200, updatedAt: oneMsPast },
      ],
      { nowMs: NOW_MS },
    );
    expect(summaries.get('Memory')?.stale).toBe(false);
    expect(summaries.get('Speed')?.stale).toBe(true);
    // age floors to 30 whole days ⇒ strength starts at exactly 0…
    expect(summaries.get('Speed')?.staleness).toBe(0);
    // …and a zero-strength stale never becomes a scored component elsewhere
    // (scoring drops value<=0 pushes); here we pin the kernel value itself.
  });

  it('saturates strength linearly and honors a custom horizon', () => {
    const fortyFive = NOW_MS - 45 * DAY_MS;
    const summary = computeDomainSignals(
      [{ domain: 'Memory', rating: 1200, updatedAt: fortyFive }],
      { nowMs: NOW_MS },
    ).get('Memory');
    expect(summary?.staleness).toBeCloseTo((45 - 30) / 30, 12);

    const custom = computeDomainSignals(
      [{ domain: 'Speed', rating: 1200, updatedAt: NOW_MS - 14 * DAY_MS }],
      { nowMs: NOW_MS, staleDays: 7 },
    ).get('Speed');
    expect(custom?.stale).toBe(true);
    expect(custom?.staleness).toBe(1); // (14 - 7) / 7 saturates

    expect(() => isDomainStale(NOW_MS, NOW_MS, 0)).toThrow(RangeError);
  });
});

describe('edge: difficulty-fit band boundaries', () => {
  const evidenceWith = (mean: number): GameEvidence => ({
    gameId: 'g-fit',
    lifetimeSessions: 5,
    recentPlays: 0,
    formSessions: 5,
    recentFormNormalized: mean,
    recentBestNormalized: mean,
    lifetimeAvgNormalized: mean,
    bestNormalized: mean,
  });

  it('is zero outside the band (bounds excluded) and tops the plateau', () => {
    expect(difficultyFitValue(evidenceWith(FIT_BAND.tooHard))).toBe(0);
    expect(difficultyFitValue(evidenceWith(FIT_BAND.tooEasy))).toBe(0);
    expect(difficultyFitValue(evidenceWith(FIT_BAND.goodLow))).toBe(1);
    expect(difficultyFitValue(evidenceWith(FIT_BAND.goodHigh))).toBe(1);
    expect(difficultyFitValue(evidenceWith(0))).toBe(0);
    expect(difficultyFitValue(evidenceWith(1))).toBe(0);
  });

  it('matches the reference trapezoid across a dense scan of the band', () => {
    for (let i = 0; i <= 120; i += 1) {
      const x = i / 120;
      expectClose(difficultyFitValue(evidenceWith(x)), refDifficultyFit(evidenceWith(x)));
    }
  });
});

describe('edge: category imbalance and board-wide novelty exhaustion', () => {
  it('fires domain signals only for the concentrated domain', () => {
    const others = CATEGORIES.slice(1);
    const ratings = [
      { domain: CATEGORIES[0], rating: 800, sessions: 9, updatedAt: NOW_MS },
      ...others.map((domain) => ({ domain, rating: 1300 })),
    ];
    const signals = computeDomainSignals(ratings, { nowMs: NOW_MS });
    expect(signals.get(CATEGORIES[0])?.weak).toBe(true);
    expect(signals.get(CATEGORIES[0])?.sessions).toBe(9);
    for (const domain of others) {
      const summary = signals.get(domain);
      expect(summary?.weak).toBe(false);
      expect(summary?.sessions).toBe(0); // row exists but claims no sessions
      expect(undertrainingValue(summary)).toBe(1); // ⇒ fully undertrained
    }
  });

  it('drains novelty to zero for every game once all were played often', () => {
    const games = CATEGORIES.map((category, i) => makeGame(`veteran-${i}`, category));
    const context = buildPersonalizationContext({
      aggregates: games.map((game) => ({
        gameId: game.id,
        count: NOVELTY_MAX_SESSIONS + 4,
        avgNormalized: 0.5,
        bestNormalized: 0.7,
        lastCompletedAt: NOW_MS,
      })),
      recentSessions: games.flatMap((game) => [
        { gameId: game.id, normalizedResult: 0.5, completedAt: NOW_MS },
        { gameId: game.id, normalizedResult: 0.52, completedAt: NOW_MS - DAY_MS },
        { gameId: game.id, normalizedResult: 0.48, completedAt: NOW_MS - 2 * DAY_MS },
      ]),
      nowMs: NOW_MS,
    });
    // Fatigue counts plays inside the FIRST FATIGUE_RECENT_SESSIONS sessions
    // (newest-first). With 8 games x 3 plays only the earliest-listed games
    // fit the window, so the per-game expectation is derived from the same
    // documented windowing rather than assumed uniform.
    const windowSessions = (
      context.recentSessions as readonly { gameId: string }[]
    ).slice(0, FATIGUE_RECENT_SESSIONS);
    for (const game of games) {
      const evidence = computeGameEvidence(game.id, context);
      expect(noveltyValue(evidence)).toBe(0);
      const playsInWindow = windowSessions.filter(
        (session) => session.gameId === game.id,
      ).length;
      expect(fatigueValue(evidence)).toBe(
        refFatigue({ recentPlays: playsInWindow } as GameEvidence),
      );
    }
  });
});
