/**
 * Cosmetic economy (engagement-cosmetics wave). The only cosmetics code that
 * touches the db.
 *
 * Purchasing a cosmetic is an atomic, idempotent spend of NORMAL earned
 * currency (constitution §17 — never real money, never pay-to-win): the
 * balance check, the ledger debit, and the owned-flag grant all commit inside
 * one `db.transaction`, and an `operationId` makes a retried purchase return
 * the original result instead of double-charging or double-granting.
 *
 * Equipping is a free, idempotent settings update (only allowed for owned
 * cosmetics).
 */
import type { AppDatabase } from '@/db';
import { InsufficientFundsError } from '@/db';
import { equipCosmetic, grantOwned, isCosmeticOwned } from './state';
import type { CosmeticDef, CosmeticProgression } from './types';

export type PurchaseCosmeticResult =
  | 'purchased'
  | 'already-owned'
  | 'insufficient'
  | 'not-purchasable';

/**
 * Purchase a cosmetic with normal earned currency. Idempotent via
 * `operationId: "cosmetic:<id>"`: a retried call returns `already-owned`
 * (granting nothing extra) regardless of whether the first attempt committed.
 */
export async function purchaseCosmetic(
  db: AppDatabase,
  def: CosmeticDef,
  progression: CosmeticProgression,
): Promise<PurchaseCosmeticResult> {
  if (def.unlock.type !== 'purchase') {
    return 'not-purchasable';
  }
  const price = def.price ?? 0;

  // Fast path: already owned (no charge). Avoids a needless transaction.
  const settings0 = (await db.profile.get())?.settings ?? {};
  if (isCosmeticOwned(def, progression, settings0)) {
    return 'already-owned';
  }

  const operationId = `cosmetic:${def.id}`;
  try {
    return await db.transaction(async (txn) => {
      // Idempotency: a prior purchase already debited under this id.
      const existing = await db.ledger.getByOperation(operationId, txn);
      const profile = await db.profile.get(txn);
      if (existing) {
        const settings = profile?.settings ?? {};
        if (!isCosmeticOwned(def, progression, settings)) {
          await db.profile.update({ settings: grantOwned(settings, def.id) }, txn);
        }
        return 'already-owned' as const;
      }
      const balance = await db.ledger.getBalance(txn);
      if (balance < price) {
        throw new InsufficientFundsError(price, balance);
      }
      await db.ledger.append({ amount: -price, reason: 'cosmetic', operationId }, txn);
      const next = grantOwned(profile?.settings ?? {}, def.id);
      await db.profile.update({ settings: next }, txn);
      return 'purchased' as const;
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return 'insufficient';
    }
    throw error;
  }
}

/**
 * Equip an owned cosmetic. No-op (returns false) when the cosmetic is not
 * owned. Free and idempotent — equipping never touches currency.
 */
export async function equipCosmeticPersisted(
  db: AppDatabase,
  def: CosmeticDef,
  progression: CosmeticProgression,
): Promise<boolean> {
  const settings = (await db.profile.get())?.settings ?? {};
  if (!isCosmeticOwned(def, progression, settings)) {
    return false;
  }
  await db.profile.update({ settings: equipCosmetic(settings, def.slot, def.id) });
  return true;
}
