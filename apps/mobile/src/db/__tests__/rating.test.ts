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
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
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
    // Task 9.2: updatedAt uses session event time (T0 + 90_000), not processing time
    expect(all).toEqual([
      { domain: 'Attention', rating: INITIAL_RATING - 5, sessions: 1, updatedAt: T0 + 90_000 },
      { domain: 'Memory', rating: INITIAL_RATING + 10, sessions: 1, updatedAt: T0 + 90_000 },
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
    // Task 9.2: updatedAt uses session event time, not processing time
    expect(rating).toEqual({ domain: 'Speed', rating: INITIAL_RATING + 8, sessions: 2, updatedAt: T0 + 1000 });
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
    // History records the actual applied delta after floor/cap, not the requested delta.
    const history = await ratings.getHistory();
    expect(history[0]).toMatchObject({ domain: 'Math', delta: -1000, ratingAfter: MIN_RATING });
  });

  it('projects every history column (regression: aliased SELECT + snake_case mapper dropped fields)', async () => {
    // Wave-1 refactor aliased HISTORY_COLUMNS to camelCase while mapHistoryRow
    // still read snake_case keys, so getHistory/getHistoryWindowed/
    // getHistoryForSession returned undefined sessionId/ratingAfter/createdAt
    // while domain/delta happened to match. Pin ALL projected fields on every
    // read path so a projection/mapper mismatch can never ship silently again.
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    await seedSession(adapter, 'session-full');
    const eventAt = T0 + 5_000;

    await adapter.transaction((txn) =>
      ratings.applyDeltas(
        txn,
        'session-full',
        [
          { domain: 'Memory', delta: 7 },
          { domain: 'Focus', delta: -3 },
        ],
        eventAt,
      ),
    );

    const expectedEntry = (domain: string, delta: number, ratingAfter: number) => ({
      sessionId: 'session-full',
      domain,
      delta,
      ratingAfter,
      createdAt: eventAt,
    });

    // getHistory: newest first, full projection with concrete values.
    expect(await ratings.getHistory(10)).toEqual([
      { id: expect.any(Number), ...expectedEntry('Focus', -3, INITIAL_RATING - 3) },
      { id: expect.any(Number), ...expectedEntry('Memory', 7, INITIAL_RATING + 7) },
    ]);

    // Windowed variant shares the same projection.
    expect(await ratings.getHistoryWindowed({ limit: 10 })).toHaveLength(2);
    expect(await ratings.getHistoryWindowed({ domain: 'Memory' })).toEqual([
      { id: expect.any(Number), ...expectedEntry('Memory', 7, INITIAL_RATING + 7) },
    ]);

    // Per-session variant restores application order AND the full projection.
    expect(await ratings.getHistoryForSession('session-full')).toEqual([
      { id: expect.any(Number), ...expectedEntry('Memory', 7, INITIAL_RATING + 7) },
      { id: expect.any(Number), ...expectedEntry('Focus', -3, INITIAL_RATING - 3) },
    ]);
    expect(await ratings.getHistoryForSession('missing-session')).toEqual([]);
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

  it('rejects duplicate domain deltas for one session before writing any history', async () => {
    const adapter = await createMigratedDb();
    const ratings = new RatingRepository(adapter, () => T0);
    await seedSession(adapter, 'duplicate-session');

    await expect(
      adapter.transaction((txn) =>
        ratings.applyDeltas(
          txn,
          'duplicate-session',
          [
            { domain: 'Memory', delta: 5 },
            { domain: 'Memory', delta: 7 },
          ],
          T0,
        ),
      ),
    ).rejects.toThrow(/at most one entry per domain/);

    expect(await ratings.getHistoryForSession('duplicate-session')).toEqual([]);
    expect(await ratings.getRating('Memory')).toBeNull();
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
