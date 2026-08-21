/**
 * Single-pass serializer byte-contract tests.
 *
 * Regression pin for the campaign 011 Critical defect (W10 single-pass
 * writer): `serializeEnvelopeWithChecksum` hashed the structural commas
 * ADJACENT to the text-only `checksum` member. With `appVersion` present the
 * hashed stream carried a doubled comma (`...,,\"checksumAlgorithm\"...`);
 * without it the hash input began with a leading comma (`{,...`). The embedded
 * digest then never matched `computeChecksum(canonicalString(payload))`
 * recomputed by `parseAndValidateBackup`, so EVERY freshly exported backup was
 * rejected at import — export→import was fully broken.
 *
 * These tests pin the writer's byte contract in BOTH checksum sort positions:
 *   checksum === computeChecksum(canonicalString(payload))
 * and that the emitted text parses as a valid backup.
 */
import { describe, expect, it } from '@jest/globals';
import {
  serializeEnvelopeWithChecksum,
  exportLocalDataBundle,
  serializeBackup,
  type BackupEnvelopePayload,
} from '../serialize';
import { parseAndValidateBackup } from '../deserialize';
import { canonicalString } from '../canonical-json';
import { computeChecksum } from '../checksum';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupData } from '../types';
import { emptyData, seedFixture, makeDb, T0 } from './helpers';
import { exportLocalData } from '../index';

function buildPayload(
  data: BackupData,
  opts: { appVersion?: string; createdAt?: number } = {},
): BackupEnvelopePayload {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    createdAt: opts.createdAt ?? T0 + 1,
    ...(opts.appVersion ? { appVersion: opts.appVersion } : {}),
    schemaVersion: data.schemaVersion,
    engineVersion: 2,
    checksumAlgorithm: 'sha256',
    manifest: {
      generatedBy: 'data-portability/2',
      sections: {
        gameSessions: data.gameSessions.length,
        domainRatings: 0,
        ratingHistory: 0,
        currencyLedger: 0,
        gameFavorites: 0,
        xpAwards: 0,
        tutorialState: 0,
        workoutInstances: 0,
        questDefinitions: 0,
        questProgress: 0,
        achievementDefinitions: 0,
        achievementUnlocks: 0,
        hasProfile: false,
      },
      totalRecords: data.gameSessions.length,
    },
    data,
  };
}

describe('single-pass serializer byte contract (campaign011 comma regression)', () => {
  it('digest matches legacy payload text when checksum sorts interior (appVersion present)', () => {
    const payload = buildPayload(emptyData(), { appVersion: 'test-1.0.0' });
    const { checksum, text } = serializeEnvelopeWithChecksum(payload);
    // The exact invariant deserialize enforces.
    expect(checksum).toBe(computeChecksum(canonicalString(payload)));
    // Output text is still the full canonical envelope (checksum included).
    expect(text).toBe(canonicalString({ ...payload, checksum }));
  });

  it('digest matches legacy payload text when checksum sorts first (no appVersion)', () => {
    const payload = buildPayload(emptyData());
    expect(canonicalString(payload).startsWith('{"checksumAlgorithm"')).toBe(true);
    const { checksum, text } = serializeEnvelopeWithChecksum(payload);
    expect(checksum).toBe(computeChecksum(canonicalString(payload)));
    expect(text).toBe(canonicalString({ ...payload, checksum }));
  });

  it('emitted text of a real export parses cleanly (interior position)', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const { envelope, text } = await exportLocalDataBundle(src, {
      now: () => T0 + 1,
      appVersion: 'test-1.0.0',
    });
    const parsed = parseAndValidateBackup(text); // must not throw
    expect(parsed.envelope.checksum).toBe(envelope.checksum);
    expect(parsed.data.gameSessions).toHaveLength(2);
  });

  it('emitted text of a real export parses cleanly (first position)', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const env = await exportLocalData(src, { now: () => T0 + 1 }); // no appVersion
    const text = serializeBackup(env);
    const parsed = parseAndValidateBackup(text); // must not throw
    expect(parsed.envelope.checksum).toBe(env.checksum);
    expect(parsed.data.gameSessions).toHaveLength(2);
  });

  it('is deterministic: identical payloads produce identical bytes and digests', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const a = await exportLocalDataBundle(src, {
      now: () => T0 + 1,
      appVersion: 'test-1.0.0',
    });
    const b = await exportLocalDataBundle(src, {
      now: () => T0 + 1,
      appVersion: 'test-1.0.0',
    });
    expect(a.text).toBe(b.text);
    expect(a.envelope.checksum).toBe(b.envelope.checksum);
  });
});
