/**
 * Property/invariant tests for the rating engine (campaign 009 W07).
 *
 * Pins the promises the rest of the product relies on:
 *  - monotonicity: deltas rise with performance and with difficulty; the
 *    challenge-expectation curve falls monotonically;
 *  - boundedness: per-session movement is capped, XP/currency stay in band;
 *  - clamping at extremes: NaN/±Infinity on any arithmetic path degrade to
 *    safe values instead of propagating;
 *  - idempotent re-application: replaying the same session id through the
 *    full db boundary moves ratings/currency exactly once;
 *  - domain de-duplication: one session moves each domain at most once;
 *  - composite robustness + catalog scaling (36→40 games cannot bias the
 *    composite because it averages over the fixed 8-domain set).
 */
import { describe, expect, it } from '@jest/globals';
import type { GameSessionRecord } from '@/db';
import { SessionRepository } from '@/db/sessions';
import { INITIAL_RATING, RatingRepository } from '@/db/rating';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  computeComposite,
  type DomainRatingWithStaleness,
} from '@/rating/composite';
import {
  computeCurrency,
  computeRatingDelta,
  computeRatingOutcome,
  computeXp,
  createRatingPipeline,
  DIFFICULTY_EXPECTED_PERFORMANCE,
  expectedPerformanceFromChallenge,
  MAX_RATING_DELTA_PER_SESSION,
  RATING_K,
  clamp01,
} from '@/rating/pipeline';
import {
  levelForXp,
  levelProgress,
  xpForNextLevel,
  xpIntoLevel,
} from '@/rating/levels';

const T0 = 1_700_000_000_000;
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;

function makeSession(overrides: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id: 'session-1',
    gameId: 'memory',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5 },
    rawResult: {},
    normalizedResult: 0.8,
    xp: 0,
    startedAt: T0,
    completedAt: T0 + 60_000,
    durationMs: 60_000,
    ...overrides,
  };
}

describe('monotonicity invariants', () => {
  it('rating delta never decreases as normalized performance rises', () => {
    for (const level of DIFFICULTIES) {
      let previous = Number.NEGATIVE_INFINITY;
      for (let n = 0; n <= 40; n++) {
        const delta = computeRatingDelta(n / 40, level);
        expect(delta).toBeGreaterThanOrEqual(previous);
        previous = delta;
      }
    }
  });

  it('easier difficulties can never award a larger delta (easy-farming protection)', () => {
    for (let n = 0; n <= 20; n++) {
      const normalized = n / 20;
      const easy = computeRatingDelta(normalized, 'easy');
      const normal = computeRatingDelta(normalized, 'normal');
      const hard = computeRatingDelta(normalized, 'hard');
      const expert = computeRatingDelta(normalized, 'expert');
      expect(easy).toBeLessThanOrEqual(normal);
      expect(normal).toBeLessThanOrEqual(hard);
      expect(hard).toBeLessThanOrEqual(expert);
    }
  });

  it('expected performance falls monotonically as challenge rises', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let c = 0; c <= 100; c++) {
      const ep = expectedPerformanceFromChallenge(c / 100);
      expect(ep).toBeLessThanOrEqual(previous);
      previous = ep;
    }
  });

  it('challenge-based expectation matches the fixed baseline at anchor levels', () => {
    // The continuous curve must agree with the published per-level baselines
    // so manual and adaptive sessions are judged on one scale.
    expect(expectedPerformanceFromChallenge(0.2)).toBeCloseTo(
      DIFFICULTY_EXPECTED_PERFORMANCE.easy,
      10,
    );
    expect(expectedPerformanceFromChallenge(0.5)).toBeCloseTo(
      DIFFICULTY_EXPECTED_PERFORMANCE.normal,
      10,
    );
    expect(expectedPerformanceFromChallenge(0.8)).toBeCloseTo(
      DIFFICULTY_EXPECTED_PERFORMANCE.hard,
      10,
    );
    expect(expectedPerformanceFromChallenge(0.95)).toBeCloseTo(
      DIFFICULTY_EXPECTED_PERFORMANCE.expert,
      10,
    );
  });

  it('XP never decreases as normalized performance rises', () => {
    for (const level of DIFFICULTIES) {
      let previous = Number.NEGATIVE_INFINITY;
      for (let n = 0; n <= 20; n++) {
        const xp = computeXp(n / 20, level);
        expect(xp).toBeGreaterThanOrEqual(previous);
        previous = xp;
      }
    }
  });
});

describe('boundedness invariants', () => {
  it('per-session rating movement is capped even for absurd inputs', () => {
    const extremes = [-1e9, -1, 0, 1, 1e9, NaN, Infinity, -Infinity];
    for (const normalized of extremes) {
      for (const level of DIFFICULTIES) {
        const delta = computeRatingDelta(normalized, level);
        expect(Math.abs(delta)).toBeLessThanOrEqual(MAX_RATING_DELTA_PER_SESSION);
        expect(Number.isFinite(delta)).toBe(true);
      }
    }
  });

  it('secondary-domain magnitude never exceeds primary', () => {
    for (let n = 0; n <= 20; n++) {
      const normalized = n / 20;
      const primary = computeRatingDelta(normalized, 'normal', 1);
      const secondary = computeRatingDelta(normalized, 'normal', 0.5);
      expect(Math.abs(secondary)).toBeLessThanOrEqual(Math.abs(primary));
    }
  });

  it('XP stays inside the participation..perfect band for every difficulty', () => {
    for (const level of DIFFICULTIES) {
      const multiplier = { easy: 0.8, normal: 1, hard: 1.2, expert: 1.4, adaptive: 1.1 }[level];
      const min = Math.round(10 * multiplier);
      const max = Math.round(50 * multiplier);
      for (const normalized of [-5, 0, 0.5, 1, 5, NaN, Infinity]) {
        const xp = computeXp(normalized, level);
        expect(xp).toBeGreaterThanOrEqual(min);
        expect(xp).toBeLessThanOrEqual(max);
      }
    }
  });

  it('currency is exactly floor(xp / rate) for finite XP and 0 otherwise', () => {
    for (const xp of [-100, 0, 4, 5, 7, 42, 1000, 1e12]) {
      expect(computeCurrency(xp)).toBe(Math.floor(Math.max(0, xp) / 5));
    }
    expect(computeCurrency(NaN)).toBe(0);
    expect(computeCurrency(Infinity)).toBe(0);
    expect(computeCurrency(-Infinity)).toBe(0);
  });

  it('level progress stays in [0, 1)', () => {
    for (let xp = 0; xp <= 5000; xp += 37) {
      const p = levelProgress(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe('clamping at extremes (NaN/Infinity guards)', () => {
  it('clamp01 collapses non-finite input to 0', () => {
    // Documented contract: ANY non-finite input (NaN or ±Infinity) is a
    // malformed result and takes the worst-case 0 performance.
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-Infinity)).toBe(0);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });

  it('expectedPerformanceFromChallenge treats non-finite challenge as Normal baseline', () => {
    expect(expectedPerformanceFromChallenge(NaN)).toBe(
      DIFFICULTY_EXPECTED_PERFORMANCE.normal,
    );
    expect(expectedPerformanceFromChallenge(Infinity)).toBe(
      DIFFICULTY_EXPECTED_PERFORMANCE.normal,
    );
    expect(expectedPerformanceFromChallenge(-Infinity)).toBe(
      DIFFICULTY_EXPECTED_PERFORMANCE.normal,
    );
    // Finite out-of-range values still clamp to the endpoint behaviour.
    expect(expectedPerformanceFromChallenge(-0.1)).toBeCloseTo(
      expectedPerformanceFromChallenge(0),
      10,
    );
    expect(expectedPerformanceFromChallenge(1.1)).toBeCloseTo(
      expectedPerformanceFromChallenge(1),
      10,
    );
  });

  it('computeCurrency awards nothing for non-finite XP', () => {
    expect(computeCurrency(NaN)).toBe(0);
    expect(computeCurrency(Infinity)).toBe(0);
    expect(computeCurrency(-Infinity)).toBe(0);
  });

  it('level helpers degrade to level 1 instead of throwing or returning NaN', () => {
    for (const garbage of [NaN, Infinity, -Infinity]) {
      expect(levelForXp(garbage)).toBe(1);
      expect(Number.isFinite(xpIntoLevel(garbage))).toBe(true);
      expect(Number.isFinite(xpForNextLevel(garbage))).toBe(true);
      expect(Number.isFinite(levelProgress(garbage))).toBe(true);
    }
    expect(levelForXp(NaN)).toBe(levelForXp(0));
  });
});

describe('idempotent re-application through the db boundary', () => {
  const getDomains = (gameId: string) =>
    gameId === 'memory' ? ['Memory', 'Attention'] : [];

  it('replaying the same session id moves each rating exactly once', async () => {
    const adapter = await createMigratedDb();
    const pipeline = createRatingPipeline({ getDomains });
    const sessions = new SessionRepository(adapter, () => T0, pipeline);
    const ratings = new RatingRepository(adapter, () => T0);

    const first = await sessions.completeSession({ session: makeSession() });
    expect(first.completionOutcome).not.toBeNull();
    const memoryAfterFirst = await ratings.getRating('Memory');
    const historyAfterFirst = await ratings.getHistory();

    const replay = await sessions.completeSession({ session: makeSession() });
    expect(replay.completionOutcome).toBeNull();

    // Ratings, session count and history are untouched by the replay.
    expect(await ratings.getRating('Memory')).toEqual(memoryAfterFirst);
    expect(await ratings.getHistory()).toEqual(historyAfterFirst);
    expect((await ratings.getRating('Memory'))?.sessions).toBe(1);
    expect(historyAfterFirst).toHaveLength(2); // Memory + Attention, once each
    expect(replay.balance).toBe(first.balance);
  });

  it('a genuinely new session id does move the ratings again', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0, createRatingPipeline({ getDomains }));
    const ratings = new RatingRepository(adapter, () => T0);

    await sessions.completeSession({ session: makeSession({ id: 's-a' }) });
    await sessions.completeSession({
      session: makeSession({ id: 's-b', completedAt: T0 + 120_000 }),
    });

    expect((await ratings.getRating('Memory'))?.sessions).toBe(2);
    expect(await ratings.getHistory()).toHaveLength(4);
  });
});

describe('domain list de-duplication', () => {
  it('a repeated domain is moved once, at its first-position weight', () => {
    const session = makeSession({ normalizedResult: 1 });
    const outcome = computeRatingOutcome(
      session,
      () => ['Memory', 'Attention', 'Memory'],
    );
    expect(outcome.deltas.map((d) => d.domain)).toEqual(['Memory', 'Attention']);
    const memory = outcome.deltas.find((d) => d.domain === 'Memory')!;
    expect(memory.delta).toBe(
      Math.min(MAX_RATING_DELTA_PER_SESSION, Math.round(RATING_K * (1 - 0.6))),
    );
  });

  it('duplicate secondaries collapse without changing the primary delta', () => {
    const session = makeSession({ normalizedResult: 0.9 });
    const clean = computeRatingOutcome(session, () => ['Memory', 'Attention']);
    const dirty = computeRatingOutcome(session, () => ['Memory', 'Attention', 'Attention']);
    expect(dirty.deltas).toEqual(clean.deltas);
  });
});

describe('composite invariants', () => {
  const DOMAINS = [
    'Memory',
    'Attention',
    'Speed',
    'Math',
    'Language',
    'Logic & Problem Solving',
    'Flexibility',
    'Spatial',
  ];
  const NOW = 1_700_000_000_000;

  function rating(
    domain: string,
    value: number,
    ageDays = 0,
  ): DomainRatingWithStaleness {
    return {
      domain,
      rating: value,
      sessions: 5,
      updatedAt: NOW - ageDays * 86_400_000,
    };
  }

  it('composite lies within the min..max of its contributions', () => {
    const ratings = [rating('Memory', 1400), rating('Speed', 700)];
    const result = computeComposite(ratings, DOMAINS, NOW);
    expect(result.composite).toBeGreaterThanOrEqual(700);
    expect(result.composite).toBeLessThanOrEqual(1400);
  });

  it('unseen domains pull the composite toward INITIAL_RATING', () => {
    const played = [rating('Memory', 1600)];
    const withUnseen = computeComposite(played, DOMAINS, NOW);
    const allPlayed = computeComposite(
      DOMAINS.map((d) => rating(d, 1600)),
      DOMAINS,
      NOW,
    );
    expect(withUnseen.composite).toBeLessThan(allPlayed.composite);
    expect(withUnseen.composite).toBeGreaterThan(INITIAL_RATING);
  });

  it('stale weighting shrinks a stale outlier influence without flipping sign of effect', () => {
    // A stale 1600 must move the composite less than a fresh 1600.
    const fresh = computeComposite([rating('Memory', 1600)], DOMAINS, NOW);
    const stale = computeComposite([rating('Memory', 1600, 60)], DOMAINS, NOW);
    expect(stale.staleDomainCount).toBe(1);
    expect(stale.composite).toBeLessThan(fresh.composite);
  });

  it('a corrupt (non-finite) rating row cannot poison the average', () => {
    const corrupt = { ...rating('Memory', NaN) } as DomainRatingWithStaleness;
    const result = computeComposite([corrupt], DOMAINS, NOW);
    expect(Number.isFinite(result.composite)).toBe(true);
    expect(result.composite).toBe(INITIAL_RATING);
  });

  it('a corrupt timestamp counts as stale (conservative weight)', () => {
    const corruptTime = {
      ...rating('Memory', 1600),
      updatedAt: NaN,
    } as DomainRatingWithStaleness;
    const result = computeComposite([corruptTime], DOMAINS, NOW);
    expect(result.staleDomainCount).toBe(1);
  });

  it('catalog growth 36→40 games cannot bias the composite', () => {
    // The composite averages over the FIXED 8-domain set (`GAME_CATEGORIES`);
    // new games always land on existing domains, so growing the catalog can
    // never add a composite term or re-weight the average. Simulate both
    // catalogs mapping onto the same domains with identical final per-domain
    // ratings and assert identical composites.
    const games36 = Array.from({ length: 36 }, (_, i) => `game-${i}`);
    const games40 = [...games36, 'game-36', 'game-37', 'game-38', 'game-39'];

    // Final per-domain ratings are per-DOMAIN state (capped per session), so
    // they do not depend on how many games fed the domain.
    const finalRating = new Map(DOMAINS.map((d, i) => [d, 900 + i * 25]));

    const toDomainRatings = (games: string[]) => {
      const byDomain = new Map<string, DomainRatingWithStaleness>();
      games.forEach((_gameId, i) => {
        const domain = DOMAINS[i % DOMAINS.length];
        if (!byDomain.has(domain)) {
          byDomain.set(domain, {
            domain,
            rating: finalRating.get(domain)!,
            sessions: 10,
            updatedAt: NOW,
          });
        }
      });
      return [...byDomain.values()];
    };

    const result36 = computeComposite(toDomainRatings(games36), DOMAINS, NOW);
    const result40 = computeComposite(toDomainRatings(games40), DOMAINS, NOW);

    expect(result36.domainCount).toBe(DOMAINS.length);
    expect(result40.domainCount).toBe(DOMAINS.length);
    expect(result40.composite).toBe(result36.composite);
    expect(result40.staleDomainCount).toBe(result36.staleDomainCount);
    expect(result40.domains).toEqual(result36.domains);
  });
});
