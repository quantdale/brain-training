/**
 * 065: workout repair compare-and-swap.
 *
 * `reconcile`/`persistRepaired` used to be blind read-modify-write: a
 * concurrent `advanceForSession` commit landing between the repair's read and
 * write was silently replayed (the just-completed leg became unplayed again)
 * or the whole instance was deleted including played legs. The repair is now
 * two explicit steps — `observeRepair` (raw row read) and `applyRepair`
 * (conditional UPDATE/DELETE predicated on the observed date, index, status
 * and exact raw `game_ids_json` bytes) — so these tests drive the two steps in
 * the order a real race would: observe -> concurrent CAS commit -> repair.
 *
 * `applyReroll` gained the same raw-bytes predicate; its interleaving is
 * driven through a delegating adapter that performs the concurrent write
 * between the repository's read and its conditional UPDATE.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import type { SQLiteValue } from '../types';
import { createMigratedDb } from './helpers';
import { WorkoutRepository, WorkoutWriteConflictError } from '../workout';

/** Mutable injectable clock shared by the repositories under test. */
const clock = { now: 10_000 };

function makeWorkouts(adapter: SQLiteAdapter): WorkoutRepository {
  return new WorkoutRepository(adapter, () => clock.now);
}

/** Ownership tuple for a leg of the daily instance. */
function sessionFor(instanceKey: string, legIndex: number, gameId: string) {
  return {
    gameId,
    workoutProvenance: { instanceKey, legIndex, gameId },
  };
}

/**
 * Delegating adapter whose `run` can interleave one concurrent write before a
 * matching statement executes — the deterministic seam for TOCTOU tests.
 */
function withBeforeRun(
  inner: SQLiteAdapter,
  beforeRun: (sql: string, params?: SQLiteValue[]) => Promise<void>,
): SQLiteAdapter {
  return {
    exec: (sql) => inner.exec(sql),
    run: async (sql, params) => {
      await beforeRun(sql, params);
      return inner.run(sql, params);
    },
    get: <T>(sql: string, params?: SQLiteValue[]) => inner.get<T>(sql, params),
    all: <T>(sql: string, params?: SQLiteValue[]) => inner.all<T>(sql, params),
    transaction: <T>(fn: (txn: SQLiteAdapter) => Promise<T>) =>
      inner.transaction(fn),
    close: () => inner.close(),
  };
}

describe('065: workout repair is compare-and-swapped on the observed row', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = makeWorkouts(adapter);
    clock.now = 10_000;
  });

  it('commits a fresh observation through the CAS path (repair still repairs)', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['a', 'retired', 'c'],
      seedVersion: 1,
    });
    const observed = await workouts.observeRepair('2026-08-20');
    expect(observed).not.toBeNull();
    expect(observed?.currentIndex).toBe(0);
    expect(observed?.status).toBe('active');
    expect(observed?.gameIdsJson).toBe(JSON.stringify(['a', 'retired', 'c']));

    const repaired = await workouts.applyRepair(
      observed!,
      new Set(['a', 'c', 'sub']),
    );
    expect(repaired?.gameIds).toEqual(['a', 'c', 'sub']);
    const persisted = await workouts.getByDate('2026-08-20');
    expect(persisted?.gameIds).toEqual(['a', 'c', 'sub']);
    expect(persisted?.status).toBe('active');
  });

  it('a stable all-retired row is still deleted by reconcile', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['ghost-1'],
      seedVersion: 1,
    });
    const result = await workouts.reconcile('2026-08-20', new Set(['live-a']));
    expect(result).toBeNull();
    expect(await workouts.getByDate('2026-08-20')).toBeNull();
  });

  it('a repair observed at leg n cannot replay a leg advanced to n+1', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['a', 'retired', 'c'],
      seedVersion: 1,
    });
    await workouts.advance('2026-08-20'); // leg 0 played: index 0 -> 1
    const staleObservation = await workouts.observeRepair('2026-08-20');
    expect(staleObservation?.currentIndex).toBe(1);

    // Concurrent completion of the CURRENT leg commits its own CAS.
    clock.now = 20_000;
    const advance = await workouts.advanceForSession(
      sessionFor('2026-08-20', 1, 'retired'),
    );
    expect(advance.advanced).toBe(true);
    expect(advance.instance?.currentIndex).toBe(2);

    // The repair computed from the stale observation (which would have
    // substituted the retired leg and kept index 1) must not commit.
    clock.now = 30_000;
    const afterRepair = await workouts.applyRepair(
      staleObservation!,
      new Set(['a', 'c']),
    );
    expect(afterRepair?.currentIndex).toBe(2);
    const persisted = await workouts.getByDate('2026-08-20');
    expect(persisted?.gameIds).toEqual(['a', 'retired', 'c']);
    expect(persisted?.currentIndex).toBe(2);
    expect(persisted?.status).toBe('active');
  });

  it('a stale all-retired repair cannot delete a row advanced underneath (active)', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['ghost-1', 'ghost-2'],
      seedVersion: 1,
    });
    const staleObservation = await workouts.observeRepair('2026-08-20');
    expect(staleObservation?.currentIndex).toBe(0);

    clock.now = 20_000;
    await workouts.advanceForSession(sessionFor('2026-08-20', 0, 'ghost-1'));

    // Every observed game is retired -> the pure repair says "delete so a
    // fresh selection regenerates"; the conditional DELETE must lose.
    clock.now = 30_000;
    const afterRepair = await workouts.applyRepair(
      staleObservation!,
      new Set(['live-a']),
    );
    expect(afterRepair).not.toBeNull();
    expect(afterRepair?.currentIndex).toBe(1);
    const persisted = await workouts.getByDate('2026-08-20');
    expect(persisted).not.toBeNull();
    expect(persisted?.gameIds).toEqual(['ghost-1', 'ghost-2']);
    expect(persisted?.currentIndex).toBe(1);
  });

  it('a stale all-retired repair cannot delete a row completed underneath', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['ghost-1'],
      seedVersion: 1,
    });
    const staleObservation = await workouts.observeRepair('2026-08-20');

    clock.now = 20_000;
    const advance = await workouts.advanceForSession(
      sessionFor('2026-08-20', 0, 'ghost-1'),
    );
    expect(advance.instance?.status).toBe('completed');
    expect(advance.instance?.currentIndex).toBe(1);

    clock.now = 30_000;
    const afterRepair = await workouts.applyRepair(
      staleObservation!,
      new Set(['live-a']),
    );
    expect(afterRepair?.status).toBe('completed');
    expect(afterRepair?.currentIndex).toBe(1);
    expect(await workouts.getByDate('2026-08-20')).not.toBeNull();
  });

  it('a repair observed before a same-index reroll cannot overwrite the rerolled list', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['a', 'b', 'c'],
      seedVersion: 1,
    });
    await workouts.advance('2026-08-20'); // played 'a': index 1
    const staleObservation = await workouts.observeRepair('2026-08-20');
    expect(staleObservation?.currentIndex).toBe(1);

    // Concurrent reroll replaces the future legs at the SAME index/status.
    clock.now = 20_000;
    await workouts.applyReroll('2026-08-20', ['a', 'x', 'y'], 1);

    // The stale repair would shorten the list to ['a', 'c']; the raw
    // game_ids_json predicate must lose instead of discarding the reroll.
    clock.now = 30_000;
    const afterRepair = await workouts.applyRepair(
      staleObservation!,
      new Set(['a', 'c']),
    );
    expect(afterRepair?.gameIds).toEqual(['a', 'x', 'y']);
    expect(afterRepair?.rerollAttempt).toBe(1);
    const persisted = await workouts.getByDate('2026-08-20');
    expect(persisted?.gameIds).toEqual(['a', 'x', 'y']);
    expect(persisted?.rerollAttempt).toBe(1);
    expect(persisted?.currentIndex).toBe(1);
  });

  it('applyReroll CAS includes the raw game_ids_json bytes read', async () => {
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['a', 'b', 'c'],
      seedVersion: 1,
    });
    let interleaved = false;
    const racingAdapter = withBeforeRun(adapter, async (sql) => {
      if (
        interleaved ||
        !sql.includes('SET game_ids_json = ?, reroll_attempt')
      ) {
        return;
      }
      interleaved = true;
      // Concurrent writer replaces the stored list between applyReroll's
      // read and its conditional UPDATE, keeping attempt/index unchanged.
      await adapter.run(
        'UPDATE workout_instances SET game_ids_json = ? WHERE date = ?',
        [JSON.stringify(['x', 'y', 'z']), '2026-08-20'],
      );
    });
    const racingWorkouts = makeWorkouts(racingAdapter);

    await expect(
      racingWorkouts.applyReroll('2026-08-20', ['a', 'n1', 'n2'], 1),
    ).rejects.toThrow(WorkoutWriteConflictError);
    expect(interleaved).toBe(true);

    // The concurrent writer's list survived; the reroll did not half-apply.
    const stored = await workouts.getByDate('2026-08-20');
    expect(stored?.gameIds).toEqual(['x', 'y', 'z']);
    expect(stored?.rerollAttempt).toBe(0);
  });
});
