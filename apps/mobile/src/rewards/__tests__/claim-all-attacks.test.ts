/**
 * Engagement V2 adversarial attacks (campaign 011 / W13) — REAL databases,
 * real migrations, real triggers/indexes. Attacks the unified claim surface:
 *
 * - claimAllRewards twice → second pass is a no-op (exactly-once per reward).
 * - Interleaved single claim vs claim-all over overlapping sets → no
 *   duplication regardless of which transaction wins the BEGIN IMMEDIATE race.
 * - Crash AFTER the ledger insert inside a claim flow → full rollback (no
 *   partial state), retry succeeds.
 * - Milestone claim crash windows (settings update committed-but-unrewarded
 *   must roll back; XP-fault must roll back claimedMilestones too).
 * - Same-operationId replay (backup re-import shape): repository-level dedupe,
 *   schema-level UNIQUE rejection pinned, economy replay returns the original.
 * - Inbox aggregation when achievement + quest + milestone overlap; restart
 *   persistence of `claimedMilestones`; honest refusal when completion
 *   regresses between collect and claim.
 *
 * Invariants asserted throughout: no currency duplication, no reward loss,
 * ledger append-only preserved.
 */
import { describe, expect, it, jest } from '@jest/globals';

import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  toDbAchievementDefinition,
} from '@/achievements';
import { AppDatabase, ProfileRepository } from '@/db';
import type { SQLiteAdapter } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  QUEST_DEFINITIONS_V1,
  currentPeriodKey,
  toDbQuestDefinition,
} from '@/quests';
import { spendCurrency } from '@/db';
import { claimStreakMilestoneReward, readClaimedMilestones, STREAK_MILESTONES } from '@/streaks';
import { claimAllRewards, claimReward, collectClaimableRewards } from '../inbox';

const T0 = 1_700_000_000_000;
// Fixed LOCAL noon so SQLite DATE(completed_at,'unixepoch','localtime') lands
// on the intended calendar date on every host timezone.
const NOW = new Date(2026, 7, 21, 12, 0, 0); // Fri 2026-08-21
const TODAY = '2026-08-21';

let seq = 0;

async function makeDb(): Promise<{ db: AppDatabase; adapter: SQLiteAdapter }> {
  const adapter = await createMigratedDb();
  await new ProfileRepository(adapter, () => T0).ensureExists();
  const db = new AppDatabase(adapter, { now: () => T0 });
  return { db, adapter };
}

/** Insert one completed session whose localtime activity date is `dateStr`. */
async function seedSession(adapter: SQLiteAdapter, dateStr: string): Promise<void> {
  const [y, m, d] = dateStr.split('-').map(Number);
  const noon = new Date(y, m - 1, d, 12, 0, 0).getTime();
  seq += 1;
  await adapter.run(
    `INSERT INTO game_sessions (
       id, game_id, game_version, generator_version, scoring_version, seed,
       difficulty_json, raw_result_json, normalized_result, xp,
       started_at, completed_at, duration_ms
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `attack-${seq}-${dateStr}`,
      'memory-match',
      1,
      1,
      1,
      42,
      '{}',
      '{}',
      0.9,
      10,
      noon - 60_000,
      noon,
      60_000,
    ],
  );
}

/**
 * Seed the full overlap scenario: one unlocked-unclaimed achievement, one
 * completed-unclaimed active quest (qd3, always in the active pool), and a
 * 3-day streak reaching mil-3 — all claimable at the same instant.
 */
async function seedOverlappingClaimables(db: AppDatabase): Promise<void> {
  // Achievement: ach-first (session-count ≥ 1).
  const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
  await db.achievements.upsertDefinition(toDbAchievementDefinition(ach));
  expect(await db.achievements.unlock(ach.id)).toBe(true);

  // Quest: qd3 completed today, unclaimed.
  const quest = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
  await db.quests.upsertDefinition(toDbQuestDefinition(quest));
  await db.quests.recordProgress({
    questId: quest.id,
    period: currentPeriodKey(quest.kind, NOW),
    progress: quest.criteria.goal,
    completedAt: T0,
  });
}

/** Seed the 3 consecutive activity days (TODAY-2 .. TODAY) behind mil-3. */
async function seedThreeDayStreak(adapter: SQLiteAdapter): Promise<void> {
  const days: string[] = [];
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date(2026, 7, 21 - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    days.push(key);
  }
  for (const day of days) {
    await seedSession(adapter, day);
  }
}

describe('claimAllRewards — double-pass idempotency (overlapping kinds)', () => {
  it('claims achievement + quest + milestone exactly once, then nothing', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);

    const first = await claimAllRewards(db, NOW);
    expect(first.attempted).toBe(3);
    expect(first.claimedCount).toBe(3);

    const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
    const quest = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;
    const expectedXp = ach.rewardXp + quest.reward.xp + (mil3.rewardXp ?? 0);
    const expectedCoins = ach.rewardCurrency + quest.reward.coins + (mil3.rewardCurrency ?? 0);
    expect(first.totalXp).toBe(expectedXp);
    expect(first.totalCoins).toBe(expectedCoins);

    // Currency conservation: the balance moved by EXACTLY the reported coins.
    expect(await db.ledger.getBalance()).toBe(expectedCoins);
    // Exactly one ledger entry per reward reason — no duplication.
    const ledger = await db.ledger.list();
    expect(ledger.filter((e) => e.reason === 'achievement')).toHaveLength(1);
    expect(ledger.filter((e) => e.reason === 'quest')).toHaveLength(1);
    expect(ledger.filter((e) => e.reason === 'streak-milestone')).toHaveLength(1);
    // Exactly one XP award row per source.
    const awards = await db.xpAwards.list();
    expect(awards.filter((a) => a.source === 'achievement:ach-first')).toHaveLength(1);
    expect(awards.filter((a) => a.source === 'quest:qd3')).toHaveLength(1);
    expect(awards.filter((a) => a.source === 'milestone:mil-3')).toHaveLength(1);

    // Immediate retry: the inbox is empty and the second pass grants nothing.
    const second = await claimAllRewards(db, NOW);
    expect(second).toEqual({ attempted: 0, claimedCount: 0, totalXp: 0, totalCoins: 0 });
    expect(await db.ledger.getBalance()).toBe(expectedCoins); // unchanged
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(expectedXp); // unchanged
  });

  it('keeps the ledger append-only across both passes (UPDATE/DELETE triggers intact)', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);
    await claimAllRewards(db, NOW);

    await expect(adapter.run('UPDATE currency_ledger SET amount = 99999')).rejects.toThrow(
      /append-only/i,
    );
    await expect(adapter.run('DELETE FROM currency_ledger')).rejects.toThrow(/append-only/i);
  });
});

describe('claimAllRewards — interleaving attacks (single + claim-all)', () => {
  it('single claim racing a claim-all over overlapping sets duplicates NOTHING', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);

    // Collect BEFORE any claim so both racers target the same overlapping set.
    const items = await collectClaimableRewards(db, NOW);
    expect(items.map((i) => i.kind)).toEqual(['achievement', 'quest', 'milestone']);
    const achievementItem = items.find((i) => i.kind === 'achievement')!;

    // Fire a single-item claim and a full claim-all concurrently. The Node
    // backend serializes via BEGIN IMMEDIATE: one wins and commits, the loser
    // either reports already-claimed or is refused outright — EITHER WAY the
    // totals below must hold.
    const outcomes = await Promise.allSettled([
      claimAllRewards(db, NOW),
      claimReward(db, achievementItem, NOW),
    ]);
    // At least one racer must have made progress; neither may fabricate extra.
    expect(outcomes.length).toBe(2);

    const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
    const quest = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;
    const expectedXp = ach.rewardXp + quest.reward.xp + (mil3.rewardXp ?? 0);
    const expectedCoins = ach.rewardCurrency + quest.reward.coins + (mil3.rewardCurrency ?? 0);

    // Exactly-once per reward, regardless of interleaving outcome.
    expect(await db.ledger.getBalance()).toBe(expectedCoins);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(expectedXp);
    const ledger = await db.ledger.list();
    expect(ledger.filter((e) => e.reason === 'achievement')).toHaveLength(1);
    expect(ledger.filter((e) => e.reason === 'quest')).toHaveLength(1);
    expect(ledger.filter((e) => e.reason === 'streak-milestone')).toHaveLength(1);

    // A follow-up claim-all finds nothing left and changes nothing.
    expect(await claimAllRewards(db, NOW)).toEqual({
      attempted: 0,
      claimedCount: 0,
      totalXp: 0,
      totalCoins: 0,
    });
  });

  it('two concurrent claim-all passes still land exactly-once totals', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);

    const outcomes = await Promise.allSettled([
      claimAllRewards(db, NOW),
      claimAllRewards(db, NOW),
    ]);
    // Whatever settled, the union of both passes granted each reward once.
    const fulfilled = outcomes.filter(
      (o): o is PromiseFulfilledResult<Awaited<ReturnType<typeof claimAllRewards>>> =>
        o.status === 'fulfilled',
    );
    const unionClaimed = fulfilled.reduce((sum, o) => sum + o.value.claimedCount, 0);
    expect(unionClaimed).toBeLessThanOrEqual(3);
    expect(unionClaimed).toBeGreaterThanOrEqual(1);

    const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
    const quest = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;
    expect(await db.ledger.getBalance()).toBe(
      ach.rewardCurrency + quest.reward.coins + (mil3.rewardCurrency ?? 0),
    );

    // Drain: a third sequential pass must find the inbox empty.
    expect((await claimAllRewards(db, NOW)).attempted).toBe(0);
  });
});

describe('crash simulation — throw AFTER the ledger insert', () => {
  it('achievement claim rolls back claim marker + XP + coins when the flow dies post-insert', async () => {
    const { db } = await makeDb();
    const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-25')!;
    await db.achievements.upsertDefinition(toDbAchievementDefinition(ach));
    expect(await db.achievements.unlock(ach.id)).toBe(true);

    // Wrap the real append: the INSERT succeeds, THEN the process "crashes".
    const realAppend = db.ledger.append.bind(db.ledger);
    const spy = jest
      .spyOn(db.ledger, 'append')
      .mockImplementationOnce(async (entry, txn) => {
        await realAppend(entry, txn); // INSERT lands…
        throw new Error('crash after ledger insert'); // …then the flow dies.
      });

    await expect(claimAchievementReward(db, ach)).rejects.toThrow('crash after ledger insert');
    spy.mockRestore();

    // Transactional boundary held: NOTHING persisted.
    const unlock = await db.achievements.getUnlock(ach.id);
    expect(unlock?.claimedAt).toBeNull();
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(await db.ledger.getBalance()).toBe(0);
    expect(await db.ledger.list()).toHaveLength(0);

    // Retry claims cleanly (exactly-once overall).
    expect(await claimAchievementReward(db, ach)).toEqual({ status: 'claimed' });
    expect(await db.ledger.getBalance()).toBe(ach.rewardCurrency);
  });

  it('milestone claim rolls back claimedMilestones + rewards when the flow dies post-insert', async () => {
    const { db } = await makeDb();
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;

    const realAppend = db.ledger.append.bind(db.ledger);
    const spy = jest.spyOn(db.ledger, 'append').mockImplementationOnce(async (entry, txn) => {
      await realAppend(entry, txn);
      throw new Error('crash after milestone ledger insert');
    });

    await expect(claimStreakMilestoneReward(db, mil3, 3, NOW)).rejects.toThrow(
      'crash after milestone ledger insert',
    );
    spy.mockRestore();

    // The claimedMilestones marker rolled back WITH the awards — no
    // claimed-but-unrewarded debt, and no way to re-claim later.
    const settings = (await db.profile.get())?.settings ?? {};
    expect(readClaimedMilestones(settings)).toEqual([]);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(await db.ledger.getBalance()).toBe(0);
    expect(await db.ledger.list()).toHaveLength(0);

    expect(await claimStreakMilestoneReward(db, mil3, 3, NOW)).toBe('claimed');
    expect(await db.ledger.getBalance()).toBe(mil3.rewardCurrency ?? 0);
  });

  it('milestone claim faulting at the XP stage rolls the settings marker back too', async () => {
    const { db } = await makeDb();
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;

    const spy = jest.spyOn(db.xpAwards, 'award').mockImplementationOnce(async () => {
      throw new Error('crash at milestone xp');
    });
    await expect(claimStreakMilestoneReward(db, mil3, 3, NOW)).rejects.toThrow(
      'crash at milestone xp',
    );
    spy.mockRestore();

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readClaimedMilestones(settings)).toEqual([]);
    expect(await db.ledger.getBalance()).toBe(0);

    // Retry: full clean claim, exactly once.
    expect(await claimStreakMilestoneReward(db, mil3, 3, NOW)).toBe('claimed');
    expect(readClaimedMilestones((await db.profile.get())?.settings ?? {})).toEqual(['mil-3']);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(mil3.rewardXp ?? 0);
    expect(await db.ledger.getBalance()).toBe(mil3.rewardCurrency ?? 0);
  });
});

describe('operationId replay attacks (backup re-import shape)', () => {
  it('repository-level dedupe: replaying an operationId returns the ORIGINAL entry', async () => {
    const { db } = await makeDb();
    const original = await db.ledger.append({ amount: 50, reason: 'seed', operationId: 'op-replay' });
    const replay = await db.ledger.append({
      amount: 999_999,
      reason: 'hostile-replay',
      operationId: 'op-replay',
    });
    expect(replay.id).toBe(original.id);
    expect(replay.amount).toBe(50);
    expect(await db.ledger.list()).toHaveLength(1);
    expect(await db.ledger.getBalance()).toBe(50);
  });

  it('schema-level rejection: a raw duplicate operation_id INSERT is rejected by the unique partial index', async () => {
    const { db, adapter } = await makeDb();
    await db.ledger.append({ amount: 10, reason: 'seed', operationId: 'op-schema' });
    await expect(
      adapter.run(
        'INSERT INTO currency_ledger (amount, reason, created_at, operation_id) VALUES (?, ?, ?, ?)',
        [-5, 'duplicate-import-row', T0, 'op-schema'],
      ),
    ).rejects.toThrow(/UNIQUE|operation_id/i);
    expect(await db.ledger.list()).toHaveLength(1);
  });

  it('spendCurrency replay with the same operationId returns the original debit (never double-spends)', async () => {
    const { db } = await makeDb();
    await db.ledger.append({ amount: 100, reason: 'seed' });

    const a = await spendCurrency(db, { amount: 30, reason: 'purchase-a', operationId: 'spend-1' });
    const replay = await spendCurrency(db, {
      amount: 70, // hostile retry claims a DIFFERENT amount under the SAME key
      reason: 'purchase-a-retry',
      operationId: 'spend-1',
    });
    expect(replay.id).toBe(a.id);
    expect(replay.amount).toBe(-30); // the ORIGINAL debit, not the retry's
    expect(await db.ledger.getBalance()).toBe(70);
    expect((await db.ledger.list()).filter((e) => e.amount < 0)).toHaveLength(1);
  });
});

describe('inbox aggregation + restart persistence', () => {
  it('aggregates overlapping kinds in deterministic order with distinct keys', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);

    const items = await collectClaimableRewards(db, NOW);
    expect(items.map((i) => i.key)).toEqual([
      'achievement:ach-first',
      `quest:qd3:${currentPeriodKey('daily', NOW)}`,
      'milestone:mil-3',
    ]);

    // Deterministic: a second collect returns the identical list.
    expect(await collectClaimableRewards(db, NOW)).toEqual(items);
  });

  it('claimedMilestones persists across a restart and the drained inbox stays empty', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);
    await claimAllRewards(db, NOW);

    // "Restart": a brand-new facade over the same persisted database.
    const restarted = new AppDatabase(adapter, { now: () => T0 });
    const settings = (await restarted.profile.get())?.settings ?? {};
    expect(readClaimedMilestones(settings)).toEqual(['mil-3']);

    // Nothing is claimable anymore — no re-grant after restart.
    expect(await collectClaimableRewards(restarted, NOW)).toEqual([]);
    expect(await claimAllRewards(restarted, NOW)).toEqual({
      attempted: 0,
      claimedCount: 0,
      totalXp: 0,
      totalCoins: 0,
    });
    const ach = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
    const quest = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;
    expect(await db.ledger.getBalance()).toBe(
      ach.rewardCurrency + quest.reward.coins + (mil3.rewardCurrency ?? 0),
    );
  });

  it('refuses honestly (unavailable) when quest completion regresses between collect and claim', async () => {
    const { db, adapter } = await makeDb();
    await seedOverlappingClaimables(db);
    await seedThreeDayStreak(adapter);

    const items = await collectClaimableRewards(db, NOW);
    const questItem = items.find((i) => i.kind === 'quest')!;

    // Hostile/stale-state mutation: the stored progress drops below the goal
    // (direct SQL — the repo itself is max-monotonic by contract).
    const period = questItem.periodKey!;
    await adapter.run('UPDATE quest_progress SET progress = 1 WHERE quest_id = ? AND period = ?', [
      'qd3',
      period,
    ]);

    // Layer 1 — service refusal: the claim flow re-checks completion at claim
    // time and refuses instead of rewarding a regressed quest…
    expect(await claimReward(db, questItem, NOW)).toEqual({ status: 'unavailable' });
    // …and grants nothing anywhere.
    expect(await db.ledger.getBalance()).toBe(0);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);

    // Layer 2 — repository guard (W13 fix pin): a row whose target was never
    // reached (`completed_at IS NULL`) can never have its claim marker burned,
    // so a stale/direct caller cannot permanently destroy the future reward.
    await adapter.run(
      `INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version)
       VALUES ('qd-ghost', 'daily', 'g', 'g', '{}', 1, 1, 1)`,
    );
    await db.quests.recordProgress({ questId: 'qd-ghost', period, progress: 99 }); // no completedAt
    expect(await db.quests.claim('qd-ghost', period)).toBe(false);
    const ghostRow = (await db.quests.listProgressForPeriod(period)).find(
      (r) => r.questId === 'qd-ghost',
    );
    expect(ghostRow?.claimedAt).toBeNull();

    // Recovery: once the quest legitimately completes again, the reward is
    // still there and claims EXACTLY once.
    await adapter.run('UPDATE quest_progress SET progress = 3 WHERE quest_id = ? AND period = ?', [
      'qd3',
      period,
    ]);
    expect(await claimReward(db, questItem, NOW)).toEqual({
      status: 'claimed',
      xp: 20,
      coins: 5,
    });
    expect(await claimReward(db, questItem, NOW)).toEqual({ status: 'already-claimed' });
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(20);
  });

  it('an unreachable milestone is never claimable even if a stale client asks', async () => {
    const { db } = await makeDb();
    const mil365 = STREAK_MILESTONES.find((m) => m.id === 'mil-365')!;
    expect(await claimStreakMilestoneReward(db, mil365, 3, NOW)).toBe('not-reached');
    expect(await db.ledger.getBalance()).toBe(0);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(readClaimedMilestones((await db.profile.get())?.settings ?? {})).toEqual([]);
  });
});
