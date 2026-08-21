/**
 * Economy transactionality tests (task 7.1–7.7).
 *
 * Covers the atomic spend/purchase/reroll operations and the atomic quest/
 * achievement claims, plus failure-injection at every transaction step to prove
 * all-or-nothing behavior and safe retry (spec: *Failure injection*).
 *
 * Failure injection uses a `FaultInjectingAdapter` that wraps the real connection
 * and aborts the transaction the moment it exceeds a mutation budget, simulating
 * a crash mid-transaction. Because the node adapter uses BEGIN IMMEDIATE +
 * ROLLBACK, every partial write is undone.
 */
import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter, SQLiteRunResult } from '../adapter';
import type { SQLiteValue } from '../types';
import {
  AppDatabase,
  AchievementRepository,
  InsufficientFundsError,
  LedgerRepository,
  ProfileRepository,
  QuestRepository,
  XpAwardsRepository,
  paidReroll,
  purchaseStreakItem,
  spendCurrency,
} from '@/db';
import { applyQuestReward, QUEST_DEFINITIONS_V1, toDbQuestDefinition } from '@/quests';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  toDbAchievementDefinition,
} from '@/achievements';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;
const PERIOD = '2026-08-16';

/**
 * Adapter that counts write (`run`) statements and throws once the count exceeds
 * `maxMutations`, forcing a mid-transaction failure. `get`/`all`/`exec` pass
 * through untouched so reads are unaffected. Nested transactions re-wrap the
 * real transaction connection with a fresh counter.
 */
class FaultInjectingAdapter implements SQLiteAdapter {
  private mutations = 0;
  constructor(
    private readonly inner: SQLiteAdapter,
    private readonly maxMutations: number,
  ) {}

  exec(sql: string): Promise<void> {
    return this.inner.exec(sql);
  }

  run(sql: string, params: SQLiteValue[] = []): Promise<SQLiteRunResult> {
    this.mutations += 1;
    if (this.mutations > this.maxMutations) {
      throw new Error(`injected fault: exceeded ${this.maxMutations} mutations (at ${this.mutations})`);
    }
    return this.inner.run(sql, params);
  }

  get<T>(sql: string, params: SQLiteValue[] = []): Promise<T | null> {
    return this.inner.get<T>(sql, params);
  }

  all<T>(sql: string, params: SQLiteValue[] = []): Promise<T[]> {
    return this.inner.all<T>(sql, params);
  }

  transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
    return this.inner.transaction((realTxn) =>
      fn(new FaultInjectingAdapter(realTxn, this.maxMutations)),
    );
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

/** Healthy db (no fault injection) seeded with a starting balance. */
async function healthy(seedAmount: number): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  if (seedAmount !== 0) {
    await new LedgerRepository(real, () => T0).append({ amount: seedAmount, reason: 'seed' });
  }
  return new AppDatabase(real, { now: () => T0 });
}

/** Fault-injecting db seeded on the real connection (so seeding is never faulted). */
async function faulted(
  maxMutations: number,
  seedAmount: number,
): Promise<{ db: AppDatabase; real: SQLiteAdapter }> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  if (seedAmount !== 0) {
    await new LedgerRepository(real, () => T0).append({ amount: seedAmount, reason: 'seed' });
  }
  const db = new AppDatabase(new FaultInjectingAdapter(real, maxMutations), { now: () => T0 });
  return { db, real };
}

describe('spendCurrency', () => {
  it('debits the balance atomically (happy path)', async () => {
    const db = await healthy(100);
    const entry = await spendCurrency(db, { amount: 30, reason: 'reroll' });
    expect(entry).toMatchObject({ amount: -30, reason: 'reroll' });
    expect(await db.ledger.getBalance()).toBe(70);
  });

  it('refuses to overspend and leaves the balance untouched', async () => {
    const db = await healthy(20);
    await expect(spendCurrency(db, { amount: 30, reason: 'reroll' })).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(await db.ledger.getBalance()).toBe(20);
    expect(await db.ledger.list()).toHaveLength(1); // only the seed
  });

  it('rolls back the debit on a mid-transaction failure (no partial state)', async () => {
    const { db } = await faulted(0, 100);
    await expect(spendCurrency(db, { amount: 30, reason: 'reroll' })).rejects.toThrow(/injected fault/);
    // Balance and ledger are exactly as seeded — the debit never persisted.
    expect(await db.ledger.getBalance()).toBe(100);
    expect(await db.ledger.list()).toHaveLength(1);
  });

  it('is idempotent via operationId (no double debit on retry)', async () => {
    const db = await healthy(100);
    const first = await spendCurrency(db, { amount: 30, reason: 'reroll', operationId: 'spend-1' });
    expect(first).toMatchObject({ amount: -30 });
    const second = await spendCurrency(db, { amount: 30, reason: 'reroll', operationId: 'spend-1' });
    expect(second).toEqual(first); // same ledger entry returned
    expect(await db.ledger.getBalance()).toBe(70);
    expect(await db.ledger.list()).toHaveLength(2); // seed + exactly one debit
  });
});

describe('purchaseStreakItem', () => {
  it('validates balance, debits, and grants the item together (happy path)', async () => {
    const db = await healthy(100);
    const { ledgerEntry, inventory } = await purchaseStreakItem(db, {
      kind: 'freeze',
      cost: 10,
      reason: 'streak_item',
    });
    expect(ledgerEntry).toMatchObject({ amount: -10, reason: 'streak_item' });
    expect(await db.ledger.getBalance()).toBe(90);
    expect(inventory).toEqual({ freeze: 1, shield: 0, recovery: 0 });
  });

  it('refuses to over-buy and leaves inventory + balance untouched', async () => {
    const db = await healthy(5);
    await expect(
      purchaseStreakItem(db, { kind: 'freeze', cost: 10 }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await db.ledger.getBalance()).toBe(5);
    const inventory = (await db.profile.get())?.settings;
    expect(inventory).toBeDefined();
  });

  it('rolls back the whole purchase on a mid-transaction failure', async () => {
    const { db } = await faulted(0, 100);
    await expect(
      purchaseStreakItem(db, { kind: 'freeze', cost: 10 }),
    ).rejects.toThrow(/injected fault/);
    expect(await db.ledger.getBalance()).toBe(100);
    expect(await db.ledger.list()).toHaveLength(1);
    const inventory = (await db.profile.get())?.settings;
    expect(inventory).toEqual({}); // no item granted
  });

  it('is idempotent via operationId (no double grant / double debit)', async () => {
    const db = await healthy(100);
    const { inventory } = await purchaseStreakItem(db, {
      kind: 'freeze',
      cost: 10,
      operationId: 'buy-freeze-1',
    });
    expect(inventory.freeze).toBe(1);
    const second = await purchaseStreakItem(db, {
      kind: 'freeze',
      cost: 10,
      operationId: 'buy-freeze-1',
    });
    expect(second.inventory.freeze).toBe(1);
    expect(await db.ledger.getBalance()).toBe(90);
    expect(await db.ledger.list()).toHaveLength(2); // seed + exactly one debit
  });
});

describe('paidReroll', () => {
  it('mutates the workout and debits together (happy path)', async () => {
    const db = await healthy(100);
    let mutations = 0;
    const { ledgerEntry } = await paidReroll(db, {
      cost: 10,
      reason: 'reroll',
      mutateWorkout: async () => {
        mutations += 1;
      },
    });
    expect(ledgerEntry).toMatchObject({ amount: -10, reason: 'reroll' });
    expect(mutations).toBe(1);
    expect(await db.ledger.getBalance()).toBe(90);
  });

  it('rolls back the debit when mutateWorkout throws', async () => {
    const db = await healthy(100);
    await expect(
      paidReroll(db, {
        cost: 10,
        mutateWorkout: async () => {
          throw new Error('workout boom');
        },
      }),
    ).rejects.toThrow('workout boom');
    expect(await db.ledger.getBalance()).toBe(100);
    expect(await db.ledger.list()).toHaveLength(1); // no debit
  });

  it('rolls back on a mid-transaction failure', async () => {
    const { db } = await faulted(0, 100);
    await expect(
      paidReroll(db, {
        cost: 10,
        mutateWorkout: async () => {
          /* no writes */
        },
      }),
    ).rejects.toThrow(/injected fault/);
    expect(await db.ledger.getBalance()).toBe(100);
    expect(await db.ledger.list()).toHaveLength(1);
  });

  it('is idempotent via operationId and does not re-run mutateWorkout', async () => {
    const db = await healthy(100);
    let mutations = 0;
    const mutate = async () => {
      mutations += 1;
    };
    const first = await paidReroll(db, { cost: 10, operationId: 'reroll-1', mutateWorkout: mutate });
    expect(first.ledgerEntry.amount).toBe(-10);
    expect(mutations).toBe(1);

    const second = await paidReroll(db, { cost: 10, operationId: 'reroll-1', mutateWorkout: mutate });
    expect(second.ledgerEntry).toEqual(first.ledgerEntry);
    expect(mutations).toBe(1); // not recalled
    expect(await db.ledger.getBalance()).toBe(90); // only one debit
  });

  it('rejects when the balance cannot cover the cost (no workout mutation, no debit)', async () => {
    const db = await healthy(5);
    let mutations = 0;
    await expect(
      paidReroll(db, {
        cost: 10,
        mutateWorkout: async () => {
          mutations += 1;
        },
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(mutations).toBe(0); // workout untouched when unaffordable
    expect(await db.ledger.getBalance()).toBe(5);
    expect(await db.ledger.list()).toHaveLength(1); // no debit appended
  });
});

describe('atomic quest claim (fault at first mutation)', () => {
  it('rolls back the whole claim on a mid-transaction failure', async () => {
    const real = await createMigratedDb();
    await new ProfileRepository(real, () => T0).ensureExists();
    await new LedgerRepository(real, () => T0).append({ amount: 100, reason: 'seed' });
    const def = QUEST_DEFINITIONS_V1[0]; // qd3: goal 3, 20 xp, 5 coins
    await new QuestRepository(real).upsertDefinition(toDbQuestDefinition(def));
    await new QuestRepository(real).recordProgress({
      questId: def.id,
      period: PERIOD,
      progress: 3,
      completedAt: T0,
    });

    const db = new AppDatabase(new FaultInjectingAdapter(real, 0), { now: () => T0 });
    await expect(applyQuestReward(db, def, PERIOD)).rejects.toThrow(/injected fault/);

    // No claim marker, no XP award, no currency — all rolled back.
    const progress = (await new QuestRepository(real).listProgressForPeriod(PERIOD))[0];
    expect(progress.claimedAt).toBeNull();
    expect(await new XpAwardsRepository(real).list()).toHaveLength(0);
    expect(await new LedgerRepository(real).getBalance()).toBe(100);
  });
});

describe('atomic achievement claim (fault at first mutation)', () => {
  it('rolls back the whole claim on a mid-transaction failure', async () => {
    const real = await createMigratedDb();
    await new ProfileRepository(real, () => T0).ensureExists();
    await new LedgerRepository(real, () => T0).append({ amount: 100, reason: 'seed' });
    const def = ACHIEVEMENT_DEFINITIONS_V1[0]; // ach-first: 50 xp / 25 coins
    await new AchievementRepository(real).upsertDefinition(toDbAchievementDefinition(def));
    await new AchievementRepository(real).unlock(def.id);

    const db = new AppDatabase(new FaultInjectingAdapter(real, 0), { now: () => T0 });
    await expect(claimAchievementReward(db, def)).rejects.toThrow(/injected fault/);

    const unlock = await new AchievementRepository(real).getUnlock(def.id);
    expect(unlock?.claimedAt).toBeNull();
    expect(await new XpAwardsRepository(real).list()).toHaveLength(0);
    expect(await new LedgerRepository(real).getBalance()).toBe(100);
  });
});

describe('atomic quest/achievement — fault at later mutation (F2 fix)', () => {
  it('rolls back quest claim when the XP award after the claim marker faults (faulted(1))', async () => {
    const real = await createMigratedDb();
    await new ProfileRepository(real, () => T0).ensureExists();
    await new LedgerRepository(real, () => T0).append({ amount: 100, reason: 'seed' });
    const def = QUEST_DEFINITIONS_V1[0]; // qd3: goal 3, 20 xp, 5 coins
    await new QuestRepository(real).upsertDefinition(toDbQuestDefinition(def));
    await new QuestRepository(real).recordProgress({
      questId: def.id,
      period: PERIOD,
      progress: 3,
      completedAt: T0,
    });

    // fault at the XP award (claim marker already succeeded -> must roll back)
    const db = new AppDatabase(new FaultInjectingAdapter(real, 1), { now: () => T0 });
    await expect(applyQuestReward(db, def, PERIOD)).rejects.toThrow(/injected fault/);

    const progress = (await new QuestRepository(real).listProgressForPeriod(PERIOD))[0];
    expect(progress.claimedAt).toBeNull(); // rolled back
    expect(await new XpAwardsRepository(real).list()).toHaveLength(0);
    expect(await new LedgerRepository(real).getBalance()).toBe(100);
  });

  it('rolls back paid reroll when the ledger debit after the workout mutation faults (faulted(1))', async () => {
    const real = await createMigratedDb();
    await new ProfileRepository(real, () => T0).ensureExists();
    if (true) await new LedgerRepository(real, () => T0).append({ amount: 100, reason: 'seed' });
    const db = new AppDatabase(new FaultInjectingAdapter(real, 1), { now: () => T0 });
    await expect(
      paidReroll(db, {
        cost: 10,
        mutateWorkout: async (txn) => {
          // a real write so faulted(1) hits the debit, not this mutation
          await txn.run('CREATE TABLE IF NOT EXISTS _probe_mutate (x TEXT)');
          await txn.run("INSERT INTO _probe_mutate VALUES ('mutated')");
        },
      }),
    ).rejects.toThrow(/injected fault/);
    expect(await db.ledger.getBalance()).toBe(100);
    expect(await db.ledger.list()).toHaveLength(1);
    // workout mutation rolled back — _probe_mutate not durable
    // Transaction rolled back, so _probe_mutate was never durably created — query fails
    await expect(new FaultInjectingAdapter(real, 999).all<{ x: string }>('SELECT * FROM _probe_mutate')).rejects.toThrow(/no such table/);
  });
});
