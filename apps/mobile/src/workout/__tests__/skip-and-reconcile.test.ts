/**
 * Change 073 §3/§5 — skip policy, the skip writer, and boot reconciliation.
 *
 * The properties under test are the ones a wrong implementation would quietly
 * violate: a skipped leg must never read as completed, must never award
 * anything, and must never let a workout complete with zero play; and the
 * boot reconciliation must repair a lagged position without ever advancing
 * past work the player still owes.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { AppDatabase, reconcileWorkoutPositions } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { registerGameDefinitions } from '@/registry/registry';
import type { GameDefinition } from '@/sdk';
import {
  canSkipLeg,
  skipUnavailableReason,
  skipsRemaining,
} from '@/workout/skip';
import type { WorkoutSessionProvenance } from '@/workout/session-provenance';

const T0 = 1_700_000_000_000;
const KEY = '2026-09-30';
const GAMES = ['g-a', 'g-b', 'g-c', 'g-d'];

function definition(id: string): GameDefinition {
  return {
    id,
    name: id,
    primaryCategory: 'Memory',
    description: 'probe',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    contentVersion: null,
    hasTutorial: true,
  };
}

async function makeDb(): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

/** Persist the session whose STORED provenance owns `provenance` (073 §2). */
async function persistOwnedSession(
  db: AppDatabase,
  provenance: WorkoutSessionProvenance,
  sessionId = `s-${provenance.legIndex}-${provenance.gameId}`,
  xp = 7,
): Promise<void> {
  await db.sessions.completeSession({
    session: {
      id: sessionId,
      gameId: provenance.gameId,
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 1,
      difficulty: { level: 'normal' },
      rawResult: { probe: true },
      normalizedResult: 0.5,
      xp,
      startedAt: T0,
      completedAt: T0 + 1,
      durationMs: 1,
      workoutProvenance: provenance,
    },
  });
}

beforeEach(() => {
  registerGameDefinitions(GAMES.map(definition));
});

describe('skip policy (073 D4)', () => {
  it('allows skipping every leg except the last one', () => {
    const base = {
      date: KEY,
      gameIds: GAMES,
      status: 'active' as const,
      currentIndex: 0,
      rerollAttempt: 0,
      seedVersion: 1,
      createdAt: T0,
      updatedAt: T0,
      skippedIndices: [],
    };
    // Allowance is length - 1: a completed workout must contain at least one
    // PLAYED leg, or the workout-completions achievements would be farmable
    // with zero play.
    expect(skipsRemaining(base)).toBe(3);
    expect(canSkipLeg(base)).toBe(true);

    const mid = { ...base, currentIndex: 2, skippedIndices: [0, 1] };
    expect(skipsRemaining(mid)).toBe(1);
    expect(canSkipLeg(mid)).toBe(true);

    // The final leg can never be consumed by a skip.
    const last = { ...base, currentIndex: 3, skippedIndices: [0, 1, 2] };
    expect(canSkipLeg(last)).toBe(false);
    expect(skipUnavailableReason(last)).toBe(
      'Play the last game to finish this workout',
    );
  });

  it('states the boundary instead of hiding the control', () => {
    const base = {
      date: KEY,
      gameIds: GAMES,
      status: 'active' as const,
      currentIndex: 0,
      rerollAttempt: 0,
      seedVersion: 1,
      createdAt: T0,
      updatedAt: T0,
      skippedIndices: [],
    };
    // A one-leg workout has nothing to skip, and the reason is stated.
    expect(canSkipLeg({ ...base, gameIds: ['only'] })).toBe(false);
    // A finished workout is never skippable.
    expect(skipUnavailableReason({ ...base, status: 'completed' })).toBe(
      'This workout is already finished',
    );
    // The happy path is silent: availability needs no reason.
    expect(skipUnavailableReason(base)).toBeNull();
  });
});

describe('skipToLeg (073 §3/§4)', () => {
  it('records the skipped legs, moves the position, and awards nothing', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    const ledgerBefore = await db.ledger.getBalance();
    const updated = await db.workouts.skipToLeg(KEY, 1);
    expect(updated?.skippedIndices).toEqual([0]);
    expect(updated?.currentIndex).toBe(1);
    expect(updated?.status).toBe('active');

    // A skip is reward-free by construction: no session, no XP, no coins.
    expect(await db.ledger.getBalance()).toBe(ledgerBefore);
    expect(await db.sessions.getCount()).toBe(0);
  });

  it('jumps over a prefix in one write, recording every skipped leg', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    const updated = await db.workouts.skipToLeg(KEY, 3);
    // The prefix is recorded as skipped — never as completed — and the jump
    // lands on the final leg, which must then be played.
    expect(updated?.skippedIndices).toEqual([0, 1, 2]);
    expect(updated?.currentIndex).toBe(3);
    expect(canSkipLeg(updated!)).toBe(false);
  });

  it('refuses to skip the final leg and to rewrite a completed workout', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    // Consuming the final leg would complete a workout with zero play.
    await expect(db.workouts.skipToLeg(KEY, 4)).rejects.toThrow(/not a skippable leg/);
    // Backwards and non-integer targets are equally invalid.
    await expect(db.workouts.skipToLeg(KEY, 0)).rejects.toThrow(/not a skippable leg/);

    // Finish the plan the ordinary way: the last leg is PLAYED, never skipped.
    await db.workouts.skipToLeg(KEY, 3);
    await db.workouts.advanceForSession({
      gameId: GAMES[3],
      workoutProvenance: { instanceKey: KEY, legIndex: 3, gameId: GAMES[3] },
    });
    const finished = await db.workouts.getByDate(KEY);
    expect(finished?.status).toBe('completed');
    expect(finished?.skippedIndices).toEqual([0, 1, 2]);

    // A completed workout is historical record: its legs are never
    // re-decided as skipped after the fact.
    const historical = await db.workouts.skipToLeg(KEY, 3);
    expect(historical?.skippedIndices).toEqual([0, 1, 2]);
    expect(historical?.status).toBe('completed');
  });

  it('keeps the played prefix byte-identical through the shared CAS', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 0, gameId: GAMES[0] });

    const updated = await db.workouts.skipToLeg(KEY, 2);
    expect(updated?.skippedIndices).toEqual([1]);
    // Leg 0 was PLAYED: it is not in the skip record even though the jump
    // moved the position past it.
    expect(updated?.skippedIndices).not.toContain(0);
  });

  it('073: a crafted skip record naming the final leg cannot complete a workout with zero play', async () => {
    // Regression for the achievement-farm path: the writer enforces
    // `length − 1`, but a backup row can carry a record the writer never
    // would. Without the reader-side rule, boot reconciliation settles over
    // the whole list (all legs "skipped"), flips status to completed, and
    // countCompleted counts it toward the workout-completion achievement with
    // no session at all.
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    await db.transaction(async (txn) => {
      await txn.run(
        "UPDATE workout_instances SET skipped_indices_json = ?, current_index = ? WHERE date = ?",
        // The attack shape: every leg (final included) marked skipped and the
        // resume point left on the final leg, so the boot walk would settle the
        // whole list and flip the row to completed with zero sessions.
        [JSON.stringify([0, 1, 2, 3]), 3, KEY],
      );
    });

    // The reader drops the final-leg entry: legs 0-2 are skipped, leg 3 is
    // still owed, so the workout cannot complete without playing it.
    await reconcileWorkoutPositions(
      (db as unknown as { adapter: Parameters<typeof reconcileWorkoutPositions>[0] }).adapter,
    );
    const row = await db.workouts.getByDate(KEY);
    expect(row?.skippedIndices).toEqual([0, 1, 2]);
    expect(row?.status).toBe('active');
    expect(row?.currentIndex).toBe(3);
    expect(await db.workouts.countCompleted()).toBe(0);
  });
});

describe('reconcileWorkoutPositions (073 §5)', () => {
  it('advances the position over legs a persisted session proves were played', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    // The exact kill window: the session committed but its one-shot leg
    // advance never ran, so the position still says leg 0.
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 0, gameId: GAMES[0] });
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 1, gameId: GAMES[1] });

    const repaired = await reconcileWorkoutPositions(
      // The janitor works from the bare adapter, like `deleteEmptyWorkoutInstances`.
      (db as unknown as { adapter: Parameters<typeof reconcileWorkoutPositions>[0] }).adapter,
    );
    expect(repaired).toBe(1);
    const after = await db.workouts.getByDate(KEY);
    expect(after?.currentIndex).toBe(2);
    expect(after?.status).toBe('active');
  });

  it('never advances past unfinished work and is idempotent and reward-free', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    const adapter = (db as unknown as { adapter: Parameters<typeof reconcileWorkoutPositions>[0] })
      .adapter;

    // A session for a LATER leg exists, but leg 0 has neither a session nor a
    // skip record: the player still owes leg 0, so the position must not move.
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 2, gameId: GAMES[2] });
    const ledgerBefore = await db.ledger.getBalance();

    expect(await reconcileWorkoutPositions(adapter)).toBe(0);
    expect((await db.workouts.getByDate(KEY))?.currentIndex).toBe(0);

    // Idempotent: a second pass changes nothing.
    expect(await reconcileWorkoutPositions(adapter)).toBe(0);
    // Reward-free: reconciliation moves positions, never currency or XP.
    expect(await db.ledger.getBalance()).toBe(ledgerBefore);
  });

  it('settles over skipped legs too and completes at the end', async () => {
    const db = await makeDb();
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    const adapter = (db as unknown as { adapter: Parameters<typeof reconcileWorkoutPositions>[0] })
      .adapter;

    // Two skipped legs, then the tail played — with the final advance lost to
    // the kill window, so the row still says 'active' at index 2.
    await db.workouts.skipToLeg(KEY, 1);
    await db.workouts.skipToLeg(KEY, 2);
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 2, gameId: GAMES[2] });
    await persistOwnedSession(db, { instanceKey: KEY, legIndex: 3, gameId: GAMES[3] });

    expect((await db.workouts.getByDate(KEY))?.currentIndex).toBe(2);
    // The walk settles 2 (played) then 3 (played) and completes the plan.
    expect(await reconcileWorkoutPositions(adapter)).toBe(1);
    const after = await db.workouts.getByDate(KEY);
    expect(after?.currentIndex).toBe(4);
    expect(after?.status).toBe('completed');
    // Skips stay skips; played legs are never recorded as skipped.
    expect(after?.skippedIndices).toEqual([0, 1]);
  });
});
