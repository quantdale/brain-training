/**
 * Cosmetic economy tests (engagement-cosmetics wave): idempotent,
 * atomic purchase with normal earned currency through the ledger, ownership
 * persistence, insufficient-funds refusal, and the free equip guard.
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, LedgerRepository, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  COSMETIC_DEFINITIONS,
  equipCosmeticPersisted,
  isCosmeticOwned,
  purchaseCosmetic,
  type CosmeticProgression,
} from '@/cosmetics';

const T0 = 1_700_000_000_000;
const PURCHASEABLE = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-azure')!; // 150 coins

const PROGRESSION: CosmeticProgression = {
  claimedAchievements: new Set(),
  claimedQuests: new Set(),
  longestStreak: 0,
};

async function healthy(seed: number): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  if (seed !== 0) {
    await new LedgerRepository(real, () => T0).append({ amount: seed, reason: 'seed' });
  }
  return new AppDatabase(real, { now: () => T0 });
}

describe('purchaseCosmetic', () => {
  it('debits currency and grants ownership exactly once', async () => {
    const db = await healthy(500);
    const result = await purchaseCosmetic(db, PURCHASEABLE, PROGRESSION);
    expect(result).toBe('purchased');
    expect(await db.ledger.getBalance()).toBe(350);
    const settings = (await db.profile.get())?.settings ?? {};
    expect(isCosmeticOwned(PURCHASEABLE, PROGRESSION, settings)).toBe(true);
  });

  it('refuses when the balance is too low and leaves it untouched', async () => {
    const db = await healthy(100);
    const result = await purchaseCosmetic(db, PURCHASEABLE, PROGRESSION);
    expect(result).toBe('insufficient');
    expect(await db.ledger.getBalance()).toBe(100);
    const settings = (await db.profile.get())?.settings ?? {};
    expect(isCosmeticOwned(PURCHASEABLE, PROGRESSION, settings)).toBe(false);
  });

  it('is idempotent via operationId: a retry never double-charges or double-grants', async () => {
    const db = await healthy(500);
    const first = await purchaseCosmetic(db, PURCHASEABLE, PROGRESSION);
    expect(first).toBe('purchased');
    const second = await purchaseCosmetic(db, PURCHASEABLE, PROGRESSION);
    expect(second).toBe('already-owned');
    expect(await db.ledger.getBalance()).toBe(350); // debited exactly once
    const entries = await db.ledger.list();
    // seed + exactly one cosmetic debit (both reason 'cosmetic').
    expect(entries.filter((e) => e.reason === 'cosmetic')).toHaveLength(1);
  });

  it('reports not-purchasable for earned cosmetics', async () => {
    const db = await healthy(500);
    const earned = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-bronze')!;
    expect(await purchaseCosmetic(db, earned, PROGRESSION)).toBe('not-purchasable');
  });
});

describe('equipCosmeticPersisted', () => {
  it('equips an owned cosmetic and refuses to equip an unowned one', async () => {
    const db = await healthy(500);
    // Buy it first so it is owned.
    await purchaseCosmetic(db, PURCHASEABLE, PROGRESSION);
    expect(await equipCosmeticPersisted(db, PURCHASEABLE, PROGRESSION)).toBe(true);
    const equipped = (await db.profile.get())?.settings.cosmetics as Record<string, unknown>;
    expect((equipped.equipped as Record<string, string>).avatarFrame).toBe('cos-frame-azure');

    // An unowned cosmetic cannot be equipped.
    const other = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-frame-gold')!;
    expect(await equipCosmeticPersisted(db, other, PROGRESSION)).toBe(false);
  });
});
