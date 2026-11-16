import { describe, expect, it } from '@jest/globals';

import { canonicalize, canonicalString } from '../canonical-json';
import { computeChecksum } from '../checksum';
import {
  applyImport,
  BACKUP_FORMAT,
  ChecksumMismatchError,
  exportLocalDataBundle,
  parseAndValidateBackup,
} from '../index';
import { emptyData, makeDb, T0 } from './helpers';

function oldWriterPayload(engineVersion?: number) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    createdAt: T0,
    schemaVersion: 7,
    checksumAlgorithm: 'sha256',
    ...(engineVersion === undefined ? {} : { engineVersion }),
    data: {
      ...emptyData(),
      profile: {
        id: 'local',
        displayName: 'Legacy player',
        settings: JSON.parse('{"10":"ten","2":"two","01":{"10":10,"2":2}}'),
        createdAt: T0,
        updatedAt: T0,
      },
    },
  };
}

function oldWriterText(payload: ReturnType<typeof oldWriterPayload>): string {
  // Independent historical algorithm: JSON.stringify enumerates array-index
  // object keys numerically even after canonicalize inserted them lexically.
  const checksum = computeChecksum(JSON.stringify(canonicalize(payload)));
  expect(checksum).not.toBe(computeChecksum(canonicalString(payload)));
  return JSON.stringify({ ...payload, checksum });
}

describe('original-writer checksum compatibility', () => {
  it.each([undefined, 1])(
    'restores numeric-key settings from engine %s without changing current exports',
    async (engineVersion) => {
      const payload = oldWriterPayload(engineVersion);
      const parsed = parseAndValidateBackup(oldWriterText(payload));
      const target = await makeDb();
      await applyImport(target, parsed, 'replace');

      const current = await exportLocalDataBundle(target, { now: () => T0 + 1 });
      expect(current.envelope.data.profile?.settings).toEqual(payload.data.profile.settings);
      expect(parseAndValidateBackup(current.text).data.profile?.settings).toEqual(
        payload.data.profile.settings,
      );
      const { checksum, ...currentPayload } = current.envelope;
      expect(checksum).toBe(computeChecksum(canonicalString(currentPayload)));
    },
  );

  it('still rejects a modified historical payload', () => {
    const payload = oldWriterPayload();
    const text = oldWriterText(payload);
    const modified = JSON.parse(text);
    modified.data.profile.settings['2'] = 'changed after checksum';
    expect(() => parseAndValidateBackup(JSON.stringify(modified))).toThrow(
      ChecksumMismatchError,
    );
  });

  it('does not reinterpret a modern writer as the historical writer', () => {
    const payload = oldWriterPayload(3);
    expect(() => parseAndValidateBackup(oldWriterText(payload))).toThrow(
      ChecksumMismatchError,
    );
  });
});
