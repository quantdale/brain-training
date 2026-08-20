import { describe, expect, it } from '@jest/globals';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { QUEST_DEFINITIONS_V1 } from '../definitions';
import { applyQuestReward, QuestNotCompleteError, toDbQuestDefinition } from '../rewards';

const T0 = 1_700_000_000_000;
const PERIOD = '2026-08-16';

async function createDb(): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

describe('applyQuestReward', () => {
  it('awards XP + coins exactly once for a completed quest', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0]; // qd3: 3 sessions, 20 xp, 5 coins
    await db.quests.upsertDefinition(toDbQuestDefinition(def));
    await db.quests.recordProgress({
      questId: def.id,
      period: PERIOD,
      progress: 3,
      completedAt: T0,
    });

    const result = await applyQuestReward(db, def, PERIOD);
    expect(result).toMatchObject({ status: 'claimed', progress: 3 });

    // XP award appended with the canonical source/reason.
    const awards = await db.xpAwards.list();
    expect(awards).toHaveLength(1);
    expect(awards[0]).toMatchObject({
      amount: 20,
      reason: 'quest',
      source: 'quest:qd3',
      createdAt: T0,
    });

    // Coins appended to the currency ledger.
    const entries = await db.ledger.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amount: 5, reason: 'quest', createdAt: T0 });

    // Claim is stamped with the db clock.
    const progress = (await db.quests.listProgressForPeriod(PERIOD))[0];
    expect(progress.claimedAt).toBe(T0);
  });

  it('is idempotent: a second call grants nothing', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));
    await db.quests.recordProgress({ questId: def.id, period: PERIOD, progress: 3, completedAt: T0 });

    const first = await applyQuestReward(db, def, PERIOD);
    expect(first.status).toBe('claimed');

    const second = await applyQuestReward(db, def, PERIOD);
    expect(second).toEqual({ status: 'already-claimed', progress: 3 });
    expect(await db.xpAwards.list()).toHaveLength(1);
    expect(await db.ledger.list()).toHaveLength(1);
  });

  it('refuses when there is no progress row for the period', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));

    await expect(applyQuestReward(db, def, PERIOD)).rejects.toBeInstanceOf(QuestNotCompleteError);
    expect(await db.xpAwards.list()).toHaveLength(0);
    expect(await db.ledger.list()).toHaveLength(0);
  });

  it('refuses when progress is recorded but completion is not stamped', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));
    await db.quests.recordProgress({ questId: def.id, period: PERIOD, progress: 3 });

    await expect(applyQuestReward(db, def, PERIOD)).rejects.toBeInstanceOf(QuestNotCompleteError);
  });

  it('refuses when the stored progress is below the criteria goal', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));
    // completedAt stamped by a buggy caller but progress never reached goal.
    await db.quests.recordProgress({ questId: def.id, period: PERIOD, progress: 2, completedAt: T0 });

    await expect(applyQuestReward(db, def, PERIOD)).rejects.toBeInstanceOf(QuestNotCompleteError);
    expect(await db.xpAwards.list()).toHaveLength(0);
    expect(await db.ledger.list()).toHaveLength(0);
  });

  it('carries questId and periodKey on the typed error', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));

    const error = await applyQuestReward(db, def, PERIOD).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuestNotCompleteError);
    expect((error as QuestNotCompleteError).questId).toBe('qd3');
    expect((error as QuestNotCompleteError).periodKey).toBe(PERIOD);
  });

  it('awards a different quest in a different period independently', async () => {
    const db = await createDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await db.quests.upsertDefinition(toDbQuestDefinition(def));

    await db.quests.recordProgress({ questId: def.id, period: PERIOD, progress: 3, completedAt: T0 });
    await db.quests.recordProgress({
      questId: def.id,
      period: '2026-08-17',
      progress: 3,
      completedAt: T0 + 1,
    });

    expect((await applyQuestReward(db, def, '2026-08-17')).status).toBe('claimed');
    expect((await applyQuestReward(db, def, PERIOD)).status).toBe('claimed');
    expect(await db.xpAwards.list()).toHaveLength(2);
    expect(await db.ledger.list()).toHaveLength(2);
  });
});

describe('toDbQuestDefinition', () => {
  it('maps the engine shape onto the db row shape', () => {
    const mapped = toDbQuestDefinition(QUEST_DEFINITIONS_V1[0]);
    expect(mapped).toMatchObject({
      id: 'qd3',
      kind: 'daily',
      title: 'Play Three Games',
      rewardXp: 20,
      rewardCurrency: 5,
      version: 1,
    });
    expect(mapped.criteria).toEqual({ type: 'session-count', goal: 3 });
  });

  it('round-trips through the quests repository', async () => {
    const db = await createDb();
    for (const def of QUEST_DEFINITIONS_V1) {
      await db.quests.upsertDefinition(toDbQuestDefinition(def));
    }
    const stored = await db.quests.listDefinitions();
    expect(stored).toHaveLength(QUEST_DEFINITIONS_V1.length);
    // Repo lists definitions ordered by id, so look up by id, not index.
    expect(stored.find((d) => d.id === 'qd3')).toMatchObject({ id: 'qd3', rewardXp: 20, rewardCurrency: 5 });
    const memory = stored.find((d) => d.id === 'qw-memory');
    expect(memory?.criteria).toEqual({ type: 'domain-sessions', domain: 'Memory', goal: 10 });
  });
});
