/**
 * Deletion-audit tests (task D): complete local-data deletion must remove every
 * user-owned record, leave the store valid (triggers still active), and return
 * to a fresh local profile state (no leftover cosmetics, no orphaned refs).
 */

import { describe, expect, it } from '@jest/globals';
import { applyImport, countLocalData, exportLocalData, parseAndValidateBackup, serializeBackup, wipeLocalData } from '../index';
import { makeDb, seedFixture, T0 } from './helpers';

describe('deletion audit (task D)', () => {
  it('removes every user-owned record and empties the count report', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);
    const counts = await countLocalData(db);

    expect(counts.gameSessions).toBe(0);
    expect(counts.domainRatings).toBe(0);
    expect(counts.ratingHistory).toBe(0);
    expect(counts.currencyLedger).toBe(0);
    expect(counts.gameFavorites).toBe(0);
    expect(counts.xpAwards).toBe(0);
    expect(counts.tutorialState).toBe(0);
    expect(counts.workoutInstances).toBe(0);
    expect(counts.questDefinitions).toBe(0);
    expect(counts.questProgress).toBe(0);
    expect(counts.achievementDefinitions).toBe(0);
    expect(counts.achievementUnlocks).toBe(0);
    expect(counts.hasProfile).toBe(false);
  });

  it('wipe leaves the store valid: append-only triggers remain active', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);
    await db.ledger.append({ amount: 10, reason: 'seed' });
    expect(await db.ledger.getBalance()).toBe(10);
    await expect(
      db.transaction(async (txn) => txn.exec('DELETE FROM currency_ledger')),
    ).rejects.toThrow(/append-only/);
  });

  it('returns to a fresh local profile state (no leftover cosmetics)', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await db.profile.update({
      settings: {
        cosmetics: { owned: ['theme-midnight'], equipped: { accent: 'theme-midnight' } },
      },
    });

    await wipeLocalData(db);
    expect(await db.profile.get()).toBeNull();
    const fresh = await db.profile.ensureExists();
    expect(fresh.id).toBe('local');
    const cosmetics = (fresh.settings as { cosmetics?: unknown }).cosmetics;
    expect(cosmetics).toBeUndefined();
  });

  it('wipe then restore from a backup fully recovers every section', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = parseAndValidateBackup(
      serializeBackup(await exportLocalData(src, { now: () => T0 + 1 })),
    );

    const target = await makeDb();
    await seedFixture(target);
    await wipeLocalData(target);

    await applyImport(target, parsed, 'replace');
    const counts = await countLocalData(target);
    expect(counts.gameSessions).toBe(2);
    expect(counts.currencyLedger).toBe(2);
    expect(counts.domainRatings).toBe(1);
    expect(counts.ratingHistory).toBe(2);
    expect(counts.hasProfile).toBe(true);
  });

  it('wipe is order-safe: FK still rejects dangling references after re-seed', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);

    await db.transaction(async (txn) => {
      await txn.run(
        "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local','t','{}',?,?)",
        [T0, T0],
      );
    });
    await expect(
      db.transaction(async (txn) =>
        txn.run(
          "INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES ('ghost', 'Memory', 1, 1000, ?)",
          [T0],
        ),
      ),
    ).rejects.toThrow(/FOREIGN KEY|foreign key/i);
  });
});
