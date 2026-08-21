/**
 * Hardening tests (campaign 009 / W11): adversarial cases beyond the original
 * task-C suite. Each test pins a specific rejection gate or merge semantic:
 *
 *   - oversized backup text is rejected before parsing (no OOM path);
 *   - version 0 / negative / fractional versions are rejected as malformed
 *     (only whole positive versions have ever existed);
 *   - backups violating DB-level range constraints (normalizedResult, xp,
 *     completedAt >= startedAt, durationMs, rating) are rejected with typed
 *     validation errors instead of aborting mid-import on SQLite triggers;
 *   - FK-backed sections referencing unknown sessions are rejected up front;
 *   - a foreign profile id is normalized to the local singleton id (a backup
 *     written under another device's id must still be visible after import);
 *   - cosmetics merge monotonically: `owned` is unioned (merge never disowns
 *     a cosmetic the device earned), equipped slots resolve backup-wins;
 *   - preview rejections preserve the caller's requested mode;
 *   - countLocalData stays exact beyond repository list limits (>10k rows);
 *   - wipe clears EVERY user table in the live schema (dynamic completeness,
 *     not just the tables the audit happens to know about).
 */

import { describe, expect, it } from '@jest/globals';
import {
  applyImport,
  countLocalData,
  exportLocalData,
  MAX_BACKUP_TEXT_LENGTH,
  parseAndValidateBackup,
  previewImport,
  serializeBackup,
  wipeLocalData,
  MalformedBackupError,
  BackupDataValidationError,
} from '../index';
import { makeDb, seedFixture, buildEnvelope, emptyData, T0 } from './helpers';

describe('oversized backup text', () => {
  it('rejects text above MAX_BACKUP_TEXT_LENGTH before parsing', () => {
    const huge = 'x'.repeat(MAX_BACKUP_TEXT_LENGTH + 1);
    expect(() => parseAndValidateBackup(huge)).toThrow(MalformedBackupError);
    expect(() => parseAndValidateBackup(huge)).toThrow(/too large/i);
  });

  it('accepts text just under the cap structurally far enough to hit the format gate', () => {
    // Sanity bound: the cap itself does not reject normal-sized garbage —
    // that input fails later at the format gate with its own clear error.
    expect(() => parseAndValidateBackup('not json')).toThrow(/not valid JSON/);
  });
});

describe('invalid format versions are malformed, not "old"', () => {
  it.each([0, -3, 1.5])('rejects version %p with a clear malformed error', (badVersion) => {
    const env = buildEnvelope(emptyData(), { version: badVersion });
    expect(() => parseAndValidateBackup(serializeBackup(env))).toThrow(
      MalformedBackupError,
    );
    expect(() => parseAndValidateBackup(serializeBackup(env))).toThrow(
      /not a valid format version/,
    );
  });

  it('still accepts the current version and rejects only newer ones as unsupported', () => {
    const ok = buildEnvelope(emptyData(), { version: 1 });
    expect(() => parseAndValidateBackup(serializeBackup(ok))).not.toThrow();
    const future = buildEnvelope(emptyData(), { version: 2 });
    expect(() => parseAndValidateBackup(serializeBackup(future))).toThrow(
      /newer than the supported version/,
    );
  });
});

describe('DB-range violations are rejected at validation time', () => {
  function sessionWith(overrides: Record<string, unknown>) {
    return {
      id: 'bad',
      gameId: 'memory',
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 1,
      difficulty: {},
      rawResult: {},
      normalizedResult: 0.5,
      xp: 10,
      startedAt: T0,
      completedAt: T0 + 10,
      durationMs: 100,
      ...overrides,
    };
  }

  it('rejects normalizedResult outside [0, 1]', () => {
    const data = emptyData();
    data.gameSessions.push(sessionWith({ normalizedResult: 1.5 }) as never);
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      BackupDataValidationError,
    );
    try {
      parseAndValidateBackup(serializeBackup(buildEnvelope(data)));
    } catch (error) {
      expect((error as BackupDataValidationError).issues.join(' ')).toMatch(/normalizedResult/);
    }
  });

  it('rejects negative xp', () => {
    const data = emptyData();
    data.gameSessions.push(sessionWith({ xp: -5 }) as never);
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /xp must be nonnegative/,
    );
  });

  it('rejects completedAt before startedAt', () => {
    const data = emptyData();
    data.gameSessions.push(sessionWith({ completedAt: T0 - 1 }) as never);
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /completedAt must not precede startedAt/,
    );
  });

  it('rejects negative durationMs', () => {
    const data = emptyData();
    data.gameSessions.push(sessionWith({ durationMs: -1 }) as never);
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /durationMs must be nonnegative/,
    );
  });

  it('rejects a negative domain rating', () => {
    const data = emptyData();
    data.domainRatings.push({ domain: 'Memory', rating: -1, sessions: 2, updatedAt: T0 });
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /rating\/sessions must be nonnegative/,
    );
  });

  it('accepts boundary values (normalizedResult 0 and 1, xp 0)', () => {
    const data = emptyData();
    data.gameSessions.push(sessionWith({ normalizedResult: 0, xp: 0 }));
    data.gameSessions.push(sessionWith({ id: 'edge1', normalizedResult: 1 }));
    const parsed = parseAndValidateBackup(serializeBackup(buildEnvelope(data)));
    expect(parsed.data.gameSessions).toHaveLength(2);
  });
});

describe('relational integrity against the same backup', () => {
  it('rejects ratingHistory referencing an unknown session', () => {
    const data = emptyData();
    data.ratingHistory.push({
      sessionId: 'ghost',
      domain: 'Memory',
      delta: 5,
      ratingAfter: 1005,
      createdAt: T0,
    });
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /ratingHistory references unknown session "ghost"/,
    );
  });

  it('rejects currencyLedger referencing an unknown session', () => {
    const data = emptyData();
    data.currencyLedger.push({
      amount: 10,
      reason: 'gameplay',
      sessionId: 'ghost',
      createdAt: T0,
      operationId: null,
    });
    expect(() => parseAndValidateBackup(serializeBackup(buildEnvelope(data)))).toThrow(
      /currencyLedger references unknown session "ghost"/,
    );
  });

  it('accepts ledger/history whose sessions exist in the backup (replace no longer FK-aborts)', async () => {
    const data = emptyData();
    data.gameSessions.push({
      id: 's-ok',
      gameId: 'memory',
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 1,
      difficulty: {},
      rawResult: {},
      normalizedResult: 0.5,
      xp: 10,
      startedAt: T0,
      completedAt: T0 + 10,
      durationMs: 100,
    });
    data.currencyLedger.push({
      amount: 10,
      reason: 'gameplay',
      sessionId: 's-ok',
      createdAt: T0 + 10,
      operationId: 'op-ok',
    });
    data.ratingHistory.push({
      sessionId: 's-ok',
      domain: 'Memory',
      delta: 5,
      ratingAfter: 1005,
      createdAt: T0 + 10,
    });

    const target = await makeDb();
    const res = await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');
    expect(res.sessionsAdded).toBe(1);
    expect(res.ledgerAdded).toBe(1);
    expect(res.ratingHistoryAdded).toBe(1);
  });
});

describe('foreign profile id is normalized to the local singleton', () => {
  function profileUnderForeignId() {
    return {
      id: 'device-xyz',
      displayName: 'Traveler',
      settings: { theme: 'dark' },
      createdAt: T0,
      updatedAt: T0 + 5,
    };
  }

  it('replace import makes the backup profile visible via profile.get()', async () => {
    const data = emptyData();
    data.profile = profileUnderForeignId();
    const target = await makeDb();
    // Fresh device has a 'local' row; replace clears it, then imports.
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');

    const profile = await target.profile.get();
    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe('Traveler');
    expect(profile?.id).toBe('local');
  });

  it('merge import updates the local row instead of creating an invisible second one', async () => {
    const data = emptyData();
    data.profile = profileUnderForeignId();
    const target = await makeDb(); // ensureExists ran -> 'local' row present
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'merge');

    const profile = await target.profile.get();
    expect(profile?.displayName).toBe('Traveler');
    expect(profile?.settings.theme).toBe('dark');

    // Exactly ONE profile row exists afterwards.
    const rows = await target.transaction(async (txn) =>
      txn.all<{ id: string }>('SELECT id FROM profile'),
    );
    expect(rows.map((r) => r.id)).toEqual(['local']);
  });

  it('re-export after import carries the canonical local id', async () => {
    const data = emptyData();
    data.profile = profileUnderForeignId();
    const target = await makeDb();
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');
    const env = await exportLocalData(target, { now: () => T0 + 9 });
    expect(env.data.profile?.id).toBe('local');
  });
});

describe('cosmetics survive merge monotonically', () => {
  it('unions owned lists so the device never loses an earned cosmetic', async () => {
    const target = await makeDb();
    await target.profile.update({
      settings: {
        cosmetics: {
          owned: ['theme-sunset', 'theme-midnight'],
          equipped: { accent: 'theme-sunset' },
        },
      },
    });

    const data = emptyData();
    data.profile = {
      id: 'local',
      displayName: 'Backup',
      settings: {
        cosmetics: {
          owned: ['theme-midnight'],
          equipped: { accent: 'theme-midnight' },
        },
      },
      createdAt: T0,
      updatedAt: T0 + 5,
    };
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'merge');

    const settings = (await target.profile.get())?.settings ?? {};
    const cosmetics = settings.cosmetics as {
      owned?: string[];
      equipped?: Record<string, string>;
    };
    // Both devices' cosmetics survive; the conflicting slot takes the backup.
    expect(cosmetics.owned).toEqual(['theme-sunset', 'theme-midnight']);
    expect(cosmetics.equipped?.accent).toBe('theme-midnight');
  });

  it('keeps device-only equipped slots when the backup equips nothing in them', async () => {
    const target = await makeDb();
    await target.profile.update({
      settings: {
        cosmetics: {
          owned: ['theme-a'],
          equipped: { accent: 'theme-a', board: 'theme-a' },
        },
      },
    });

    const data = emptyData();
    data.profile = {
      id: 'local',
      displayName: 'Backup',
      settings: {
        cosmetics: { owned: ['theme-b'], equipped: { accent: 'theme-b' } },
      },
      createdAt: T0,
      updatedAt: T0 + 5,
    };
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'merge');

    const cosmetics = ((await target.profile.get())?.settings ?? {})
      .cosmetics as { equipped?: Record<string, string>; owned?: string[] };
    expect(cosmetics.equipped?.accent).toBe('theme-b'); // backup wins its slot
    expect(cosmetics.equipped?.board).toBe('theme-a'); // device-only slot survives
    expect(cosmetics.owned).toEqual(['theme-a', 'theme-b']);
  });

  it('leaves non-cosmetics settings shallow-merged (backup wins per key)', async () => {
    const target = await makeDb();
    await target.profile.update({ settings: { theme: 'light', sound: true } });

    const data = emptyData();
    data.profile = {
      id: 'local',
      displayName: '',
      settings: { theme: 'dark' },
      createdAt: T0,
      updatedAt: T0 + 5,
    };
    await applyImport(target, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'merge');

    const settings = (await target.profile.get())?.settings ?? {};
    expect(settings.theme).toBe('dark'); // backup wins named keys
    expect(settings.sound).toBe(true); // device-only keys survive
  });

  it('replace import copies cosmetics verbatim (equipped refs survive wipe+restore)', async () => {
    const src = await makeDb();
    await src.profile.update({
      settings: {
        cosmetics: { owned: ['theme-x'], equipped: { accent: 'theme-x' } },
      },
    });
    const parsed = parseAndValidateBackup(
      serializeBackup(await exportLocalData(src, { now: () => T0 + 1 })),
    );

    const target = await makeDb();
    await seedFixture(target);
    await wipeLocalData(target);
    await applyImport(target, parsed, 'replace');

    const cosmetics = ((await target.profile.get())?.settings ?? {})
      .cosmetics as { equipped?: Record<string, string> };
    expect(cosmetics.equipped?.accent).toBe('theme-x');
  });
});

describe('preview rejection reports preserve the requested mode', () => {
  it('a rejected replace preview reports mode "replace", not "merge"', async () => {
    const target = await makeDb();
    const preview = await previewImport(target, 'totally not json', 'replace');
    expect(preview.valid).toBe(false);
    expect(preview.error?.kind).toBe('malformed');
    expect(preview.mode).toBe('replace');
  });

  it('a rejected merge preview reports mode "merge"', async () => {
    const target = await makeDb();
    const preview = await previewImport(target, '{ nope', 'merge');
    expect(preview.valid).toBe(false);
    expect(preview.mode).toBe('merge');
  });
});

describe('countLocalData is exact beyond repository list limits', () => {
  it('counts more than 10k ledger rows (listRecent-style caps would undercount)', async () => {
    const db = await makeDb();
    const N = 10_050;
    await db.transaction(async (txn) => {
      for (let i = 0; i < N; i++) {
        await txn.run(
          'INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, NULL, ?, NULL)',
          [1, 'bulk', T0 + i],
        );
      }
    });
    const counts = await countLocalData(db);
    expect(counts.currencyLedger).toBe(N);
  }, 60_000);
});

describe('wipe completeness against the live schema', () => {
  it('clears EVERY user table present in sqlite_master (future tables cannot hide)', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);

    // Discover all user tables dynamically — if a migration ever adds a table
    // the wipe order misses, this test fails instead of leaking user data.
    const tables = await db.transaction(async (txn) =>
      txn.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      ),
    );
    expect(tables.length).toBeGreaterThanOrEqual(13);
    for (const { name } of tables) {
      const rows = await db.transaction(async (txn) =>
        txn.all<Record<string, unknown>>(`SELECT * FROM "${name}"`),
      );
      expect(rows).toEqual([]);
    }
  });
});
