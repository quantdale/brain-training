import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { INITIAL_RATING, isRatingStale, MIN_RATING, RatingRepository } from '../rating';
import { SessionRepository } from '../sessions';
import type { GameSessionRecord, RatingDelta } from '../types';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

/** Insert a real session row (rating_history has an FK to game_sessions). */
async function seedSession(adapter: SQLiteAdapter, id: string): Promise<void> {
  const session: GameSessionRecord = {
    id,
    gameId: 'memory',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.5,
    xp: 0,
    startedAt: T0,
    completedAt: T0 + 1_000,
    durationMs: 1_000,
  };
  await new SessionRepository(adapter, () => T0).completeSession({ session });
}

describe('RatingRepository', () => {
  it('applies deltas: upserts the domain rating and appends history', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    await seedSession(adapter, 'session-1');

    const entries = await adapter.transaction((txn) =>
      ratings.applyDeltas(
        txn,
        'session-1',
        [
          { domain: 'Memory', delta: 10 },
          { domain: 'Attention', delta: -5 },
        ],
        T0 + 90_000,
      ),
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ domain: 'Memory', delta: 10, ratingAfter: INITIAL_RATING + 10 });
    expect(entries[1]).toMatchObject({ domain: 'Attention', delta: -5, ratingAfter: INITIAL_RATING - 5 });

    const all = await ratings.getRatings();
    expect(all).toEqual([
      { domain: 'Attention', rating: INITIAL_RATING - 5, sessions: 1, updatedAt: T0 },
      { domain: 'Memory', rating: INITIAL_RATING + 10, sessions: 1, updatedAt: T0 },
    ]);

    const history = await ratings.getHistory();
    expect(history.map((h) => h.domain)).toEqual(['Attention', 'Memory']);
  });

  it('accumulates deltas and session counts across sessions', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    const deltas: readonly RatingDelta[] = [{ domain: 'Speed', delta: 4 }];
    await seedSession(adapter, 's1');
    await seedSession(adapter, 's2');

    await adapter.transaction((txn) => ratings.applyDeltas(txn, 's1', deltas, T0));
    await adapter.transaction((txn) => ratings.applyDeltas(txn, 's2', deltas, T0 + 1000));

    const rating = await ratings.getRating('Speed');
    expect(rating).toEqual({ domain: 'Speed', rating: INITIAL_RATING + 8, sessions: 2, updatedAt: T0 });
    expect(await ratings.getHistory(100)).toHaveLength(2);
  });

  it('clamps ratings at MIN_RATING (never negative)', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    await seedSession(adapter, 's1');

    await adapter.transaction((txn) =>
      ratings.applyDeltas(txn, 's1', [{ domain: 'Math', delta: -1001 }], T0),
    );

    const rating = await ratings.getRating('Math');
    expect(rating?.rating).toBe(MIN_RATING);
    expect(rating?.sessions).toBe(1);
    // History still records the true delta and the clamped rating after.
    const history = await ratings.getHistory();
    expect(history[0]).toMatchObject({ domain: 'Math', delta: -1001, ratingAfter: MIN_RATING });
  });

  it('returns null for a domain that was never played', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    expect(await ratings.getRating('Language')).toBeNull();
    expect(await ratings.getRatings()).toEqual([]);
  });

  it('enforces append-only history: UPDATE and DELETE are rejected', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    await seedSession(adapter, 's1');
    await adapter.transaction((txn) =>
      ratings.applyDeltas(txn, 's1', [{ domain: 'Memory', delta: 5 }], T0),
    );
    const [entry] = await ratings.getHistory();

    await expect(
      adapter.run('UPDATE rating_history SET delta = 99 WHERE id = ?', [entry.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      adapter.run('DELETE FROM rating_history WHERE id = ?', [entry.id]),
    ).rejects.toThrow(/append-only/);

    expect(await ratings.getHistory()).toHaveLength(1);
    const rating = await ratings.getRating('Memory');
    expect(rating?.rating).toBe(INITIAL_RATING + 5);
  });
});

describe('isRatingStale', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('flags ratings untouched beyond the window as stale', () => {
    expect(isRatingStale(T0, T0 + 29 * DAY)).toBe(false);
    expect(isRatingStale(T0, T0 + 30 * DAY)).toBe(false); // exactly at the edge
    expect(isRatingStale(T0, T0 + 30 * DAY + 1)).toBe(true);
    expect(isRatingStale(T0, T0 + 90 * DAY)).toBe(true);
  });

  it('supports a custom window and rejects non-positive windows', () => {
    expect(isRatingStale(T0, T0 + 10 * DAY, 7)).toBe(true);
    expect(isRatingStale(T0, T0 + 3 * DAY, 7)).toBe(false);
    expect(() => isRatingStale(T0, T0, 0)).toThrow(/maxAgeDays/);
  });
});
