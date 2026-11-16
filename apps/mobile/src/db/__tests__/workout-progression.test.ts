import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import type { SQLiteValue } from '../types';
import { WorkoutRepository, reconcileWorkoutPositions } from '../workout';
import { SessionRepository } from '../sessions';
import { createMigratedDb } from './helpers';

const DAY = '2026-11-16';
const T0 = new Date(2026, 10, 16, 9).getTime();
let adapter: SQLiteAdapter;
let workouts: WorkoutRepository;

async function session(id: string, gameId: string, completedAt: number, instanceKey: string | null) {
  await new SessionRepository(adapter).completeSession({ session: {
    id, gameId, completedAt, startedAt: completedAt - 1, durationMs: 1,
    gameVersion: 1, generatorVersion: 1, scoringVersion: 1, seed: 1,
    difficulty: {}, normalizedResult: 0.5, xp: 7,
    rawResult: instanceKey ? { workoutProvenance: { instanceKey, legIndex: 0, gameId } } : {},
  } });
}

beforeEach(async () => {
  adapter = await createMigratedDb();
  workouts = new WorkoutRepository(adapter, () => T0);
});
afterEach(async () => { await adapter.close(); });

describe('workout progression audit regressions', () => {
  it('reconciles all eleven active instances without starving older rows or revisiting moved rows', async () => {
    const keys = Array.from({ length: 11 }, (_, i) => `${DAY}::probe-${i}::short`);
    for (const [i, key] of keys.entries()) {
      await workouts.getOrCreate(key, { gameIds: i === 0 ? ['a'] : ['a', 'b'] });
      await adapter.run('UPDATE workout_instances SET updated_at = ? WHERE date = ?', [T0 + i, key]);
      await session(`s-${i}`, 'a', T0 + 1, key);
    }
    expect(await reconcileWorkoutPositions(adapter, () => T0 + 100)).toBe(11);
    for (const key of keys) expect((await workouts.getByDate(key))?.currentIndex).toBe(1);
    expect(await reconcileWorkoutPositions(adapter)).toBe(0);
  });

  it('does not settle a final leg from provenance naming another physical game', async () => {
    await workouts.getOrCreate(DAY, { gameIds: ['a', 'b', 'c', 'd'] });
    await workouts.skipToLeg(DAY, 3);
    await session('mismatch', 'a', T0 + 1, null);
    // Imported opaque raw results can disagree with the physical session game.
    await adapter.run('UPDATE game_sessions SET raw_result_json = ? WHERE id = ?', [
      JSON.stringify({ workoutProvenance: { instanceKey: DAY, legIndex: 3, gameId: 'd' } }), 'mismatch',
    ]);
    expect(await reconcileWorkoutPositions(adapter)).toBe(0);
    expect(await workouts.getByDate(DAY)).toMatchObject({ status: 'active', currentIndex: 3 });
  });

  it.each([false, true])('bounds summary rows to requested keys and local fallback windows (JSON1 unavailable: %s)', async (withoutJson) => {
    await workouts.getOrCreate(DAY, { gameIds: ['a'] });
    await workouts.advance(DAY);
    for (let i = 0; i < 100; i += 1) await session(`old-${i}`, 'a', T0 - 86_400_000, `2026-11-15::other-${i}::short`);
    // Even a recent foreign owner must not enter the projection.
    await session('foreign-recent', 'a', T0 + 1, '2026-11-16::other::short');
    await session('future-standalone', 'a', new Date(2026, 10, 17, 1).getTime(), null);
    await session('fallback', 'a', T0 + 2, null);
    await session('clock-backward-owner', 'a', T0 - 1000, DAY);
    const realAll = adapter.all.bind(adapter);
    const projected: number[] = [];
    adapter.all = async <T>(sql: string, params?: SQLiteValue[]): Promise<T[]> => {
      if (withoutJson && sql.includes('AS workout_provenance')) throw new Error('no such function: json_extract');
      const rows = await realAll<T>(sql, params);
      if (sql.includes('rowid AS persisted_order')) projected.push(rows.length);
      return rows;
    };
    const summary = await workouts.getWorkoutSummary(DAY);
    expect(summary?.outcomes[0].session?.completedAt).toBe(withoutJson ? T0 + 2 : T0 - 1000);
    // The bounded same-day candidate branch may include a foreign owner;
    // summary matching still rejects it. Without JSON1 only time is available.
    expect(projected).toEqual([withoutJson ? 2 : 3]);
  });
});
