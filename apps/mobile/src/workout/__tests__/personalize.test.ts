import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { GameDefinition } from '@/sdk';
import { INITIAL_RATING, isRatingStale } from '@/db/rating';
import { dailyWorkout, WORKOUT_SIZE } from '../today';
import {
  explainPersonalizedWorkout,
  personalizedWorkout,
  rankByRecency,
  reorderByWeakDomains,
  STALE_DOMAIN_DAYS,
  WEAK_DOMAIN_RATING_THRESHOLD,
} from '../personalize';
import type { DomainRating } from '../personalize';

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

function makeGames(count: number): GameDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `game-${i}`,
    name: `Game ${i}`,
    primaryCategory: CATEGORIES[i % CATEGORIES.length],
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: null,
    contentVersion: null,
    hasTutorial: false,
  }));
}

/** Fabricated ratings: every domain at the initial rating except the given map. */
function makeRatings(overrides: Record<string, number> = {}): DomainRating[] {
  return CATEGORIES.map((domain) => ({
    domain,
    rating: overrides[domain] ?? INITIAL_RATING,
    sessions: 1,
    updatedAt: 1_700_000_000_000,
  }));
}

/**
 * Ratings with per-domain rating AND timestamp overrides, anchored to a fixed
 * "now" so staleness tests are fully deterministic.
 */
const NOW_MS = 1_700_000_000_000;
function makeRatingsWithMeta(
  overrides: Record<string, { rating?: number; updatedAt?: number }> = {},
): DomainRating[] {
  return CATEGORIES.map((domain) => ({
    domain,
    rating: overrides[domain]?.rating ?? INITIAL_RATING,
    sessions: 1,
    updatedAt: overrides[domain]?.updatedAt ?? NOW_MS,
  }));
}

function ids(games: readonly GameDefinition[]): string[] {
  return games.map((game) => game.id);
}

describe('reorderByWeakDomains', () => {
  it('returns an empty workout for an empty catalog', () => {
    expect(reorderByWeakDomains([], [], createRng('seed'))).toEqual([]);
  });

  it('surfaces weak-domain games before non-weak games', () => {
    const games = makeGames(8);
    const ratings = makeRatings({ Memory: 900, Math: 850 });
    const reordered = reorderByWeakDomains(games, ratings, createRng('weak-first'));
    // Memory (game-0) and Math (game-3) are weak; every weak game must come
    // before every non-weak game.
    const firstWeak = reordered.findIndex((g) => g.id === 'game-0');
    const secondWeak = reordered.findIndex((g) => g.id === 'game-3');
    const firstStrong = reordered.findIndex((g) => !['game-0', 'game-3'].includes(g.id));
    expect(firstWeak).toBeLessThan(firstStrong);
    expect(secondWeak).toBeLessThan(firstStrong);
    expect(firstWeak).not.toBe(-1);
    expect(secondWeak).not.toBe(-1);
  });

  it('orders the weakest domain first within the weak group', () => {
    const games = makeGames(8);
    const ratings = makeRatings({ Memory: 950, Math: 800 });
    const reordered = reorderByWeakDomains(games, ratings, createRng('weakest-first'));
    expect(reordered[0]?.id).toBe('game-3'); // Math (800) beats Memory (950).
  });

  it('is deterministic: same seed always yields the same order', () => {
    const games = makeGames(8);
    const ratings = makeRatings({ Memory: 900, Speed: 1100, Math: 950 });
    const a = reorderByWeakDomains(games, ratings, createRng('fixed-seed'));
    const b = reorderByWeakDomains(games, ratings, createRng('fixed-seed'));
    expect(ids(a)).toEqual(ids(b));
  });

  it('keeps equal ratings in input order (stable sort)', () => {
    const games = makeGames(8);
    // All ratings equal: the reorder must preserve the input relative order
    // (stable sort), regardless of the rng passed in.
    const ratings = makeRatings({});
    const a = reorderByWeakDomains(games, ratings, createRng('equal-ratings-1'));
    const b = reorderByWeakDomains(games, ratings, createRng('equal-ratings-2'));
    expect(ids(a)).toEqual(ids(games));
    expect(ids(b)).toEqual(ids(games));
  });

  it('treats domains absent from ratings as at the threshold (never weak)', () => {
    const games = makeGames(8);
    // Only Memory has a rating (900, weak); all other domains are missing
    // from the map and must be treated as non-weak.
    const ratings: DomainRating[] = [{ domain: 'Memory', rating: 900, sessions: 2, updatedAt: 1 }];
    const reordered = reorderByWeakDomains(games, ratings, createRng('missing-domains'));
    expect(reordered[0]?.id).toBe('game-0');
    const rest = reordered.slice(1);
    expect(rest.map((g) => g.id)).not.toContain('game-0');
  });

  it('does not mutate the input array', () => {
    const games = makeGames(8);
    const before = ids(games);
    const ratings = makeRatings({ Memory: 900 });
    reorderByWeakDomains(games, ratings, createRng('no-mutation'));
    expect(ids(games)).toEqual(before);
  });

  it('pins the weak threshold to the rating engine initial rating', () => {
    // Both live in the repo; the threshold is deliberately equal so that only
    // ACTIVELY declined domains (below the never-played starting point) are
    // favored. If the rating engine's initial rating ever changes, this test
    // fails and the threshold must be re-aligned.
    expect(WEAK_DOMAIN_RATING_THRESHOLD).toBe(INITIAL_RATING);
  });
});

describe('rankByRecency', () => {
  it('keeps fresh games first in input order', () => {
    const games = makeGames(8);
    const ranked = rankByRecency(games, ['game-5', 'game-2']);
    expect(ranked.slice(0, 6).map((g) => g.id)).toEqual(
      ['game-0', 'game-1', 'game-3', 'game-4', 'game-6', 'game-7'],
    );
  });

  it('pushes recent games to the tail, most recent last', () => {
    const games = makeGames(8);
    // recentGameIds follows the db convention: most recent first. The tail
    // must therefore run oldest → newest, i.e. game-2 (most recent) last.
    const ranked = rankByRecency(games, ['game-2', 'game-5']);
    expect(ranked.slice(-2).map((g) => g.id)).toEqual(['game-5', 'game-2']);
    expect(ranked[ranked.length - 1]?.id).toBe('game-2');
  });

  it('ignores ids not in the selection and drops duplicates', () => {
    const games = makeGames(4);
    // recentGameIds is newest-first; the oldest occurrence of game-1 (the
    // final entry) leads the reversed tail, game-99 is not in the selection
    // and the duplicate game-1 is dropped.
    const ranked = rankByRecency(games, ['game-1', 'game-3', 'game-99', 'game-1']);
    expect(ids(ranked)).toEqual(['game-0', 'game-2', 'game-1', 'game-3']);
  });

  it('is deterministic and does not mutate its input', () => {
    const games = makeGames(8);
    const before = ids(games);
    const a = rankByRecency(games, ['game-3', 'game-1', 'game-6']);
    const b = rankByRecency(games, ['game-3', 'game-1', 'game-6']);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(games)).toEqual(before);
  });

  it('returns an empty workout for an empty catalog', () => {
    expect(rankByRecency([], ['game-1'])).toEqual([]);
  });
});

describe('personalizedWorkout', () => {
  const games = makeGames(8);
  const ratings = makeRatings({ Memory: 920, Math: 870 });
  const recent = ['game-2', 'game-5'];

  it('is deterministic: same inputs always yield the same selection', () => {
    const a = personalizedWorkout(games, '2026-08-16', ratings, recent);
    const b = personalizedWorkout(games, '2026-08-16', ratings, recent);
    expect(ids(a)).toEqual(ids(b));
  });

  it('selects WORKOUT_SIZE distinct games ordered by ascending domain rating', () => {
    const workout = personalizedWorkout(games, '2026-08-16', ratings, recent);
    expect(workout).toHaveLength(4);
    expect(new Set(ids(workout)).size).toBe(4);
    // The weak-domain reorder sorts the whole selection by rating ascending,
    // so the output ratings must be non-decreasing and the first game must be
    // one of the lowest-rated games in the selection.
    const ratingByCategory = new Map(ratings.map((r) => [r.domain, r.rating]));
    const ratingOf = (g: GameDefinition): number =>
      ratingByCategory.get(g.primaryCategory) ?? INITIAL_RATING;
    const outputRatings = workout.map(ratingOf);
    expect(outputRatings).toEqual([...outputRatings].sort((a, b) => a - b));
    expect(ratingOf(workout[0] ?? games[0])).toBe(Math.min(...outputRatings));
  });

  it('stays deterministic across dates and varies between dates', () => {
    const d1 = personalizedWorkout(games, '2026-08-16', ratings, recent);
    const d1again = personalizedWorkout(games, '2026-08-16', ratings, recent);
    const d2 = personalizedWorkout(games, '2026-08-17', ratings, recent);
    expect(ids(d1)).toEqual(ids(d1again));
    expect(ids(d1)).not.toEqual(ids(d2));
  });

  it('gives each attempt a distinct deterministic selection (reroll variants)', () => {
    const base = personalizedWorkout(games, '2026-08-16', ratings, recent, 0);
    const reroll = personalizedWorkout(games, '2026-08-16', ratings, recent, 1);
    const rerollAgain = personalizedWorkout(games, '2026-08-16', ratings, recent, 1);
    expect(ids(base)).not.toEqual(ids(reroll));
    expect(ids(reroll)).toEqual(ids(rerollAgain));
  });

  it('follows the documented seed scheme (workout::date::attempt::personalized)', () => {
    // Pins the composition contract: dailyWorkout → rankByRecency →
    // reorderByWeakDomains with the seeded stream from the documented scheme.
    const expected = reorderByWeakDomains(
      rankByRecency(dailyWorkout(games, '2026-08-16', 2), recent),
      ratings,
      createRng('workout::2026-08-16::2::personalized'),
    );
    const actual = personalizedWorkout(games, '2026-08-16', ratings, recent, 2);
    expect(ids(actual)).toEqual(ids(expected));
  });

  it('handles empty catalogs and small catalogs', () => {
    expect(personalizedWorkout([], '2026-08-16', ratings, recent)).toEqual([]);
    const three = makeGames(3);
    const small = personalizedWorkout(three, '2026-08-16', ratings, recent);
    expect(small).toHaveLength(3);
    expect(new Set(ids(small)).size).toBe(3);
  });

  it('keeps recency ordering for equal ratings (weak priority dominates)', () => {
    // Composition is dailyWorkout → rankByRecency → reorderByWeakDomains.
    // The weak-domain reorder sorts the whole selection by rating, so a weak
    // RECENT game legitimately surfaces before a strong FRESH one; recency
    // survives only as the tie-break for equal ratings (stable sort).
    const workout = personalizedWorkout(games, '2026-08-16', ratings, [
      'game-0',
      'game-1',
      'game-2',
      'game-3',
      'game-4',
    ]);
    const recentSet = new Set(['game-0', 'game-1', 'game-2', 'game-3', 'game-4']);
    const ratingByCategory = new Map(ratings.map((r) => [r.domain, r.rating]));
    const ratingOf = (g: GameDefinition): number =>
      ratingByCategory.get(g.primaryCategory) ?? INITIAL_RATING;
    const position = new Map(workout.map((g, i) => [g.id, i]));
    const fresh = workout.filter((g) => !recentSet.has(g.id));
    const recent = workout.filter((g) => recentSet.has(g.id));
    for (const f of fresh) {
      for (const r of recent) {
        if (ratingOf(f) === ratingOf(r)) {
          // Equal ratings: the stable reorder preserves the recency step's
          // relative order, so the fresh game must precede the recent one.
          expect(position.get(f.id)).toBeLessThan(position.get(r.id) ?? 0);
        } else if (ratingOf(r) > ratingOf(f)) {
          // Recent but higher-rated: must not leapfrog a lower-rated fresh game.
          expect(position.get(r.id)).toBeGreaterThan(position.get(f.id) ?? 0);
        }
        // ratingOf(r) < ratingOf(f): weak recent game first — intended.
      }
    }
  });
});

describe('staleness tier (constitution §15: inactivity marks ratings stale)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const games = makeGames(8); // game-0 Memory, game-3 Math, game-2 Speed, ...

  it('pins STALE_DOMAIN_DAYS to the isRatingStale default horizon', () => {
    // Both live in the repo; the personalization staleness horizon must stay
    // aligned with the rating engine's staleness definition. If either
    // changes, this test fails and both must be re-aligned consciously.
    expect(STALE_DOMAIN_DAYS).toBe(30);
    expect(isRatingStale(NOW_MS - 31 * DAY_MS, NOW_MS)).toBe(true);
    expect(isRatingStale(NOW_MS - 29 * DAY_MS, NOW_MS)).toBe(false);
  });

  it('matches isRatingStale semantics exactly across a boundary sweep', () => {
    for (let ageDays = 28; ageDays <= 32; ageDays += 1) {
      for (const extraMs of [0, 1, -1]) {
        const updatedAt = NOW_MS - ageDays * DAY_MS + extraMs;
        const expected = isRatingStale(updatedAt, NOW_MS, STALE_DOMAIN_DAYS);
        // Probe through the public reorder API: a single-game catalog whose
        // only domain is Speed — if stale it surfaces via the stale tier even
        // with a HIGH rating; if fresh it stays in input position among
        // equally-rated games (stable sort keeps it first anyway), so instead
        // compare against a fresh-rating control to detect tier movement.
        const speedGames = makeGames(8).filter((g) => g.primaryCategory === 'Speed');
        const highRating = makeRatingsWithMeta({
          Speed: { rating: 1400, updatedAt },
        });
        const withClock = reorderByWeakDomains(
          makeGames(8),
          highRating,
          createRng('parity'),
          { nowMs: NOW_MS },
        );
        const surfaced = withClock.slice(0, speedGames.length).some((g) => g.primaryCategory === 'Speed');
        // A 1400-rated Speed domain only leaves the tail tier when stale.
        expect(surfaced).toBe(expected);
      }
    }
  });

  it('orders weak → stale → rest when a clock is provided', () => {
    const ratings = makeRatingsWithMeta({
      Memory: { rating: 900, updatedAt: NOW_MS }, // weak, fresh
      Speed: { rating: 1200, updatedAt: NOW_MS - 40 * DAY_MS }, // stale, strong
      Math: { rating: 1100, updatedAt: NOW_MS }, // fresh, strong
    });
    const reordered = reorderByWeakDomains(games, ratings, createRng('tiers'), {
      nowMs: NOW_MS,
    });
    const indexOf = (id: string) => reordered.findIndex((g) => g.id === id);
    const weak = indexOf('game-0'); // Memory
    const stale = indexOf('game-2'); // Speed
    const rest = indexOf('game-3'); // Math (fresh strong)
    expect(weak).toBeLessThan(stale);
    expect(stale).toBeLessThan(rest);
  });

  it('keeps the pre-staleness ordering when no clock is passed (opt-in)', () => {
    const ratings = makeRatingsWithMeta({
      Speed: { rating: 1200, updatedAt: NOW_MS - 400 * DAY_MS }, // very stale
    });
    const withoutOptions = reorderByWeakDomains(games, ratings, createRng('off'));
    // Without nowMs there is no stale tier: Speed (1200) is an ordinary
    // tail-tier member, rating-sorted AFTER the initial-rating games.
    expect(withoutOptions[withoutOptions.length - 1]?.id).toBe('game-2');
    // With the clock the same inputs surface Speed via the stale tier instead.
    const withClock = reorderByWeakDomains(games, ratings, createRng('on'), {
      nowMs: NOW_MS,
    });
    expect(withClock[0]?.id).toBe('game-2');
  });

  it('treats exactly maxAgeDays as NOT stale and one ms more as stale', () => {
    const boundary = makeRatingsWithMeta({
      Speed: { rating: 1200, updatedAt: NOW_MS - 30 * DAY_MS },
    });
    const atBoundary = reorderByWeakDomains(games, boundary, createRng('b0'), {
      nowMs: NOW_MS,
    });
    // Not stale ⇒ ordinary tail-tier member, rating-sorted last.
    expect(atBoundary[atBoundary.length - 1]?.id).toBe('game-2');

    const past = makeRatingsWithMeta({
      Speed: { rating: 1200, updatedAt: NOW_MS - 30 * DAY_MS - 1 },
    });
    const justPast = reorderByWeakDomains(games, past, createRng('b1'), {
      nowMs: NOW_MS,
    });
    expect(justPast[0]?.id).toBe('game-2'); // Speed surfaces as stale
  });

  it('never marks domains without a timestamp stale (even with a clock)', () => {
    const ratings: DomainRating[] = [
      { domain: 'Speed', rating: 1200, sessions: 3 }, // no updatedAt field value
    ];
    const reordered = reorderByWeakDomains(games, ratings, createRng('no-ts'), {
      nowMs: NOW_MS,
    });
    // Absent timestamp ⇒ never the stale tier; Speed stays an ordinary
    // tail-tier member (rating-sorted after the threshold-rated rest).
    expect(reordered[reordered.length - 1]?.id).toBe('game-2');
  });

  it('honors the staleDays override', () => {
    const ratings = makeRatingsWithMeta({
      Speed: { rating: 1200, updatedAt: NOW_MS - 8 * DAY_MS },
    });
    const defaultHorizon = reorderByWeakDomains(games, ratings, createRng('d'), {
      nowMs: NOW_MS,
    });
    // 8 days < default 30 ⇒ not stale ⇒ tail-tier, rating-sorted last.
    expect(defaultHorizon[defaultHorizon.length - 1]?.id).toBe('game-2');
    const shortHorizon = reorderByWeakDomains(games, ratings, createRng('s'), {
      nowMs: NOW_MS,
      staleDays: 7,
    });
    expect(shortHorizon[0]?.id).toBe('game-2');
  });

  it('flows through personalizedWorkout deterministically', () => {
    // A 4-game catalog (Memory, Attention, Speed, Math) so the base selection
    // returns the whole pool and every tier is guaranteed represented.
    const four = makeGames(4);
    const ratings = makeRatingsWithMeta({
      Memory: { rating: 900, updatedAt: NOW_MS }, // weak
      Speed: { rating: 1300, updatedAt: NOW_MS - 90 * DAY_MS }, // stale
      Attention: { rating: 1100, updatedAt: NOW_MS }, // fresh strong
      Math: { rating: 1050, updatedAt: NOW_MS }, // fresh strong
    });
    const a = personalizedWorkout(four, '2026-08-16', ratings, [], 0, [], {
      nowMs: NOW_MS,
    });
    const b = personalizedWorkout(four, '2026-08-16', ratings, [], 0, [], {
      nowMs: NOW_MS,
    });
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
    const pos = new Map(a.map((g, i) => [g.id, i]));
    expect(pos.get('game-0')).toBeLessThan(pos.get('game-2') ?? Infinity); // weak before stale
    expect(pos.get('game-2')).toBeLessThan(pos.get('game-1') ?? Infinity); // stale before fresh strong
    expect(pos.get('game-2')).toBeLessThan(pos.get('game-3') ?? Infinity);
  });
});

describe('new-player behavior (empty authoritative history)', () => {
  const games = makeGames(8);

  it('with empty ratings and recency, returns the balanced base selection in order', () => {
    const date = '2026-08-16';
    const workout = personalizedWorkout(games, date, [], []);
    // No weak/stale/recency signals exist yet: the stable reorder must be a
    // no-op over the deterministic base selection.
    expect(workout.map((g) => g.id)).toEqual(dailyWorkout(games, date).map((g) => g.id));
    expect(workout).toHaveLength(WORKOUT_SIZE);
    expect(new Set(workout.map((g) => g.id)).size).toBe(WORKOUT_SIZE);
  });

  it('every game is explained as plainly selected for a new player', () => {
    const reasons = explainPersonalizedWorkout(games, '2026-08-16', [], []);
    expect(reasons.map((r) => r.kind)).toEqual(
      Array.from({ length: reasons.length }, () => 'selected'),
    );
  });

  it('partial history (only some domains rated) never fabricates weakness', () => {
    // One strong, recently-played domain; everything else unrated. Unrated
    // domains sit AT the threshold: neither weak nor stale, and the rated
    // 1150 domain must not surface ahead of them either.
    const ratings: DomainRating[] = [
      { domain: 'Memory', rating: 1150, sessions: 4, updatedAt: NOW_MS },
    ];
    const reordered = reorderByWeakDomains(games, ratings, createRng('partial'), {
      nowMs: NOW_MS,
    });
    expect(reordered[0]?.id).not.toBe('game-0');
  });
});

describe('explainPersonalizedWorkout', () => {
  const games = makeGames(8);

  it('labels weak, stale, recency-avoided and selected games with reasons', () => {
    // A 4-game catalog (Memory, Attention, Speed, Math) so the whole pool is
    // the selection and every signal kind is guaranteed reachable.
    const four = makeGames(4);
    const ratings = makeRatingsWithMeta({
      Memory: { rating: 850, updatedAt: NOW_MS }, // weak
      Speed: { rating: 1250, updatedAt: NOW_MS - 60 * 24 * 60 * 60 * 1000 }, // stale
      Attention: { rating: 1000, updatedAt: NOW_MS },
      Math: { rating: 1000, updatedAt: NOW_MS },
    });
    const reasons = explainPersonalizedWorkout(
      four,
      '2026-08-16',
      ratings,
      ['game-1'], // Attention played recently
      0,
      [],
      { nowMs: NOW_MS },
    );
    const byId = new Map(reasons.map((r) => [r.gameId, r]));
    expect(byId.get('game-0')?.kind).toBe('weak-domain');
    expect(byId.get('game-0')?.detail).toContain('Memory');
    expect(byId.get('game-2')?.kind).toBe('stale-domain');
    expect(byId.get('game-2')?.detail).toContain('not played for');
    expect(byId.get('game-1')?.kind).toBe('recency-avoided');
    expect(byId.get('game-3')?.kind).toBe('selected');
  });

  it('is deterministic: same inputs yield the same reasons', () => {
    const ratings = makeRatings({ Memory: 900, Math: 950 });
    const a = explainPersonalizedWorkout(games, '2026-08-16', ratings, ['game-2']);
    const b = explainPersonalizedWorkout(games, '2026-08-16', ratings, ['game-2']);
    expect(a).toEqual(b);
  });

  it('marks relaxed-exclusion survivors as excluded (tiny catalogs)', () => {
    const small = makeGames(WORKOUT_SIZE + 1);
    const exclude = small.slice(0, WORKOUT_SIZE - 1).map((g) => g.id);
    const reasons = explainPersonalizedWorkout(small, '2026-08-16', [], [], 0, exclude);
    expect(reasons.some((r) => r.kind === 'excluded')).toBe(true);
  });
});
