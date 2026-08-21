/**
 * Cosmetic economy hardening (campaign 009 W08).
 *
 * Contracts under test:
 * - Purchase crash window: a committed debit whose ownership grant was lost
 *   (the exact crash/restore shape) is REPAIRED by a retry without a second
 *   charge, via the stable `cosmetic:<id>` operationId.
 * - Insufficient-funds attempts never write anything (negative balance is
 *   impossible; balance derives from the ledger).
 * - Equip is transactional: sequential equips of different slots both persist;
 *   unowned equips are refused inside the transaction.
 * - Equipped references remain VALID after an import/wipe-style settings
 *   replacement carrying stale or unknown cosmetic ids: resolution falls back
 *   to the slot default and the write path keeps working.
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, LedgerRepository, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  COSMETIC_DEFINITIONS,
  equipCosmeticPersisted,
  getCosmeticDefinition,
  grantOwned,
  isCosmeticOwned,
  purchaseCosmetic,
  resolveEquipped,
  type CosmeticProgression,
} from '@/cosmetics';

const T0 = 1_700_000_000_000;

const PROGRESSION: CosmeticProgression = {
  claimedAchievements: new Set(),
  claimedQuests: new Set(),
  longestStreak: 0,
};

const AZURE = getCosmeticDefinition('cos-frame-azure')!; // purchase, 150 coins
const EMERALD = getCosmeticDefinition('cos-accent-emerald')!; // purchase, 200 coins
const DEFAULT_FRAME = getCosmeticDefinition('cos-frame-default')!;
const DEFAULT_ACCENT = getCosmeticDefinition('cos-accent-indigo')!;

async function makeDb(seedBalance = 0): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  if (seedBalance !== 0) {
    await new LedgerRepository(real, () => T0).append({
      amount: seedBalance,
      reason: 'seed',
    });
  }
  return new AppDatabase(real, { now: () => T0 });
}

describe('purchaseCosmetic — crash-window recovery', () => {
  it('repairs a committed-but-ungranted purchase on retry without re-charging', async () => {
    const db = await makeDb(500);
    // Simulate the exact crash shape: the ledger debit committed under the
    // stable operationId, but the ownership grant never landed.
    await db.ledger.append({
      amount: -AZURE.price!,
      reason: 'cosmetic',
      operationId: `cosmetic:${AZURE.id}`,
    });

    const result = await purchaseCosmetic(db, AZURE, PROGRESSION);
    expect(result).toBe('already-owned');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(isCosmeticOwned(AZURE, PROGRESSION, settings)).toBe(true);
    // Charged exactly once: 500 seed − 150 price (no duplicate debit).
    expect(await db.ledger.getBalance()).toBe(350);
    expect(
      (await db.ledger.list()).filter((e) => e.reason === 'cosmetic'),
    ).toHaveLength(1);
  });

  it('insufficient-funds attempts never write entries or ownership', async () => {
    const db = await makeDb(100); // can afford neither 150 nor 200
    expect(await purchaseCosmetic(db, AZURE, PROGRESSION)).toBe('insufficient');
    expect(await purchaseCosmetic(db, EMERALD, PROGRESSION)).toBe('insufficient');
    // Retry storm changes nothing.
    expect(await purchaseCosmetic(db, AZURE, PROGRESSION)).toBe('insufficient');

    expect(await db.ledger.getBalance()).toBe(100);
    const settings = (await db.profile.get())?.settings ?? {};
    expect(isCosmeticOwned(AZURE, PROGRESSION, settings)).toBe(false);
    expect((await db.ledger.list()).filter((e) => e.amount < 0)).toHaveLength(0);
  });
});

describe('equipCosmeticPersisted — consistency', () => {
  it('sequential equips of different slots both persist (no clobbering)', async () => {
    const db = await makeDb(1000);
    await purchaseCosmetic(db, AZURE, PROGRESSION);
    await purchaseCosmetic(db, EMERALD, PROGRESSION);

    expect(await equipCosmeticPersisted(db, AZURE, PROGRESSION)).toBe(true);
    expect(await equipCosmeticPersisted(db, EMERALD, PROGRESSION)).toBe(true);

    const settings = (await db.profile.get())?.settings ?? {};
    const equipped = (settings.cosmetics as Record<string, unknown>).equipped as Record<
      string,
      string
    >;
    expect(equipped.avatarFrame).toBe('cos-frame-azure');
    expect(equipped.accent).toBe('cos-accent-emerald');
  });

  it('refuses an unowned cosmetic and leaves existing equipment intact', async () => {
    const db = await makeDb(1000);
    await purchaseCosmetic(db, AZURE, PROGRESSION);
    await equipCosmeticPersisted(db, AZURE, PROGRESSION);

    const gold = getCosmeticDefinition('cos-frame-gold')!; // achievement-locked
    expect(await equipCosmeticPersisted(db, gold, PROGRESSION)).toBe(false);

    const settings = (await db.profile.get())?.settings ?? {};
    const equipped = (settings.cosmetics as Record<string, unknown>).equipped as Record<
      string,
      string
    >;
    expect(equipped.avatarFrame).toBe('cos-frame-azure');
  });

  it('concurrent equip bursts leave consistent state (each success lands)', async () => {
    const db = await makeDb(1000);
    await purchaseCosmetic(db, AZURE, PROGRESSION);
    await purchaseCosmetic(db, EMERALD, PROGRESSION);

    const outcomes = await Promise.allSettled([
      equipCosmeticPersisted(db, AZURE, PROGRESSION),
      equipCosmeticPersisted(db, EMERALD, PROGRESSION),
    ]);
    const succeeded = outcomes.map((o) =>
      o.status === 'fulfilled' ? o.value : false,
    );

    const settings = (await db.profile.get())?.settings ?? {};
    const equipped = ((settings.cosmetics as Record<string, unknown> | undefined)?.equipped ??
      {}) as Record<string, string>;
    // Every equip that reported success must be visible in the final state.
    if (succeeded[0]) expect(equipped.avatarFrame).toBe('cos-frame-azure');
    if (succeeded[1]) expect(equipped.accent).toBe('cos-accent-emerald');
    // Ownership grants are untouched by equips.
    expect(isCosmeticOwned(AZURE, PROGRESSION, settings)).toBe(true);
    expect(isCosmeticOwned(EMERALD, PROGRESSION, settings)).toBe(true);
  });
});

describe('equipped references survive imports/wipes', () => {
  it('stale/unknown equipped ids fall back to slot defaults at resolution', () => {
    // A backup restored over a newer catalog: equipped ids that no longer
    // exist (or are no longer owned) must resolve to defaults, never leak.
    const staleSettings = {
      cosmetics: {
        owned: ['cos-frame-azure'],
        equipped: {
          avatarFrame: 'cos-frame-vanished',
          accent: 'cos-accent-emerald', // exists but NOT owned
          celebration: 'cos-celebrate-classic', // default-owned, still valid
        },
      },
    };

    const resolved = resolveEquipped(COSMETIC_DEFINITIONS, staleSettings, PROGRESSION);
    expect(resolved.avatarFrame?.id).toBe(DEFAULT_FRAME.id);
    expect(resolved.accent?.id).toBe(DEFAULT_ACCENT.id);
    expect(resolved.celebration?.id).toBe('cos-celebrate-classic');
  });

  it('garbage cosmetics blocks degrade to empty state instead of crashing', () => {
    const garbage = { cosmetics: { owned: 'yes', equipped: 'all' } };
    const resolved = resolveEquipped(COSMETIC_DEFINITIONS, garbage, PROGRESSION);
    expect(resolved.avatarFrame?.id).toBe(DEFAULT_FRAME.id);
    expect(resolved.accent?.id).toBe(DEFAULT_ACCENT.id);
  });

  it('the write path keeps working after a wipe-style settings replacement', async () => {
    const db = await makeDb(1000);
    // Simulate a replace-import: profile settings wholesale replaced with a
    // backup's block referencing unknown ids.
    await db.profile.update({
      settings: {
        cosmetics: { owned: [], equipped: { avatarFrame: 'from-old-backup' } },
      },
    });

    // Purchase + equip still function on top of the imported state.
    expect(await purchaseCosmetic(db, AZURE, PROGRESSION)).toBe('purchased');
    expect(await equipCosmeticPersisted(db, AZURE, PROGRESSION)).toBe(true);

    const settings = (await db.profile.get())?.settings ?? {};
    const resolved = resolveEquipped(COSMETIC_DEFINITIONS, settings, PROGRESSION);
    expect(resolved.avatarFrame?.id).toBe('cos-frame-azure');
  });

  it('grantOwned is idempotent and preserves other cosmetics-block keys', () => {
    const settings = { theme: 'night', cosmetics: { owned: ['a'], futureKey: 1 } };
    const once = grantOwned(settings, 'b');
    const twice = grantOwned(once, 'b');
    expect(twice).toEqual({
      theme: 'night',
      cosmetics: { owned: ['a', 'b'], futureKey: 1 },
    });
    expect(settings.cosmetics).toEqual({ owned: ['a'], futureKey: 1 }); // no mutation
  });
});
