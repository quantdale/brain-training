import { describe, expect, it } from '@jest/globals';
import { AppDatabase } from '@/db';
import { exportLocalData, serializeBackup, parseAndValidateBackup, applyImport } from '../index';
import { canonicalString } from '../canonical-json';
import { computeChecksum } from '../checksum';
import { makeDb, seedFixture, T0 } from './helpers';

async function exportCanonical(db: AppDatabase): Promise<string> {
  const env = await exportLocalData(db, { now: () => T0 + 1, appVersion: 'test-1.0.0' });
  const parsed = parseAndValidateBackup(serializeBackup(env));
  return canonicalString(parsed.data);
}

describe('export → import round trip', () => {
  it('restores an identical data snapshot via replace', async () => {
    const src = await makeDb();
    await seedFixture(src);

    const sourceData = await exportCanonical(src);

    const target = await makeDb();
    const env = await exportLocalData(src, { now: () => T0 + 1, appVersion: 'test-1.0.0' });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    const result = await applyImport(target, parsed, 'replace');

    expect(result.sessionsAdded).toBe(2);
    expect(result.ledgerAdded).toBe(2);
    expect(result.totalWritten).toBeGreaterThan(0);

    const restoredData = await exportCanonical(target);
    expect(restoredData).toBe(sourceData);
  });

  it('restores an identical data snapshot via merge into empty', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const sourceData = await exportCanonical(src);

    const target = await makeDb();
    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    await applyImport(target, parsed, 'merge');

    expect(await exportCanonical(target)).toBe(sourceData);
  });

  it('preserves raw completed-session history (difficulty + rawResult JSON)', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    const session = parsed.data.gameSessions.find((s) => s.id === 's1')!;
    expect(session.difficulty).toEqual({ level: 'easy' });
    expect(session.rawResult).toEqual({ correct: 5 });
    expect(session.normalizedResult).toBe(0.9);
  });

  it('round-trips workout session ownership embedded in rawResult JSON', async () => {
    const src = await makeDb();
    const provenance = {
      instanceKey: '2026-08-28::focus-memory::short',
      legIndex: 1,
      gameId: 'memory-grid-recall',
    };
    await src.transaction(async (txn) => {
      await txn.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'owned-session',
          provenance.gameId,
          1,
          1,
          1,
          7,
          '{}',
          JSON.stringify({ score: 8, workoutProvenance: provenance }),
          0.8,
          20,
          T0,
          T0 + 100,
          100,
        ],
      );
    });

    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    expect(
      (parsed.data.gameSessions.find((s) => s.id === 'owned-session')?.rawResult as Record<string, unknown>)
        .workoutProvenance,
    ).toEqual(provenance);

    const target = await makeDb();
    await applyImport(target, parsed, 'replace');
    expect((await target.sessions.getById('owned-session'))?.workoutProvenance).toEqual(
      provenance,
    );
  });

  it('round-trips workout instance metadata (Workout V2 reasons/provenance) through export + replace import', async () => {
    // Seed a template instance WITH metadata (as the engine writes it on
    // schema v10) and one legacy row without any.
    const src = await makeDb();
    await src.transaction(async (txn) => {
      await txn.run(
        "INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          '2026-08-21::focus-memory::extended',
          JSON.stringify(['memory', 'speed-tap-rush']),
          'completed',
          2,
          0,
          2,
          T0,
          T0,
          JSON.stringify({
            version: 1,
            kind: 'template',
            templateId: 'focus-memory',
            length: 'extended',
            focus: 'Memory',
            reasons: [{ gameId: 'memory', kind: 'weak-domain', detail: 'Memory 950 below mean' }],
          }),
        ],
      );
      await txn.run(
        "INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        ['2026-08-20', JSON.stringify(['memory']), 'active', 0, 0, 1, T0 - 1, T0 - 1],
      );
    });

    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    const withMeta = parsed.data.workoutInstances.find(
      (w) => w.date === '2026-08-21::focus-memory::extended',
    )!;
    expect(withMeta.metadata).toMatchObject({ templateId: 'focus-memory', length: 'extended' });
    const withoutMeta = parsed.data.workoutInstances.find((w) => w.date === '2026-08-20')!;
    expect(withoutMeta.metadata ?? null).toBeNull();

    // Replace-import into a fresh database and verify the persisted cells.
    const target = await makeDb();
    await applyImport(target, parsed, 'replace');
    const rows = await target.transaction(async (txn) =>
      txn.all<{ date: string; metadata_json: string | null }>(
        'SELECT date, metadata_json FROM workout_instances ORDER BY date DESC',
      ),
    );
    const restored = rows.find((r) => r.date === '2026-08-21::focus-memory::extended');
    expect(restored?.metadata_json).not.toBeNull();
    expect(JSON.parse(restored!.metadata_json!)).toMatchObject({
      kind: 'template',
      templateId: 'focus-memory',
    });
    expect(rows.find((r) => r.date === '2026-08-20')?.metadata_json).toBeNull();

    // And the full snapshot is byte-stable across the round trip.
    expect(await exportCanonical(target)).toBe(await exportCanonical(src));
  });
});

describe('parseAndValidateBackup rejection gates', () => {
  it('rejects non-JSON (malformed)', () => {
    expect(() => parseAndValidateBackup('not json at all')).toThrow(/not valid JSON/);
  });

  it('rejects a JSON object that is not our format', () => {
    expect(() => parseAndValidateBackup(JSON.stringify({ format: 'something-else' }))).toThrow(
      /Unrecognized backup format/,
    );
  });

  it('rejects a future backup format version', () => {
    const payload = {
      format: 'brain-training-backup',
      version: 999,
      createdAt: T0,
      schemaVersion: 7,
      checksumAlgorithm: 'sha256',
      data: { schemaVersion: 7, profile: null, gameSessions: [], domainRatings: [], ratingHistory: [], currencyLedger: [], gameFavorites: [], xpAwards: [], tutorialState: [], workoutInstances: [], questDefinitions: [], questProgress: [], achievementDefinitions: [], achievementUnlocks: [] },
    };
    // Build a checksum over it so only the version gate triggers.
    const text = JSON.stringify({ ...payload, checksum: computeChecksum(JSON.stringify(payload)) });
    expect(() => parseAndValidateBackup(text)).toThrow(/newer than the supported version/);
  });

  it('rejects a corrupted payload (checksum mismatch)', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const text = serializeBackup(env);
    const tampered = text.replace('"Memory"', '"MemoryX"');
    expect(() => parseAndValidateBackup(tampered)).toThrow(/checksum mismatch/i);
  });

  it('rejects structurally invalid data (data-validation)', () => {
    const data = {
      schemaVersion: 7,
      profile: null,
      gameSessions: [{ id: 'x' }], // missing required fields
      domainRatings: [],
      ratingHistory: [],
      currencyLedger: [],
      gameFavorites: [],
      xpAwards: [],
      tutorialState: [],
      workoutInstances: [],
      questDefinitions: [],
      questProgress: [],
      achievementDefinitions: [],
      achievementUnlocks: [],
    };
    const payload = {
      format: 'brain-training-backup',
      version: 1,
      createdAt: T0,
      schemaVersion: 7,
      checksumAlgorithm: 'sha256',
      data,
    };
    const text = JSON.stringify({ ...payload, checksum: computeChecksum(canonicalString(payload)) });
    expect(() => parseAndValidateBackup(text)).toThrow(/Backup data failed validation/);
  });

  it('accepts a valid backup and exposes metadata', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const env = await exportLocalData(src, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(env));
    expect(parsed.envelope.version).toBe(1);
    expect(parsed.data.gameSessions).toHaveLength(2);
    expect(parsed.data.profile?.displayName).toBe('Tester');
  });
});
