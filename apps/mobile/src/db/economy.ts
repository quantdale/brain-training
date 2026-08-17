/**
 * Economy service (task 7.1–7.5): the single place where currency is spent,
 * streak items are purchased, and paid rerolls are applied. Every operation is
 * wrapped in one `db.transaction` so all of its writes commit together or roll
 * back as one (spec: *Spending is balance-safe and atomic*, *Streak-item
 * purchase is atomic*, *Paid reroll is atomic*).
 *
 * Idempotency (spec: *Stable operation identity*) is provided by an optional
 * `operationId`. Each operation checks the ledger for an entry already committed
 * under that key before doing any write and, when found, returns the original
 * result without re-applying side effects — so a retried caller (after an
 * uncertain failure or duplicate request) can never double-spend, double-grant,
 * or double-mutate workout state.
 */

import type { SQLiteAdapter } from './adapter';
import type { AppDatabase, LedgerEntry } from './index';
import { grantItems, readInventory } from '../streaks/inventory';
import type { StreakInventory, StreakItemKind } from '../streaks/types';

/** Thrown when a spend/purchase/reroll would drive the balance below zero. */
export class InsufficientFundsError extends Error {
  readonly required: number;
  readonly available: number;
  constructor(required: number, available: number) {
    super(`insufficient currency: need ${required}, have ${available}`);
    this.name = 'InsufficientFundsError';
    this.required = required;
    this.available = available;
  }
}

/** Inputs for {@link spendCurrency}. */
export interface SpendInput {
  /** Positive amount of currency to spend (the entry is stored as `-amount`). */
  amount: number;
  /** Human-readable reason, also stored on the ledger entry. */
  reason: string;
  /** Optional session the spend is attributed to. */
  sessionId?: string | null;
  /** Idempotency key: a prior spend with this id returns the original entry. */
  operationId?: string | null;
}

/** Inputs for {@link purchaseStreakItem}. */
export interface PurchaseStreakItemInput {
  /** Which streak item to grant (freeze/shield/recovery). */
  kind: StreakItemKind;
  /** Positive currency cost (stored as `-cost`). */
  cost: number;
  /** Ledger reason; defaults to `'streak_item'`. */
  reason?: string;
  /** Idempotency key: a prior purchase with this id returns the original entry. */
  operationId?: string | null;
}

/** Inputs for {@link paidReroll}. */
export interface PaidRerollInput {
  /** Positive currency cost (stored as `-cost`). */
  cost: number;
  /** Ledger reason; defaults to `'reroll'`. */
  reason?: string;
  /** Idempotency key: a prior reroll with this id returns the original entry. */
  operationId?: string | null;
  /**
   * Mutates the workout state inside the same transaction as the debit. Called
   * with the transaction connection so its writes commit atomically with the
   * currency spend. A throw here rolls back the whole operation (no debit).
   */
  mutateWorkout: (txn: SQLiteAdapter) => Promise<void>;
}

/**
 * Spend currency atomically. The current ledger-derived balance is checked and
 * the debit is appended in the same transaction; a successful call never yields
 * a negative balance. With a fresh `operationId` an already-committed spend is
 * returned instead of being applied twice.
 */
export async function spendCurrency(db: AppDatabase, input: SpendInput): Promise<LedgerEntry> {
  return db.transaction(async (txn) => {
    if (input.operationId) {
      const existing = await db.ledger.getByOperation(input.operationId, txn);
      if (existing) {
        return existing;
      }
    }
    const balance = await db.ledger.getBalance(txn);
    if (balance < input.amount) {
      throw new InsufficientFundsError(input.amount, balance);
    }
    return db.ledger.append(
      {
        amount: -input.amount,
        reason: input.reason,
        sessionId: input.sessionId ?? null,
        operationId: input.operationId ?? null,
      },
      txn,
    );
  });
}

/**
 * Purchase a streak item atomically: balance validation + debit + inventory
 * grant all happen in one transaction. Returns the ledger entry and the new
 * inventory. With a fresh `operationId` a prior purchase is returned without
 * re-granting or re-debiting.
 */
export async function purchaseStreakItem(
  db: AppDatabase,
  input: PurchaseStreakItemInput,
): Promise<{ ledgerEntry: LedgerEntry; inventory: StreakInventory }> {
  const reason = input.reason ?? 'streak_item';
  return db.transaction(async (txn) => {
    if (input.operationId) {
      const existing = await db.ledger.getByOperation(input.operationId, txn);
      if (existing) {
        const settings = (await db.profile.get(txn))?.settings ?? {};
        return { ledgerEntry: existing, inventory: readInventory(settings) };
      }
    }
    const balance = await db.ledger.getBalance(txn);
    if (balance < input.cost) {
      throw new InsufficientFundsError(input.cost, balance);
    }
    const profile = await db.profile.get(txn);
    const settings = profile?.settings ?? {};
    const nextSettings = grantItems(settings, { [input.kind]: 1 });
    await db.profile.update({ settings: nextSettings }, txn);
    const ledgerEntry = await db.ledger.append(
      { amount: -input.cost, reason, operationId: input.operationId ?? null },
      txn,
    );
    return { ledgerEntry, inventory: readInventory(nextSettings) };
  });
}

/**
 * Apply a paid workout reroll atomically with its currency debit. `mutateWorkout`
 * runs inside the same transaction as the spend, so either both the workout
 * transition and the debit commit or neither does. With a fresh `operationId` a
 * prior reroll is returned without re-invoking `mutateWorkout` or re-debiting.
 */
export async function paidReroll(
  db: AppDatabase,
  input: PaidRerollInput,
): Promise<{ ledgerEntry: LedgerEntry }> {
  const reason = input.reason ?? 'reroll';
  return db.transaction(async (txn) => {
    if (input.operationId) {
      const existing = await db.ledger.getByOperation(input.operationId, txn);
      if (existing) {
        return { ledgerEntry: existing };
      }
    }
    await input.mutateWorkout(txn);
    const ledgerEntry = await db.ledger.append(
      { amount: -input.cost, reason, operationId: input.operationId ?? null },
      txn,
    );
    return { ledgerEntry };
  });
}
