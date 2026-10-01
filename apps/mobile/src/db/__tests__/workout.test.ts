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
import { readCode } from '@/test-utils/source-scan';
import { resolve } from 'node:path';

import { createMigratedDb } from './helpers';
import { WorkoutRepository, WorkoutWriteConflictError } from '../workout';
import { MAX_WORKOUT_GAME_IDS } from '@/workout/templates';

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
      // 073: a fresh instance has played and skipped nothing.
      skippedIndices: [],
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

/**
 * 073 (D5): the reroll compare-and-set must enforce the SAME preconditions as
 * the advance.
 *
 * The reroll statement omitted `status = 'active'` while the advance carried
 * it, so a reroll could rewrite the game list of a COMPLETED workout —
 * resurrecting future legs onto a finished row whose position is already at
 * the end. The two statements being hand-written copies of each other is the
 * defect; this pins the equality that duplication broke.
 */
describe('reroll refuses a non-active workout (073 D5)', () => {
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    workouts = new WorkoutRepository(await createMigratedDb(), () => 1000);
  });

  it('rejects a reroll once the workout is completed', async () => {
    const date = '2026-08-17';
    await workouts.getOrCreate(date, { gameIds: GAMES, seedVersion: 3 });
    // Play it out: a 4-game workout completes on the FOURTH advance (index
    // 0 -> 1 -> 2 -> 3 -> 4, and the status flips at the end).
    for (let leg = 0; leg < GAMES.length - 1; leg++) {
      const mid = await workouts.advance(date);
      expect(mid.status).toBe('active');
    }
    const finished = await workouts.advance(date);
    expect(finished.status).toBe('completed');
    expect(finished.currentIndex).toBe(GAMES.length);

    const before = (await workouts.getByDate(date))?.gameIds;
    // The reroll must lose loudly rather than quietly rewriting a finished row.
    await expect(workouts.applyReroll(date, ['x', 'y'], 1)).rejects.toBeInstanceOf(
      WorkoutWriteConflictError,
    );
    // ...and the completed row is byte-identical afterwards: a rejected write
    // that still changed something would be worse than no guard at all.
    expect((await workouts.getByDate(date))?.gameIds).toEqual(before);
  });

  it('still accepts a reroll on an active workout', () => {
    // The guard must not be so broad that it breaks the feature it protects.
    return (async () => {
      const date = '2026-08-18';
      await workouts.getOrCreate(date, { gameIds: ['memory', 'attention-odd-one-out'], seedVersion: 1 });
      const applied = await workouts.applyReroll(date, ['memory', 'speed-tap-rush'], 1);
      expect(applied.status).toBe('active');
      // The played prefix is preserved; only the future legs are replaced.
      expect(applied.gameIds).toEqual(['memory', 'speed-tap-rush']);
      expect(applied.rerollAttempt).toBe(1);
    })();
  });
});

/**
 * 073 (D5 follow-up): the two position writers must keep using the ONE
 * compare-and-set.
 *
 * The original defect was drift between two hand-written copies of the same
 * conditional UPDATE — the reroll's copy silently lost `status = 'active'`.
 * Fixing the predicate without removing the duplication would leave the next
 * drift one edit away, so this asserts the STRUCTURE: `workout.ts` contains no
 * hand-written `UPDATE workout_instances` statement of its own, and both writers
 * select a SET clause from the shared closed set.
 */
describe('workout position writes share one compare-and-set (073 D5)', () => {
  const workoutSource = readCode(resolve(__dirname, '..', 'workout.ts'));

  it('the POSITION writers have no hand-written UPDATE of their own', () => {
    // Scoped honestly. `workout.ts` still contains two OTHER
    // `UPDATE workout_instances` statements — `applyRepair` and `reconcile` —
    // which are different writes (a repair applies an already-computed
    // replacement; a reconcile rewrites a generated list) with their own
    // preconditions, and folding them into the position CAS would be wrong.
    // What must not come back is another POSITION writer written by hand, so
    // this asserts the delegation count instead of pretending the file has no
    // hand-written statements at all.
    expect(workoutSource.match(/UPDATE\s+workout_instances/gi) ?? []).toHaveLength(2);
    // Comments are stripped by `readCode`, so a comment that QUOTES the old
    // position statement is not mistaken for a statement.
  });

  it('routes every POSITION writer through the shared helper', () => {
    // One call per writer: the session advance (073 §1), the reroll, the
    // skip/jump transition (§3/§4), and the boot reconciliation (§5). A new
    // position writer must add its call here — that is what makes "every
    // writer shares one predicate" a property of the code rather than a
    // coincidence someone remembers to preserve.
    expect(workoutSource.match(/applyWorkoutPositionCas\(/g) ?? []).toHaveLength(4);
    // ...and every one selects from the CLOSED SET of SET clauses, so no
    // writer can invent its own predicate. `advance` is the session advance
    // plus the reconciliation (both only move the resume position).
    expect(workoutSource.match(/'advance'/g) ?? []).toHaveLength(2);
    expect(workoutSource.match(/'reroll'/g) ?? []).toHaveLength(1);
    expect(workoutSource.match(/'skipTo'/g) ?? []).toHaveLength(1);
  });
});

describe('leg-list validation on position writes (073 §1.3)', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = new WorkoutRepository(adapter, () => 1000);
  });

  it('refuses a reroll aimed at a row whose stored leg list is corrupt', async () => {
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });
    // `rowToInstance` deliberately FILTERS corrupt JSON so history stays
    // readable; a WRITE aimed at that row must see the corruption and refuse
    // instead of laundering a shorter list through the conditional update.
    await adapter.run('UPDATE workout_instances SET game_ids_json = ? WHERE date = ?', [
      '{not json',
      '2026-08-17',
    ]);
    await expect(workouts.applyReroll('2026-08-17', GAMES, 1)).rejects.toThrow(
      /corrupt game_ids_json/,
    );
    expect((await workouts.getByDate('2026-08-17'))?.rerollAttempt).toBe(0);
  });

  it('refuses a reroll aimed at an over-bound stored leg list', async () => {
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });
    const tooMany = Array.from({ length: MAX_WORKOUT_GAME_IDS + 1 }, (_, i) => `g${i}`);
    await adapter.run('UPDATE workout_instances SET game_ids_json = ? WHERE date = ?', [
      JSON.stringify(tooMany),
      '2026-08-17',
    ]);
    await expect(workouts.applyReroll('2026-08-17', GAMES, 1)).rejects.toThrow(/maximum is/);
  });

  it('refuses a malformed or over-bound INCOMING leg list', async () => {
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });
    await expect(workouts.applyReroll('2026-08-17', [], 1)).rejects.toThrow(/non-empty array/);
    await expect(workouts.applyReroll('2026-08-17', ['ok', ''], 1)).rejects.toThrow(
      /non-empty game id strings/,
    );
    const tooMany = Array.from({ length: MAX_WORKOUT_GAME_IDS + 1 }, (_, i) => `g${i}`);
    await expect(workouts.applyReroll('2026-08-17', tooMany, 1)).rejects.toThrow(/maximum is/);
    // No rejected attempt wrote anything.
    const after = await workouts.getByDate('2026-08-17');
    expect(after?.rerollAttempt).toBe(0);
    expect(after?.currentIndex).toBe(0);
    expect(after?.gameIds).toEqual(GAMES);
  });

  it('refuses a skip on a row whose stored leg list is not a list', async () => {
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });
    await adapter.run('UPDATE workout_instances SET game_ids_json = ? WHERE date = ?', [
      'null',
      '2026-08-17',
    ]);
    await expect(workouts.skipToLeg('2026-08-17', 1)).rejects.toThrow(/game list/);
    // The row is untouched: no position move, no skip recorded.
    const after = await workouts.getByDate('2026-08-17');
    expect(after?.currentIndex).toBe(0);
    expect(after?.skippedIndices).toEqual([]);
  });
});

describe('concurrent position writes (073 §1.4)', () => {
  it('applies at most one of two concurrent advances for the same leg', async () => {
    const adapter = await createMigratedDb();
    const workouts = new WorkoutRepository(adapter, () => 1000);
    await workouts.getOrCreate('2026-08-17', { gameIds: GAMES });
    const provenance = { instanceKey: '2026-08-17', legIndex: 0, gameId: GAMES[0] };

    const results = await Promise.allSettled([
      workouts.advanceForSession({ gameId: GAMES[0], workoutProvenance: provenance }),
      workouts.advanceForSession({ gameId: GAMES[0], workoutProvenance: provenance }),
    ]);

    const advances = results.filter(
      (result) => result.status === 'fulfilled' && result.value.advanced,
    ).length;
    // The loser is either refused by the connection's transaction scope (068's
    // documented contention narrowing) or loses the compare-and-set — it never
    // stacks a second move on top of the first.
    expect(advances).toBeLessThanOrEqual(1);
    const after = await workouts.getByDate('2026-08-17');
    expect(after?.currentIndex).toBe(advances === 1 ? 1 : 0);
  });
});
