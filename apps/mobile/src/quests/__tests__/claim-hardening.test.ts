/**
 * Quest claim hardening (campaign 009 W08): transactionality, idempotency and
 * rollback of reward claims, plus evaluation correctness over large histories.
 *
 * Contracts under test:
 * - The ledger entry carries a stable, PERIOD-SCOPED `operationId`
 *   (`quest:<id>:<period>`, unique by partial index) so a retried claim or a
 *   repeated backup merge can never double-append one period's reward.
 * - A failure inside the claim transaction rolls back the claim marker, the
 *   XP award, and the currency entry together.
 * - Concurrent/duplicate claim attempts grant at most one reward per period,
 *   while different periods still claim independently.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { QUEST_DEFINITIONS_V1 } from '../definitions';
import { evaluateQuests, type QuestSessionSample } from '../evaluate';
import { applyQuestReward, toDbQuestDefinition } from '../rewards';
import type { QuestRewardResult } from '../rewards';

const T0 = 1_700_000_000_000;
const PERIOD = '2026-08-16';

async function makeDb(): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

/** Seed `def` as completed (progress at goal) for `period`. */
async function seedCompleted(
  db: AppDatabase,
  def: (typeof QUEST_DEFINITIONS_V1)[number],
  period: string = PERIOD,
): Promise<void> {
  await db.quests.upsertDefinition(toDbQuestDefinition(def));
  await db.quests.recordProgress({
    questId: def.id,
    period,
    progress: def.criteria.goal,
    completedAt: T0,
  });
}

describe('applyQuestReward — transactionality', () => {
  it('stamps the ledger entry with the period-scoped operationId', async () => {
    const db = await makeDb();
    const def = QUEST_DEFINITIONS_V1[0]; // qd3
    await seedCompleted(db, def);

    const result = await applyQuestReward(db, def, PERIOD);
    expect(result.status).toBe('claimed');

    const entry = await db.ledger.getByOperation(`quest:${def.id}:${PERIOD}`);
    expect(entry).not.toBeNull();
    expect(entry?.amount).toBe(def.reward.coins);
  });

  it('different periods of the same quest get distinct operationIds', async () => {
    const db = await makeDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await seedCompleted(db, def, PERIOD);
    await seedCompleted(db, def, '2026-08-17');

    expect((await applyQuestReward(db, def, PERIOD)).status).toBe('claimed');
    expect((await applyQuestReward(db, def, '2026-08-17')).status).toBe('claimed');

    expect(await db.ledger.getByOperation(`quest:${def.id}:${PERIOD}`)).not.toBeNull();
    expect(await db.ledger.getByOperation(`quest:${def.id}:2026-08-17`)).not.toBeNull();
    expect(await db.ledger.getBalance()).toBe(def.reward.coins * 2);
  });

  it('rolls back claim + XP + currency atomically when the ledger append fails', async () => {
    const db = await makeDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await seedCompleted(db, def);

    const spy = jest
      .spyOn(db.ledger, 'append')
      .mockImplementationOnce(async () => {
        throw new Error('simulated crash mid-claim');
      });
    await expect(applyQuestReward(db, def, PERIOD)).rejects.toThrow('simulated crash mid-claim');
    spy.mockRestore();

    // Nothing committed — the claim marker rolled back with the awards.
    const row = (await db.quests.listProgressForPeriod(PERIOD)).find((r) => r.questId === def.id);
    expect(row?.claimedAt).toBeNull();
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(await db.ledger.getBalance()).toBe(0);

    // Retry succeeds cleanly.
    expect(await applyQuestReward(db, def, PERIOD)).toMatchObject({
      status: 'claimed',
      progress: def.criteria.goal,
    });
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(def.reward.xp);
  });

  it('rolls back cleanly when the XP award fails before the ledger append', async () => {
    const db = await makeDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await seedCompleted(db, def);

    const spy = jest
      .spyOn(db.xpAwards, 'award')
      .mockImplementationOnce(async () => {
        throw new Error('simulated crash at xp');
      });
    await expect(applyQuestReward(db, def, PERIOD)).rejects.toThrow('simulated crash at xp');
    spy.mockRestore();

    const row = (await db.quests.listProgressForPeriod(PERIOD)).find((r) => r.questId === def.id);
    expect(row?.claimedAt).toBeNull();
    expect(await db.ledger.getBalance()).toBe(0);
  });

  it('duplicate/concurrent claims can never double-grant one period', async () => {
    const db = await makeDb();
    const def = QUEST_DEFINITIONS_V1[0];
    await seedCompleted(db, def);

    // Sequential retry.
    expect((await applyQuestReward(db, def, PERIOD)).status).toBe('claimed');
    expect((await applyQuestReward(db, def, PERIOD))).toEqual({
      status: 'already-claimed',
      progress: def.criteria.goal,
    });

    // Concurrent burst (double tap): whatever settles, exactly one grant.
    const burst = await Promise.allSettled([
      applyQuestReward(db, def, PERIOD),
      applyQuestReward(db, def, PERIOD),
    ]);
    const fulfilled = burst.filter(
      (o): o is PromiseFulfilledResult<QuestRewardResult> => o.status === 'fulfilled',
    );
    expect(fulfilled.every((o) => o.value.status === 'already-claimed')).toBe(true);

    expect(await db.xpAwards.getTotalAwardedXp()).toBe(def.reward.xp);
    expect((await db.ledger.list()).filter((e) => e.reason === 'quest')).toHaveLength(1);
  });
});

describe('quest evaluation over large histories', () => {
  it('counts correctly in a 20,000-session snapshot without period bleed', () => {
    const todayMs = new Date(2026, 7, 16, 12, 0, 0).getTime();
    const DAY = 86_400_000;
    const sessions: QuestSessionSample[] = [];
    // 20k sessions spread over ~5.5 years of history, all Memory domain. The
    // closest historical session is 14 days back, so NOTHING bleeds into the
    // current daily/weekly periods except the explicit "today" entries below.
    for (let i = 0; i < 20_000; i += 1) {
      sessions.push({
        completedAt: todayMs - ((i % 2000) + 14) * DAY,
        gameId: 'memory',
        domain: 'Memory',
        xp: 10,
      });
    }
    // Exactly three sessions TODAY.
    for (let i = 0; i < 3; i += 1) {
      sessions.push({ completedAt: todayMs, gameId: 'memory', domain: 'Memory', xp: 40 });
    }

    const now = new Date(todayMs);
    const evals = new Map(
      evaluateQuests(QUEST_DEFINITIONS_V1, { sessions }, now).map((e) => [e.questId, e]),
    );

    // Daily session-count quest (qd3, goal 3): only today's 3 count out of 20k.
    expect(evals.get('qd3')).toMatchObject({ progress: 3, completed: true });
    // Daily XP quest (qdx, goal 100): only today's 3 × 40 XP = 120 counts.
    expect(evals.get('qdx')).toMatchObject({ progress: 120, completed: true });
    // Longterm session-count quest (qt100, goal 100): whole history counts.
    expect(evals.get('qt100')?.completed).toBe(true);
    // Weekly memory quest sees only this ISO week's slice (today's 3), never
    // the full 20k history.
    expect(evals.get('qw-memory')).toMatchObject({ progress: 3, completed: false });
  });

  it('is deterministic across repeated large evaluations', () => {
    const now = new Date(2026, 7, 16, 12, 0, 0);
    const sessions: QuestSessionSample[] = Array.from({ length: 5000 }, (_, i) => ({
      completedAt: now.getTime() - (i % 30) * 86_400_000,
      gameId: `game-${i % 12}`,
      domain: 'Math',
      xp: 5,
    }));
    const a = evaluateQuests(QUEST_DEFINITIONS_V1, { sessions }, now);
    const b = evaluateQuests(QUEST_DEFINITIONS_V1, { sessions }, now);
    expect(a).toEqual(b);
  });
});
