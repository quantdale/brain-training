/**
 * WorkoutRepository tests (006R tasks 6.1, 6.3, 6.5, 6.6).
 *
 * The selection algorithm lives in the pure `@/workout` layer; this suite
 * verifies the PERSISTENT instance: it stores the ordered selection + status
 * + current index + reroll attempt, resumes across a simulated restart without
 * duplicating completed work, and keeps the completed prefix immutable on
 * reroll while persisting the reroll attempt count.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { createMigratedDb } from './helpers';
import { WorkoutRepository } from '../workout';

const GAMES = ['g1', 'g2', 'g3', 'g4'];

describe('WorkoutRepository — persistent instance (task 6.1)', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = new WorkoutRepository(adapter, () => 1000);
  });

  it('persists a base instance with all fields and is idempotent per date', async () => {
    const created = await workouts.getOrCreate('2026-08-17', { gameIds: GAMES, seedVersion: 3 });
    expect(created).toEqual({
      date: '2026-08-17',
      gameIds: GAMES,
      status: 'active',
      currentIndex: 0,
      rerollAttempt: 0,
      seedVersion: 3,
      createdAt: 1000,
      updatedAt: 1000,
    });

    // Second call on the same date returns the stored instance unchanged.
    const again = await workouts.getOrCreate('2026-08-17', { gameIds: ['x', 'y'], seedVersion: 9 });
    expect(again.gameIds).toEqual(GAMES);
    expect(again.seedVersion).toBe(3);
    expect(await workouts.getByDate('2026-08-17')).not.toBeNull();
    expect(await workouts.getByDate('1999-01-01')).toBeNull();
  });
});

describe('WorkoutRepository — resume after interruption (task 6.3)', () => {
  it('advances the current index and completes at the fourth game', async () => {
    const workouts = new WorkoutRepository(await createMigratedDb(), () => 2000);
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });

    const after1 = await workouts.advance('2026-08-17');
    expect(after1.currentIndex).toBe(1);
    expect(after1.status).toBe('active');

    await workouts.advance('2026-08-17');
    const after3 = await workouts.advance('2026-08-17');
    expect(after3.currentIndex).toBe(3);
    expect(after3.status).toBe('active');

    const after4 = await workouts.advance('2026-08-17');
    expect(after4.currentIndex).toBe(4);
    expect(after4.status).toBe('completed');
  });

  it('resumes from the persisted index after a simulated restart without duplicating work', async () => {
    // Session: play games 1 and 2 to completion, then the app is killed.
    const adapter = await createMigratedDb();
    const first = new WorkoutRepository(adapter, () => 3000);
    const created = await first.getOrCreate('2026-08-17', { gameIds: GAMES });
    await first.advance('2026-08-17');
    await first.advance('2026-08-17');

    // Relaunch: a fresh repository over the SAME persisted store.
    const restarted = new WorkoutRepository(adapter, () => 3001);
    const resumed = await restarted.getByDate('2026-08-17');

    // Shows 2/4 complete and resumes at game 3; completed prefix intact.
    expect(resumed?.currentIndex).toBe(2);
    expect(resumed?.status).toBe('active');
    expect(resumed?.gameIds).toEqual(GAMES); // no reward duplication / re-selection
    expect(resumed).not.toBe(created); // distinct read, not the in-memory object
  });
});

describe('WorkoutRepository — durable reroll economics (tasks 6.5, 6.6)', () => {
  it('persists the reroll attempt count and keeps the completed prefix immutable', async () => {
    const adapter = await createMigratedDb();
    const workouts = new WorkoutRepository(adapter, () => 4000);
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });

    // Game 1 completed before the reroll.
    await workouts.advance('2026-08-17');

    // First reroll (free): attempt 1, future positions replaced, prefix kept.
    const rerolled = await workouts.applyReroll('2026-08-17', ['g1', 'n2', 'n3', 'n4'], 1);
    expect(rerolled.rerollAttempt).toBe(1);
    expect(rerolled.gameIds).toEqual(['g1', 'n2', 'n3', 'n4']); // g1 (completed) immutable

    // A second reroll after game 2 also keeps both completed positions.
    await workouts.advance('2026-08-17'); // now at index 2
    const rerolled2 = await workouts.applyReroll('2026-08-17', ['g1', 'n2', 'm3', 'm4'], 2);
    expect(rerolled2.rerollAttempt).toBe(2);
    expect(rerolled2.gameIds).toEqual(['g1', 'n2', 'm3', 'm4']); // prefix [g1,n2] immutable

    // Persisted across a fresh read.
    const persisted = await workouts.getByDate('2026-08-17');
    expect(persisted?.rerollAttempt).toBe(2);
    expect(persisted?.gameIds).toEqual(['g1', 'n2', 'm3', 'm4']);
  });

  it('throws when applying a reroll to a missing instance', async () => {
    const workouts = new WorkoutRepository(await createMigratedDb(), () => 5000);
    await expect(workouts.applyReroll('2026-08-17', GAMES, 1)).rejects.toThrow(/No workout instance/);
  });
});
