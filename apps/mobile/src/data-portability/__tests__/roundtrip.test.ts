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
