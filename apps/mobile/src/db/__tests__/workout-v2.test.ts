/**
 * Workout Engine V2 — repository-level integration tests over a REAL
 * better-sqlite3 database (campaign 011 W07).
 *
 * Covers the V2 surface that had NO direct coverage before this suite:
 *   - `listHistory` / `listRecent` key ordering (daily-before-template within
 *     a day — the documented campaign-010 W22 contract),
 *   - `countCompleted` daily/template exclusion,
 *   - `findActiveInstanceForGame` advance routing across workout kinds,
 *   - `reconcileActiveInstances` batch repair (incl. completed-row immunity),
 *   - completion summaries matched against REAL persisted session records,
 *   - corrupt persisted rows (garbage JSON, drifted indexes) never crash,
 *   - the optional `metadata_json` column working BOTH ways (present via a
 *     simulated future migration, absent on today's schema v9).
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { createNodeSqliteAdapter } from '../adapters/node';
import { createMigratedDb } from './helpers';
import { initializeConnection, runMigrations } from '../migrate';
import { SessionRepository } from '../sessions';
import { WorkoutRepository } from '../workout';
import type { WorkoutInstance } from '../workout';
import type { GameSessionRecord } from '../types';
import {
  createWorkoutMetadata,
  type WorkoutMetadata,
} from '../../workout/metadata';

/** Mutable injectable clock shared by the repositories under test. */
const clock = { now: 10_000 };

function makeWorkouts(adapter: SQLiteAdapter): WorkoutRepository {
  return new WorkoutRepository(adapter, () => clock.now);
}

function makeSessions(adapter: SQLiteAdapter): SessionRepository {
  return new SessionRepository(adapter, () => clock.now);
}

async function persistSession(
  adapter: SQLiteAdapter,
  record: Partial<GameSessionRecord> & {
    id: string;
    gameId: string;
    completedAt: number;
  },
): Promise<void> {
  const sessions = makeSessions(adapter);
  await sessions.completeSession({
    session: {
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 42,
      difficulty: {},
      rawResult: {},
      normalizedResult: 0.5,
      xp: 10,
      startedAt: record.completedAt - 1_000,
      durationMs: 30_000,
      ...record,
    },
  });
}

/** Insert a raw workout row bypassing the repository (corrupt-state fixtures). */
async function insertRawRow(
  adapter: SQLiteAdapter,
  row: {
    date: string;
    game_ids_json: string;
    status?: string;
    current_index?: number;
    created_at?: number;
    updated_at?: number;
    metadata_json?: string;
  },
): Promise<void> {
  await adapter.run(
    `INSERT INTO workout_instances
       (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
    [
      row.date,
      row.game_ids_json,
      row.status ?? 'active',
      row.current_index ?? 0,
      row.created_at ?? 1000,
      row.updated_at ?? 1000,
    ],
  );
}

describe('V2 history ordering (listHistory / listRecent)', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = makeWorkouts(adapter);
    // Day 2 (newest): daily + one template. Day 1: daily + two templates.
    await workouts.getOrCreate('2026-08-20', { gameIds: ['a', 'b'] });
    await workouts.getOrCreate('2026-08-20::focus-memory::standard', {
      gameIds: ['a', 'b'],
    });
    await workouts.getOrCreate('2026-08-20::focus-logic::short', {
      gameIds: ['c', 'd'],
    });
    await workouts.getOrCreate('2026-08-21', { gameIds: ['e', 'f'] });
    await workouts.getOrCreate('2026-08-21::focus-memory::short', {
      gameIds: ['a', 'b'],
    });
  });

  it('orders newest day first and DAILY before its template rows within a day', async () => {
    // Documented campaign-010 W22 contract (also the module doc): within a day
    // the bare-date row sorts BEFORE its namespaced template rows.
    const keys = (await workouts.listHistory()).map((row) => row.date);
    expect(keys).toEqual([
      '2026-08-21',
      '2026-08-21::focus-memory::short',
      '2026-08-20',
      '2026-08-20::focus-logic::short',
      '2026-08-20::focus-memory::standard',
    ]);
  });

  it('listRecent delegates to the same ordering', async () => {
    const recent = await workouts.listRecent(30);
    expect(recent.map((row) => row.date)[0]).toBe('2026-08-21');
    expect(recent.map((row) => row.date)[1]).toBe(
      '2026-08-21::focus-memory::short',
    );
    expect(recent).toHaveLength(5);
  });

  it('honors from/to bounds; `to` includes same-day template keys exclusively', async () => {
    const day1 = await workouts.listHistory({ from: '2026-08-20', to: '2026-08-20' });
    expect(day1.map((row) => row.date)).toEqual([
      '2026-08-20',
      '2026-08-20::focus-logic::short',
      '2026-08-20::focus-memory::standard',
    ]);

    const sinceDay2 = await workouts.listHistory({ from: '2026-08-21' });
    expect(sinceDay2.map((row) => row.date)).toEqual([
      '2026-08-21',
      '2026-08-21::focus-memory::short',
    ]);
  });

  it('includeTemplates:false returns daily rows only; limit is respected', async () => {
    const dailyOnly = await workouts.listHistory({ includeTemplates: false });
    expect(dailyOnly.map((row) => row.date)).toEqual([
      '2026-08-21',
      '2026-08-20',
    ]);

    const capped = await workouts.listHistory({ limit: 2 });
    expect(capped.map((row) => row.date)).toEqual([
      '2026-08-21',
      '2026-08-21::focus-memory::short',
    ]);
  });

  it('countCompleted counts only fully-completed DAILY rows (templates excluded)', async () => {
    await workouts.advance('2026-08-20');
    await workouts.advance('2026-08-20'); // daily day-1 completed (2 games)
    await workouts.advance('2026-08-20::focus-memory::standard');
    await workouts.advance('2026-08-20::focus-memory::standard'); // template done too

    expect(await workouts.countCompleted()).toBe(1);

    await workouts.advance('2026-08-21');
    await workouts.advance('2026-08-21');
    expect(await workouts.countCompleted()).toBe(2);
  });
});

describe('V2 advance routing (findActiveInstanceForGame)', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = makeWorkouts(adapter);
    clock.now = 10_000;
    // Daily holds 'shared' first; after one advance its resume point is
    // 'daily-next' (updatedAt bumped to 15_000).
    await workouts.getOrCreate('2026-08-21', {
      gameIds: ['shared', 'daily-next'],
    });
    clock.now = 15_000;
    await workouts.advance('2026-08-21');
    // The newer template holds 'shared' as ITS current position too.
    clock.now = 20_000;
    await workouts.getOrCreate('2026-08-21::focus-memory::short', {
      gameIds: ['template-first', 'shared'],
    });
    await workouts.advance('2026-08-21::focus-memory::short'); // resume point -> 'shared'
  });

  it('routes a finished session to the MOST RECENTLY UPDATED matching active instance', async () => {
    const routed = await workouts.findActiveInstanceForGame('shared', 25_000);
    expect(routed?.date).toBe('2026-08-21::focus-memory::short');
  });

  it('falls back to the daily instance when only it matches', async () => {
    const routed = await workouts.findActiveInstanceForGame('daily-next', 25_000);
    expect(routed?.date).toBe('2026-08-21');
  });

  it('never routes a session that did not finish after the instance was touched', async () => {
    expect(
      await workouts.findActiveInstanceForGame('shared', 20_000),
    ).toBeNull(); // equal timestamps: strict > gate
    expect(await workouts.findActiveInstanceForGame('shared', 5_000)).toBeNull();
  });

  it('matches ONLY the current resume position (position rule)', async () => {
    // 'daily-next' sits at index 1 of the daily instance — a session for it
    // routes to the daily instance; but a session for an UNPLAYED template
    // slot ('template-first', already passed) must not route anywhere.
    expect(
      await workouts.findActiveInstanceForGame('template-first', 30_000),
    ).toBeNull();
  });

  it('never routes into completed instances', async () => {
    clock.now = 30_000;
    await workouts.advance('2026-08-21'); // completes the 2-game daily
    const routed = await workouts.findActiveInstanceForGame('daily-next', 35_000);
    expect(routed).toBeNull();
  });
});

describe('reconcileActiveInstances (batch catalog-drift repair)', () => {
  it('repairs mixed actives, deletes all-invalid rows, leaves completed history untouched', async () => {
    const adapter = await createMigratedDb();
    const workouts = makeWorkouts(adapter);

    // Active #1: one retired id mid-list (repairable).
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['live-a', 'ghost-x', 'live-b'],
    });
    // Active #2: every id retired (must be deleted so it regenerates).
    await workouts.getOrCreate('2026-08-20::focus-memory::short', {
      gameIds: ['ghost-1', 'ghost-2'],
    });
    // Completed historical row containing retired ids: NEVER rewritten.
    await insertRawRow(adapter, {
      date: '2026-08-19',
      game_ids_json: JSON.stringify(['ghost-old', 'also-dead']),
      status: 'completed',
      current_index: 2,
    });

    const repaired = await workouts.reconcileActiveInstances(
      new Set(['live-a', 'live-b']),
    );

    expect(repaired.map((row) => row.date)).toEqual(['2026-08-20']);
    expect(repaired[0].gameIds).toEqual(['live-a', 'live-b']);
    expect(repaired[0].currentIndex).toBe(0);

    // All-invalid ACTIVE row dropped; COMPLETED row survives verbatim.
    expect(await workouts.getByDate('2026-08-20::focus-memory::short')).toBeNull();
    const history = await workouts.getByDate('2026-08-19');
    expect(history?.status).toBe('completed');
    expect(history?.gameIds).toEqual(['ghost-old', 'also-dead']);

    // Second sweep is a no-op (idempotent).
    const again = await workouts.reconcileActiveInstances(
      new Set(['live-a', 'live-b']),
    );
    expect(again.map((row) => row.date)).toEqual(['2026-08-20']);
    expect(again[0].gameIds).toEqual(['live-a', 'live-b']);
  });

  it('advances the resume point past an invalidated CURRENT game', async () => {
    const adapter = await createMigratedDb();
    const workouts = makeWorkouts(adapter);
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['done', 'ghost-cur', 'after'],
    });
    await workouts.advance('2026-08-20'); // resume point now on ghost-cur

    const [fixed] = await workouts.reconcileActiveInstances(
      new Set(['done', 'after']),
    );
    expect(fixed.gameIds).toEqual(['done', 'after']);
    expect(fixed.currentIndex).toBe(1); // lands on 'after'
    expect(fixed.status).toBe('active');

    const persisted = await workouts.getByDate('2026-08-20');
    expect(persisted?.currentIndex).toBe(1);
  });

  it('duplicate game ids in a stored row collapse to distinct positions', async () => {
    const adapter = await createMigratedDb();
    const workouts = makeWorkouts(adapter);
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['dup-a', 'b', 'dup-a'],
    });

    const [fixed] = await workouts.reconcileActiveInstances(
      new Set(['dup-a', 'b']),
    );
    expect(fixed.gameIds).toEqual(['dup-a', 'b']); // later duplicate dropped
    expect(new Set(fixed.gameIds).size).toBe(fixed.gameIds.length);
  });
});

describe('corrupt persisted rows never crash reads or writes', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = makeWorkouts(adapter);
  });

  it('garbage game_ids_json loads as an empty selection and advances safely', async () => {
    await insertRawRow(adapter, { date: '2026-08-20', game_ids_json: 'NOT_JSON{{[' });

    const loaded = await workouts.getByDate('2026-08-20');
    expect(loaded?.gameIds).toEqual([]);

    // Advancing an exhausted/empty list clamps and completes — never throws.
    const advanced = await workouts.advance('2026-08-20');
    expect(advanced.currentIndex).toBe(0);
    expect(advanced.status).toBe('completed');
  });

  it('drifted negative and overflowing current_index are contained', async () => {
    await insertRawRow(adapter, {
      date: '2026-08-20',
      game_ids_json: JSON.stringify(['a', 'b']),
      current_index: -7,
    });
    await insertRawRow(adapter, {
      date: '2026-08-20::t::short',
      game_ids_json: JSON.stringify(['a', 'b']),
      current_index: 99,
    });

    // Reconciliation repairs both in place (negative -> first position;
    // overflow -> exhausted/completed) and persists the repair.
    const repaired = await workouts.reconcileActiveInstances(new Set(['a', 'b']));
    const byKey = new Map(repaired.map((row) => [row.date, row]));
    expect(byKey.get('2026-08-20')?.currentIndex).toBe(0);
    expect(byKey.get('2026-08-20')?.status).toBe('active');
    expect(byKey.get('2026-08-20::t::short')?.currentIndex).toBe(2);
    expect(byKey.get('2026-08-20::t::short')?.status).toBe('completed');
  });

  it('double advance calls move the index by exactly two and stay terminal afterwards', async () => {
    // Repository-level semantic pin: each advance represents ONE durably
    // completed session. Exactly-once delivery is enforced upstream by the
    // result-screen guards (advance.test.ts / lifecycle tests); here we pin
    // that repeated calls can neither skip past the end nor un-complete.
    await workouts.getOrCreate('2026-08-20', { gameIds: ['a', 'b', 'c'] });
    await workouts.advance('2026-08-20');
    await workouts.advance('2026-08-20');
    expect((await workouts.getByDate('2026-08-20'))?.currentIndex).toBe(2);

    const last = await workouts.advance('2026-08-20');
    expect(last.status).toBe('completed');
    const extra = await workouts.advance('2026-08-20'); // duplicate tap post-completion
    expect(extra.currentIndex).toBe(3);
    expect(extra.status).toBe('completed');
    expect(await workouts.countCompleted()).toBe(1);
  });

  it('throws for advance/reroll on an unknown key', async () => {
    await expect(workouts.advance('2099-01-01')).rejects.toThrow(/No workout instance/);
    await expect(workouts.applyReroll('2099-01-01', ['a'], 1)).rejects.toThrow(
      /No workout instance/,
    );
  });
});

describe('metadata_json column (shipped schema v10) + legacy tolerance', () => {
  const sampleMetadata: WorkoutMetadata = {
    ...createWorkoutMetadata({
      kind: 'template',
      templateId: 'focus-memory',
      length: 'extended',
      focus: 'Memory',
    }),
    inputs: {
      domainRatings: { Memory: 950 },
      recentGameIds: ['memory-prospective-cue'],
      seed: 'workout::2026-08-21::focus-memory::extended::0',
    },
  };

  it('persists metadata natively on the shipped schema (v10 migration provides the column)', async () => {
    const adapter = await createMigratedDb(); // schema v10: column present
    const workouts = makeWorkouts(adapter);
    const key = '2026-08-21::focus-memory::extended';
    const created = await workouts.getOrCreate(
      key,
      { gameIds: ['a'], seedVersion: 2 },
      sampleMetadata,
    );
    expect(created.metadata).toEqual(sampleMetadata);
    const reread = await workouts.getByDate(key);
    expect(reread?.metadata).toEqual(sampleMetadata);
    expect(reread?.gameIds).toEqual(['a']);
  });

  it('round-trips versioned metadata and tolerates legacy/malformed rows', async () => {
    const adapter = await createMigratedDb();
    const workouts = makeWorkouts(adapter); // fresh instance detects the column

    const key = '2026-08-21::focus-memory::extended';
    await workouts.getOrCreate(key, { gameIds: ['a'], seedVersion: 2 }, sampleMetadata);
    const reread = await workouts.getByDate(key);
    expect(reread?.metadata).toEqual(sampleMetadata);
    expect(reread?.metadata?.inputs).toEqual(sampleMetadata.inputs);

    // Legacy rows written before the column existed load with no metadata.
    await adapter.run(
      `INSERT INTO workout_instances
         (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at)
       VALUES ('2026-08-20', '["x"]', 'active', 0, 0, 1, 1, 1)`,
    );
    const legacy = await workouts.getByDate('2026-08-20');
    expect(legacy?.metadata).toBeUndefined();

    // Corrupt metadata JSON degrades to undefined instead of crashing reads.
    await adapter.run(
      "UPDATE workout_instances SET metadata_json = '{oops' WHERE date = ?",
      [key],
    );
    expect((await workouts.getByDate(key))?.metadata).toBeUndefined();
  });
});

describe('completion summaries against REAL persisted sessions', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = makeWorkouts(adapter);
    clock.now = 1_000_000;
  });

  it('matches the most-recent post-creation session per played position and ignores the rest', async () => {
    const key = '2026-08-21';
    const created = await workouts.getOrCreate(key, {
      gameIds: ['g-a', 'g-b', 'g-c'],
    });
    expect(created).not.toBeNull();

    // Sessions around the instance:
    //  - g-a BEFORE creation (yesterday's play): must never leak in,
    //  - two g-a sessions AFTER creation: most recent wins,
    //  - g-c session exists but c is UNPLAYED: must not count,
    //  - g-z session for a foreign game: ignored.
    await persistSession(adapter, { id: 's-pre', gameId: 'g-a', completedAt: 900_000, xp: 1 });
    await persistSession(adapter, { id: 's-a1', gameId: 'g-a', completedAt: 1_100_000, xp: 7, normalizedResult: 0.4 });
    await persistSession(adapter, { id: 's-b1', gameId: 'g-b', completedAt: 1_200_000, xp: 5, normalizedResult: 0.8, durationMs: 45_000 });
    await persistSession(adapter, { id: 's-a2', gameId: 'g-a', completedAt: 1_300_000, xp: 9, normalizedResult: 0.6 });
    await persistSession(adapter, { id: 's-c1', gameId: 'g-c', completedAt: 1_400_000, xp: 99 });
    await persistSession(adapter, { id: 's-z1', gameId: 'g-z', completedAt: 1_450_000, xp: 50 });

    clock.now = 1_500_000;
    await workouts.advance(key); // g-a done
    clock.now = 1_600_000;
    await workouts.advance(key); // g-b done

    const summary = await workouts.getWorkoutSummary(key);
    expect(summary).not.toBeNull();
    expect(summary!.key).toBe(key);
    expect(summary!.date).toBe('2026-08-21');
    expect(summary!.totalGames).toBe(3);
    expect(summary!.completedGames).toBe(2);
    expect(summary!.completionRatio).toBeCloseTo(2 / 3);
    expect(summary!.status).toBe('active');

    const posA = summary!.outcomes[0];
    const posB = summary!.outcomes[1];
    const posC = summary!.outcomes[2];
    expect(posA.played).toBe(true);
    expect(posA.session?.completedAt).toBe(1_300_000); // the LATEST g-a session
    expect(posA.session?.xp).toBe(9);
    expect(posB.played).toBe(true);
    expect(posB.session?.completedAt).toBe(1_200_000);
    expect(posC.played).toBe(false);
    expect(posC.session).toBeNull();

    // Totals cover ONLY matched sessions: xp 9+5=14, duration 30k+45k=75k.
    expect(summary!.totalXp).toBe(14);
    expect(summary!.totalDurationMs).toBe(75_000);
    expect(summary!.avgNormalized).toBeCloseTo((0.6 + 0.8) / 2);
    expect(summary!.finishedAt).toBe(1_300_000);
  });

  it('the same physical session may back two instances sharing the game (accepted)', async () => {
    await workouts.getOrCreate('2026-08-21', { gameIds: ['shared', 'other'] });
    await workouts.getOrCreate('2026-08-21::focus-memory::short', {
      gameIds: ['shared'],
    });
    await persistSession(adapter, {
      id: 's-shared',
      gameId: 'shared',
      completedAt: 1_100_000,
      xp: 12,
    });
    clock.now = 1_200_000;
    await workouts.advance('2026-08-21');
    await workouts.advance('2026-08-21::focus-memory::short'); // completes it

    const daily = await workouts.getWorkoutSummary('2026-08-21');
    const template = await workouts.getWorkoutSummary(
      '2026-08-21::focus-memory::short',
    );
    expect(daily?.outcomes[0].session?.completedAt).toBe(1_100_000);
    expect(template?.outcomes[0].session?.completedAt).toBe(1_100_000);
    expect(daily?.totalXp).toBe(12);
    expect(template?.status).toBe('completed');
    expect(template?.completionRatio).toBe(1);
    // Template completions do NOT inflate the daily-only counter.
    expect(await workouts.countCompleted()).toBe(0);
  });

  it('listRecentSummaries agrees with per-key getWorkoutSummary (batched read model)', async () => {
    await workouts.getOrCreate('2026-08-21', { gameIds: ['g-a', 'g-b'] });
    await workouts.getOrCreate('2026-08-20::focus-memory::short', {
      gameIds: ['g-a'],
    });
    await persistSession(adapter, { id: 's1', gameId: 'g-a', completedAt: 1_100_000, xp: 4 });
    clock.now = 1_200_000;
    await workouts.advance('2026-08-21');

    const batched = await workouts.listRecentSummaries(14);
    expect(batched).toHaveLength(2);
    for (const summary of batched) {
      const single = await workouts.getWorkoutSummary(summary.key);
      expect(summary).toEqual(single);
    }
    // Newest-first: today's daily row precedes yesterday's template row.
    expect(batched[0].key).toBe('2026-08-21');
    expect(batched[1].key).toBe('2026-08-20::focus-memory::short');
  });

  it('an empty-workout summary reports zero progress without NaN', async () => {
    await insertRawRow(adapter, {
      date: '2026-08-21',
      game_ids_json: JSON.stringify([]),
    });
    const summary = await workouts.getWorkoutSummary('2026-08-21');
    expect(summary?.totalGames).toBe(0);
    expect(summary?.completedGames).toBe(0);
    expect(summary?.completionRatio).toBe(0);
    expect(summary?.avgNormalized).toBeNull();
    expect(summary?.finishedAt).toBeNull();
    expect(summary?.outcomes).toEqual([]);
  });

  it('returns null for an unknown key and null reasons by default', async () => {
    expect(await workouts.getWorkoutSummary('2999-01-01')).toBeNull();
    await workouts.getOrCreate('2026-08-21', { gameIds: ['g-a'] });
    const summary = await workouts.getWorkoutSummary('2026-08-21');
    expect(summary?.reasons).toBeNull();
    expect(summary?.metadata).toBeNull();
  });
});
