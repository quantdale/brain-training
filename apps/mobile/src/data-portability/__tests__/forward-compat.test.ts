/**
 * Forward-compatibility signal (Change 070, design D5 / task 4).
 *
 * The asymmetry under test:
 * - an OLDER backup read by a NEWER build is additive and safe → must stay
 *   SILENT, or users learn to ignore the notice;
 * - a NEWER backup read by an OLDER build silently DROPS the unknown content,
 *   and the next export writes it back missing → must be surfaced, cancellable,
 *   and recorded on the result when the user proceeds.
 *
 * Both directions are pinned, because the failure mode of "just always warn" is
 * a notice users dismiss, and the failure mode of "never warn" is permanent
 * silent data loss.
 */
import { describe, expect, it } from '@jest/globals';

import { previewImport } from '../preview';
import { exportLocalData, parseAndValidateBackup, serializeBackup } from '../index';
import { SCHEMA_VERSION } from '@/db';
import {
  detectUnrecognizedContent,
  KNOWN_DATA_SECTIONS,
  KNOWN_ENVELOPE_FIELDS,
} from '../forward-compat';
import { buildEnvelope, emptyData, makeDb, seedFixture, T0 } from './helpers';

/**
 * The tests deliberately add sections this build does not know, so the data
 * they build is intentionally not a `BackupData`. The cast states that.
 */
type BackupDataForTest = Parameters<typeof buildEnvelope>[0];

function parsedOf(data: Record<string, unknown>, extraEnvelope: Record<string, unknown> = {}) {
  return {
    envelope: { ...(buildEnvelope(data as unknown as BackupDataForTest) as unknown as Record<string, unknown>), ...extraEnvelope },
    data: data as Record<string, unknown>,
  };
}

describe('detection', () => {
  it('reports nothing for a backup this build fully understands', () => {
    const report = detectUnrecognizedContent(parsedOf(emptyData() as unknown as Record<string, unknown>));
    expect(report.lossy).toBe(false);
    expect(report.items).toEqual([]);
    expect(report.summary).toMatch(/only data this version of the app understands/);
  });

  it('never flags the app\'s own exports as lossy (envelope self-parity)', async () => {
    // Regression: buildExportPayload emits appVersion/engineVersion/manifest,
    // which KNOWN_ENVELOPE_FIELDS omitted, so EVERY backup the app wrote was
    // reported as "written by a newer version … will be lost" on preview.
    // The failing test before the fix builds a REAL export (not the test
    // helper's minimal envelope, which never exercised this axis).
    const src = await makeDb();
    await seedFixture(src);
    const env = await exportLocalData(src, { now: () => T0 + 1, appVersion: 'test-1.0.0' });
    const text = serializeBackup(env);
    const parsed = parseAndValidateBackup(text);
    // `parsed.raw` IS the { envelope, data } view the detector takes — pass it
    // through, not its `.envelope` nested as a fake envelope.
    const report = detectUnrecognizedContent(parsed.raw);
    expect(report.lossy).toBe(false);
    expect(report.items).toEqual([]);

    const preview = await previewImport(src, text, 'replace');
    expect(preview.forwardCompatibility?.lossy).toBe(false);
    expect(preview.notes.join(' ')).not.toMatch(/newer version/i);
  });

  it('detects an unknown data SECTION', () => {
    const report = detectUnrecognizedContent(
      parsedOf({ ...(emptyData() as unknown as Record<string, unknown>), streakFreezeInventory: [] }),
    );
    expect(report.lossy).toBe(true);
    expect(report.items).toEqual([{ kind: 'section', path: 'data.streakFreezeInventory' }]);
    expect(report.summary).toMatch(/written by a newer version/);
  });

  it('detects an unknown ENVELOPE field', () => {
    const report = detectUnrecognizedContent(parsedOf(emptyData() as unknown as Record<string, unknown>, {
      compression: 'zstd',
    }));
    expect(report.lossy).toBe(true);
    expect(report.items.map((i) => i.kind)).toContain('envelope-field');
  });

  it('detects an unknown PROFILE field (the common additive case)', () => {
    const base = emptyData() as unknown as Record<string, unknown>;
    const report = detectUnrecognizedContent(
      parsedOf({
        ...base,
        profile: {
          id: 'local',
          displayName: 'Player',
          settings: {},
          createdAt: 1,
          updatedAt: 2,
          streakFreezes: { remaining: 2 },
        },
      }),
    );
    expect(report.lossy).toBe(true);
    expect(report.items).toEqual([{ kind: 'data-field', path: 'data.profile.streakFreezes' }]);
  });

  it('detects a NEWER schema version and stays silent for an OLDER one', () => {
    const base = emptyData() as unknown as Record<string, unknown>;
    // Older: already tolerated and additive — silence is correct.
    const older = detectUnrecognizedContent(parsedOf({ ...base, schemaVersion: 3 }));
    expect(older.lossy).toBe(false);

    // Newer: the app's schema may hold tables/columns this build lacks.
    const newer = detectUnrecognizedContent(parsedOf({ ...base, schemaVersion: 99 }));
    expect(newer.lossy).toBe(true);
    expect(newer.items[0].kind).toBe('schema-version');
    // The message must name BOTH versions so a user can act on it.
    expect(newer.items[0].path).toMatch(/99/);
    // Derived from the live schema version rather than a hardcoded number:
    // the message names whatever THIS build supports, which moves with v13+.
    expect(newer.items[0].path).toContain(`supports ${SCHEMA_VERSION}`);
  });

  it('reports the same content only once', () => {
    const base = emptyData() as unknown as Record<string, unknown>;
    const report = detectUnrecognizedContent(parsedOf({ ...base, newThing: 1, otherThing: 2 }));
    const paths = report.items.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('bounds the summary it shows, listing the rest by count', () => {
    const base = emptyData() as unknown as Record<string, unknown>;
    const data: Record<string, unknown> = { ...base };
    for (let i = 0; i < 40; i++) data[`future${i}`] = [];
    const report = detectUnrecognizedContent(parsedOf(data));
    expect(report.items.length).toBe(40);
    // Every item is retained for diagnostics, but only a bounded prefix is
    // rendered into user-facing text.
    expect(report.summary).toMatch(/40 items/);
    expect(report.summary).toMatch(/and 20 more/);
  });

  it('keeps its known-section list in sync with the serializer', () => {
    // The list is hand-maintained on purpose (so a new section is a decision,
    // not a side effect). This pins the decision: every section a real export
    // writes must be in it, or every export would look lossy.
    const exported = Object.keys(emptyData() as unknown as Record<string, unknown>).sort();
    const known = [...KNOWN_DATA_SECTIONS].sort();
    // `emptyData()` is the minimal valid shape; any section it omits is covered
    // by the canonical list, so only the reverse direction is asserted here.
    for (const key of exported) expect(known).toContain(key);
    expect(KNOWN_ENVELOPE_FIELDS).toContain('checksum');
  });
});

describe('preview surfaces the signal without blocking the import', () => {
  it('marks a newer-format backup as lossy and keeps the preview valid', async () => {
    const db = await makeDb();
    const base = emptyData() as unknown as Record<string, unknown>;
    const envelope = buildEnvelope({
      ...base,
      streakFreezeInventory: [{ id: 'x' }],
    } as unknown as BackupDataForTest);
    const preview = await previewImport(db, JSON.stringify(envelope), 'merge');

    // Valid: the user may be moving devices deliberately. The signal is a
    // DECISION, not a gate.
    expect(preview.valid).toBe(true);
    expect(preview.forwardCompatibility?.lossy).toBe(true);
    expect(preview.notes.join(' ')).toMatch(/newer version of the app/);
  });

  it('stays silent for a same-version backup', async () => {
    const db = await makeDb();
    const preview = await previewImport(
      db,
      JSON.stringify(buildEnvelope(emptyData())),
      'merge',
    );
    expect(preview.valid).toBe(true);
    expect(preview.forwardCompatibility?.lossy).toBe(false);
    // No lossy claim may leak into the notes for a fully-understood backup.
    expect(preview.notes.join(' ')).not.toMatch(/newer version/);
  });

  it('stays silent for an OLDER-format backup (additive, already tolerated)', async () => {
    const db = await makeDb();
    const base = emptyData() as unknown as Record<string, unknown>;
    const preview = await previewImport(
      db,
      JSON.stringify(buildEnvelope({ ...base, schemaVersion: 5 } as unknown as BackupDataForTest)),
      'merge',
    );
    expect(preview.valid).toBe(true);
    expect(preview.forwardCompatibility?.lossy).toBe(false);
    expect(preview.notes.join(' ')).not.toMatch(/newer version/);
  });

  it('reports a typed rejection rather than a lossy warning for an unreadable backup', async () => {
    // A backup this build cannot parse at all must keep its own clear reason;
    // layering a forward-compat notice on top would bury it.
    const db = await makeDb();
    const preview = await previewImport(db, '{"format":"nope"}', 'merge');
    expect(preview.valid).toBe(false);
    expect(preview.error?.kind).toBeDefined();
    expect(preview.forwardCompatibility).toBeUndefined();
  });
});
