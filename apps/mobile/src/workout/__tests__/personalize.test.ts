import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { GameDefinition } from '@/sdk';
import { INITIAL_RATING } from '@/db/rating';
import { dailyWorkout } from '../today';
import {
  personalizedWorkout,
  rankByRecency,
  reorderByWeakDomains,
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
