import { describe, expect, it } from '@jest/globals';
import { countLocalData, wipeLocalData } from '../index';
import { makeDb, seedFixture } from './helpers';

describe('local-data deletion workflow', () => {
  it('counts all deletable data', async () => {
    const db = await makeDb();
    await seedFixture(db);
    const counts = await countLocalData(db);
    expect(counts.gameSessions).toBe(2);
    expect(counts.domainRatings).toBe(1);
    expect(counts.ratingHistory).toBe(2);
    expect(counts.currencyLedger).toBe(2);
    expect(counts.gameFavorites).toBe(1);
    expect(counts.xpAwards).toBe(1);
    expect(counts.tutorialState).toBe(1);
    expect(counts.workoutInstances).toBe(1);
    expect(counts.questDefinitions).toBe(1);
    expect(counts.questProgress).toBe(1);
    expect(counts.achievementDefinitions).toBe(1);
    expect(counts.achievementUnlocks).toBe(1);
    expect(counts.hasProfile).toBe(true);
  });

  it('wipes everything and leaves an empty, still-valid store', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);

    const counts = await countLocalData(db);
    expect(counts.gameSessions).toBe(0);
    expect(counts.hasProfile).toBe(false);
    expect(counts.currencyLedger).toBe(0);
    expect(counts.questProgress).toBe(0);
  });

  it('keeps append-only triggers active after a wipe (cannot delete from ledger)', async () => {
    const db = await makeDb();
    await seedFixture(db);
    await wipeLocalData(db);
    // Insert then attempt to delete — the trigger must still forbid it.
    await db.ledger.append({ amount: 10, reason: 'seed' });
    await expect(db.transaction(async (txn) => txn.exec('DELETE FROM currency_ledger'))).rejects.toThrow(
      /append-only/,
    );
  });

  it('is idempotent — wiping an already-empty database is a no-op', async () => {
    const db = await makeDb();
    await wipeLocalData(db);
    const counts = await countLocalData(db);
    expect(counts.gameSessions).toBe(0);
    expect(counts.hasProfile).toBe(false);
  });
});
