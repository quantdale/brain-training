/**
 * Campaign 013 hardening — old/corrupt backup envelopes vs. the current
 * (schema v10 / engine 3) database.
 *
 * Proves the restore path stays backward- and forward-compatible around the
 * Workout V2 `metadata` field:
 *
 * - PRE-engine-3 envelopes (no `engineVersion`, no `manifest`, workout rows
 *   WITHOUT a `metadata` field — everything campaign 010/011 shipped) restore
 *   cleanly onto the current schema via merge AND replace; restored legacy
 *   rows land with a NULL `metadata_json` cell (never fabricated provenance);
 * - UNKNOWN extra fields (future envelope keys, future per-workout keys) are
 *   tolerated — additive format evolution never bricks old readers;
 * - a wrong-shaped `metadata` value inside a workout entry is rejected
 *   EXPLICITLY at validation time (BackupDataValidationError), before any
 *   mutation;
 * - corrupt envelopes (truncated text, tampered payloads) are rejected with
 *   typed errors, never half-applied.
 */

import { describe, expect, it } from '@jest/globals';
import type { AppDatabase } from '@/db';
import {
  applyImport,
  canonicalString,
  computeChecksum,
  parseAndValidateBackup,
  serializeBackup,
  BackupDataValidationError,
  ChecksumMismatchError,
  MalformedBackupError,
} from '../index';
import type { BackupEnvelope } from '../index';
import { buildEnvelope, emptyData, makeDb, seedFixture, T0 } from './helpers';

/** One pre-v3-engine workout row: NO `metadata` field at all. */
function legacyWorkoutRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    date: '2026-08-20',
    gameIds: ['memory', 'speed-tap-rush'],
    status: 'completed',
    currentIndex: 1,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

/** Old-style snapshot: every section present, workouts without metadata. */
function oldFormatData(workouts: readonly Record<string, unknown>[]): Record<string, unknown> {
  return {
    ...emptyData(),
    schemaVersion: 9, // provenance: exported from a pre-v10 database
    profile: {
      id: 'local',
      displayName: 'Ada',
      settings: { theme: 'dark' },
      createdAt: T0,
      updatedAt: T0,
    },
    gameSessions: [
      {
        id: 's-old',
        gameId: 'memory',
        gameVersion: 1,
        generatorVersion: 1,
        scoringVersion: 1,
        seed: 42,
        difficulty: { level: 'easy' },
        rawResult: { correct: 5 },
        normalizedResult: 0.9,
        xp: 50,
        startedAt: T0,
        completedAt: T0 + 100,
        durationMs: 1000,
      },
    ],
    workoutInstances: [...workouts],
    // One gameplay ledger row so the replace path also proves append-only
    // enforcement survives the clear/restore (the BEFORE trigger only fires
    // when a row actually matches).
    currencyLedger: [
      {
        amount: 10,
        reason: 'gameplay',
        sessionId: 's-old',
        createdAt: T0 + 200,
        operationId: 'op-old-1',
      },
    ],
  };
}

async function workoutRows(db: AppDatabase): Promise<
  { date: string; metadata_json: string | null }[]
> {
  return db.transaction(async (txn) =>
    txn.all<{ date: string; metadata_json: string | null }>(
      'SELECT date, metadata_json FROM workout_instances ORDER BY date ASC',
    ),
  );
}

describe('old backup envelopes (pre-workout-metadata) restore onto the current schema', () => {
  it('merge-restores cleanly; the legacy row lands with NULL metadata_json', async () => {
    const envelope = buildEnvelope(oldFormatData([legacyWorkoutRow()]), {
      schemaVersion: 9,
    });
    expect(envelope.engineVersion).toBeUndefined(); // genuinely old shape
    expect(envelope.manifest).toBeUndefined();

    const parsed = parseAndValidateBackup(serializeBackup(envelope));
    expect(parsed.data.workoutInstances[0].metadata).toBeUndefined();

    const target = await makeDb();
    const result = await applyImport(target, parsed, 'merge');
    expect(result.workoutsUpdated).toBe(1);

    const rows = await workoutRows(target);
    expect(rows.find((r) => r.date === '2026-08-20')).toEqual({
      date: '2026-08-20',
      metadata_json: null, // no provenance fabricated for legacy rows
    });

    // And the row reads back as a plain metadata-less instance through a raw
    // projection (AppDatabase exposes transactions, not its adapter).
    const readBack = await target.transaction(async (txn) =>
      txn.get<{ game_ids_json: string; metadata_json: string | null }>(
        'SELECT game_ids_json, metadata_json FROM workout_instances WHERE date = ?',
        ['2026-08-20'],
      ),
    );
    expect(readBack?.game_ids_json).toBe('["memory","speed-tap-rush"]');
    expect(readBack?.metadata_json).toBeNull();
  });

  it('replace-restores cleanly through the trigger-drop clear path', async () => {
    const src = await makeDb();
    await seedFixture(src); // target has data that replace must clear first

    const envelope = buildEnvelope(
      oldFormatData([
        legacyWorkoutRow(),
        legacyWorkoutRow({
          date: '2026-08-19',
          status: 'active',
          currentIndex: 0,
          updatedAt: T0 - 1000,
          createdAt: T0 - 1000,
        }),
      ]),
      { schemaVersion: 9 },
    );
    const parsed = parseAndValidateBackup(serializeBackup(envelope));

    const target = await makeDb();
    await applyImport(target, parsed, 'replace');

    const rows = await workoutRows(target);
    expect(rows.map((r) => r.date)).toEqual(['2026-08-19', '2026-08-20']);
    expect(rows.every((r) => r.metadata_json === null)).toBe(true);

    // Sessions survived too, and append-only triggers were re-created after
    // the replace clear.
    const sessions = await target.transaction(async (txn) =>
      txn.all<{ id: string }>('SELECT id FROM game_sessions'),
    );
    expect(sessions.map((s) => s.id)).toEqual(['s-old']);
    await expect(
      target.transaction(async (txn) =>
        txn.run("UPDATE currency_ledger SET amount = 99 WHERE operation_id = 'op-old-1'"),
      ),
    ).rejects.toThrow(/append-only/);
  });
});

describe('unknown/future fields are tolerated (additive format evolution)', () => {
  it('accepts an old-format envelope carrying unknown top-level AND per-workout keys', () => {
    const envelope: BackupEnvelope = buildEnvelope(
      oldFormatData([
        legacyWorkoutRow({ futureField: { anything: true }, reasonsV2: 'not-yet' }),
      ]),
      { schemaVersion: 9 },
    );

    // Add unknown ENVELOPE-level keys, then re-sign so only the tolerance gate
    // is exercised (checksum still authentic).
    const payload: Record<string, unknown> = { ...envelope, engineNote: 'legacy-writer' };
    delete payload.checksum;
    const signed = {
      ...payload,
      checksum: computeChecksum(canonicalString(payload)),
    };

    const parsed = parseAndValidateBackup(JSON.stringify(signed));
    expect(parsed.envelope.version).toBe(1);
    expect(parsed.data.workoutInstances).toHaveLength(1);
    expect(parsed.data.workoutInstances[0].date).toBe('2026-08-20');
  });
});

describe('wrong-shaped workout metadata is rejected explicitly before any mutation', () => {
  it('rejects metadata as a string / number with BackupDataValidationError', () => {
    for (const badMetadata of ['oops', 42, [1, 2]]) {
      const envelope = buildEnvelope(
        oldFormatData([legacyWorkoutRow({ metadata: badMetadata })]),
        { schemaVersion: 10 },
      );
      let error: unknown;
      try {
        parseAndValidateBackup(serializeBackup(envelope));
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(BackupDataValidationError);
      expect((error as BackupDataValidationError).issues.join('; ')).toContain(
        'workoutInstances contains an invalid entry',
      );
    }
  });

  it('still accepts object-or-null metadata (the valid shapes)', () => {
    const envelope = buildEnvelope(
      oldFormatData([
        legacyWorkoutRow({
          metadata: { version: 1, kind: 'daily', templateId: 'daily-mix', length: 'standard' },
        }),
        legacyWorkoutRow({ date: '2026-08-21', metadata: null }),
      ]),
      { schemaVersion: 10 },
    );
    const parsed = parseAndValidateBackup(serializeBackup(envelope));
    expect(parsed.data.workoutInstances[0].metadata).toMatchObject({
      templateId: 'daily-mix',
    });
    expect(parsed.data.workoutInstances[1].metadata ?? null).toBeNull();
  });
});

describe('corrupt envelopes are rejected explicitly, never half-applied', () => {
  it('a truncated envelope fails as MalformedBackupError', () => {
    const envelope = buildEnvelope(oldFormatData([legacyWorkoutRow()]));
    const text = serializeBackup(envelope);
    expect(() => parseAndValidateBackup(text.slice(0, Math.floor(text.length / 2)))).toThrow(
      MalformedBackupError,
    );
  });

  it('a tampered payload fails as ChecksumMismatchError', () => {
    const envelope = buildEnvelope(oldFormatData([legacyWorkoutRow()]));
    const tampered = serializeBackup(envelope).replace('"Ada"', '"Mallory"');
    expect(() => parseAndValidateBackup(tampered)).toThrow(ChecksumMismatchError);
  });
});
