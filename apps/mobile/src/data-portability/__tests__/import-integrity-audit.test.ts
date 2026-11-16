import { describe, expect, it } from '@jest/globals';

import { mergeProfileSettings } from '../apply';
import {
  applyImport,
  parseAndValidateBackup,
  previewImport,
  serializeBackup,
  type BackupData,
} from '../index';
import { buildEnvelope, emptyData, makeDb, T0 } from './helpers';

function parsed(data: BackupData) {
  return parseAndValidateBackup(serializeBackup(buildEnvelope(data)));
}

function session(id = 'audit-session', xp = 0): BackupData['gameSessions'][number] {
  return {
    id, gameId: 'memory', gameVersion: 1, generatorVersion: 1, scoringVersion: 1,
    seed: 1, difficulty: {}, rawResult: {}, normalizedResult: 0.5, xp,
    startedAt: T0, completedAt: T0 + 100, durationMs: 100,
  };
}

function credit(operationId: string | null, amount = 10) {
  return { amount, reason: 'audit', sessionId: null, createdAt: T0, operationId };
}

describe('append-only import integrity audit', () => {
  it('preserves identical generic XP award multiplicity and reimport idempotency', async () => {
    const target = await makeDb();
    const award = { amount: 5, reason: 'bonus', source: 'system', createdAt: T0 };
    const backup = parsed({ ...emptyData(), xpAwards: [award, { ...award }] });
    await applyImport(target, backup, 'merge');
    expect(await target.xpAwards.getTotalAwardedXp()).toBe(10);
    expect(await target.xpAwards.list()).toHaveLength(2);
    await applyImport(target, backup, 'merge');
    expect(await target.xpAwards.getTotalAwardedXp()).toBe(10);
    expect(await target.xpAwards.list()).toHaveLength(2);
  });

  it('preserves identical unkeyed ledger multiplicity against the pre-import target', async () => {
    const target = await makeDb();
    await target.ledger.append(credit(null, 5));
    const backup = parsed({ ...emptyData(), currencyLedger: [credit(null, 5), credit(null, 5)] });
    await applyImport(target, backup, 'merge');
    expect(await target.ledger.getBalance()).toBe(10);
    expect(await target.ledger.list()).toHaveLength(2);
    await applyImport(target, backup, 'merge');
    expect(await target.ledger.getBalance()).toBe(10);
    expect(await target.ledger.list()).toHaveLength(2);
  });

  it.each([true, false])('bridges migrated gameplay keys in either import order (legacy first=%s)', async (legacyFirst) => {
    const target = await makeDb();
    const data = (keyed: boolean): BackupData => ({
      ...emptyData(), gameSessions: [session()],
      currencyLedger: [{
        amount: 10, reason: 'gameplay', sessionId: 'audit-session', createdAt: T0 + 100,
        operationId: keyed ? 'gameplay:audit-session' : null,
      }],
    });
    await applyImport(target, parsed(data(!legacyFirst)), 'replace');
    await applyImport(target, parsed(data(legacyFirst)), 'merge');
    expect(await target.ledger.getBalance()).toBe(10);
    expect(await target.ledger.list()).toHaveLength(1);
    await applyImport(target, parsed(data(legacyFirst)), 'merge');
    expect(await target.ledger.getBalance()).toBe(10);
  });

  it('does not collapse distinct logical identities containing delimiter characters', async () => {
    const target = await makeDb();
    const data = {
      ...emptyData(),
      xpAwards: [
        { amount: 5, source: 'achievement:a\u0000b', reason: 'c', createdAt: T0 },
        { amount: 5, source: 'achievement:a', reason: 'b\u0000c', createdAt: T0 },
      ],
    };
    await applyImport(target, parsed(data), 'replace');
    expect(await target.xpAwards.list()).toHaveLength(2);
    expect(await target.xpAwards.getTotalAwardedXp()).toBe(10);
  });

  it('rejects a diverged-ledger deficit during both preview and real merge, without writes', async () => {
    const target = await makeDb();
    await applyImport(target, parsed({
      ...emptyData(), currencyLedger: [credit('shared', 100), credit('spend-A', -80)],
    }), 'replace');
    const before = await target.ledger.list();
    const text = serializeBackup(buildEnvelope({
      ...emptyData(), currencyLedger: [credit('shared', 100), credit('spend-B', -80)],
    }));
    const preview = await previewImport(target, text, 'merge');
    expect(preview.valid).toBe(false);
    expect(preview.error?.message).toMatch(/negative|deficit/i);
    await expect(applyImport(target, parseAndValidateBackup(text), 'merge')).rejects.toThrow(/negative|deficit/i);
    expect(await target.ledger.list()).toEqual(before);
    expect(await target.ledger.getBalance()).toBe(20);
  });

  it.each(['session', 'combined', 'ledger'] as const)('refuses unsafe %s totals transactionally', async (kind) => {
    const target = await makeDb();
    const data = emptyData();
    if (kind === 'session') {
      data.gameSessions = Array.from({ length: 1025 }, (_, i) => session(`overflow-${i}`, Number.MAX_SAFE_INTEGER));
    } else if (kind === 'combined') {
      data.gameSessions = [session('large-xp', Number.MAX_SAFE_INTEGER)];
      data.xpAwards = [{ amount: 1, reason: 'bonus', source: 'system', createdAt: T0 }];
    } else {
      data.currencyLedger = [credit('large', Number.MAX_SAFE_INTEGER), credit('extra', 1)];
    }
    const backup = parsed(data);
    const preview = await previewImport(target, serializeBackup(buildEnvelope(data)), 'replace');
    expect(preview.valid).toBe(false);
    await expect(applyImport(target, backup, 'replace')).rejects.toThrow(/safe|overflow|exact/i);
    expect(await target.sessions.getCount()).toBe(0);
    expect(await target.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(await target.ledger.getBalance()).toBe(0);
  });
});

describe('monotonic recognized profile settings', () => {
  it.each([null, 'invalid', []])('keeps device streak claims when incoming streaks is %s', (streaks) => {
    const retained = {
      claimedMilestones: ['mil-3'], coveredDates: ['2026-11-15'], freeze: 1,
      freezeUsed: { period: '2026-11', count: 1 },
    };
    expect(mergeProfileSettings({ streaks: retained }, { streaks }).streaks).toEqual(retained);
  });
});
