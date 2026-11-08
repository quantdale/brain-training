/**
 * A quest goal reached shortly before a period rolled over must still be
 * earned when the next sync happens after the rollover (the player killed the
 * app, or stayed on results past midnight). `rewards/inbox.ts` owns the
 * intent: "Rotation ... must never make an already-earned reward unreachable."
 */
import { beforeAll, describe, expect, it } from '@jest/globals';

import { AppDatabase, type CompleteSessionInput } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { initializeProgression, syncQuestProgress } from '@/progression';
import {
  QUEST_DEFINITIONS_V1,
  applyQuestReward,
  currentPeriodKey,
  selectActiveQuests,
} from '@/quests';
import { registerGameDefinitions } from '@/registry/registry';
import { registry } from '@/registry/registry.generated';
import { collectClaimableRewards } from '@/rewards/inbox';

const local = (m: number, d: number, h = 12, min = 0) => new Date(2026, m - 1, d, h, min);

async function makeDb(now: Date) {
  const adapter = await createMigratedDb();
  const db = new AppDatabase(adapter, { now: () => now.getTime() });
  await initializeProgression(db, now);
  return db;
}

let nextId = 0;
async function playAt(
  db: AppDatabase,
  at: Date,
  overrides: Partial<CompleteSessionInput['session']> = {},
): Promise<void> {
  nextId += 1;
  await db.sessions.completeSession({
    session: {
      id: `rollover-${nextId}`,
      gameId: 'memory',
      gameVersion: 1000000,
      generatorVersion: 1000000,
      scoringVersion: 1000000,
      seed: 42,
      difficulty: { mode: 'normal' },
      rawResult: { score: 10, accuracy: 1 },
      normalizedResult: 0.8,
      xp: 10,
      startedAt: at.getTime() - 60_000,
      completedAt: at.getTime(),
      durationMs: 60_000,
      ...overrides,
    },
  });
}

async function questRow(db: AppDatabase, questId: string, period: string) {
  const rows = await db.quests.listProgressForPeriod(period);
  return rows.find((row) => row.questId === questId) ?? null;
}

describe('syncQuestProgress rollover catch-up', () => {
  // Domain quests map a game to its category through the registry, which app
  // bootstrap fills in production.
  beforeAll(() => {
    registerGameDefinitions(registry);
  });

  it('records and offers a daily quest whose goal was reached before midnight', async () => {
    const afterMidnight = local(8, 17, 0, 5);
    const db = await makeDb(afterMidnight);
    await playAt(db, local(8, 16, 23, 50));
    await playAt(db, local(8, 16, 23, 54));
    await playAt(db, local(8, 16, 23, 58));

    await syncQuestProgress(db, afterMidnight);

    const row = await questRow(db, 'qd3', '2026-08-16');
    expect(row).toMatchObject({ progress: 3, claimedAt: null });
    // Stamped inside the earned period, by the session that finished it.
    expect(row?.completedAt).toBe(local(8, 16, 23, 58).getTime());
    const inbox = await collectClaimableRewards(db, afterMidnight);
    expect(inbox.map((item) => item.key)).toContain('quest:qd3:2026-08-16');
  });

  it('lets the caught-up quest be claimed exactly once', async () => {
    const afterMidnight = local(8, 17, 0, 5);
    const db = await makeDb(afterMidnight);
    for (const min of [50, 54, 58]) await playAt(db, local(8, 16, 23, min));
    await syncQuestProgress(db, afterMidnight);

    const qd3 = QUEST_DEFINITIONS_V1.find((quest) => quest.id === 'qd3')!;
    await applyQuestReward(db, qd3, '2026-08-16', afterMidnight);
    await syncQuestProgress(db, afterMidnight);

    expect((await questRow(db, 'qd3', '2026-08-16'))?.claimedAt).not.toBeNull();
    const inbox = await collectClaimableRewards(db, afterMidnight);
    expect(inbox.map((item) => item.key)).not.toContain('quest:qd3:2026-08-16');
  });

  it('records a weekly quest whose goal was reached before the week ended', async () => {
    const monday = local(8, 17, 8);
    const db = await makeDb(monday);
    for (let n = 0; n < 10; n += 1) await playAt(db, local(8, 16, 20, n));

    await syncQuestProgress(db, monday);

    expect((await questRow(db, 'qw-memory', '2026-W33'))?.completedAt).toBe(
      local(8, 16, 20, 9).getTime(),
    );
  });

  it('counts a session after midnight only for the new day', async () => {
    const afterMidnight = local(8, 17, 0, 5);
    const db = await makeDb(afterMidnight);
    await playAt(db, local(8, 16, 23, 58));
    await playAt(db, local(8, 17, 0, 1));

    await syncQuestProgress(db, afterMidnight);

    expect(await questRow(db, 'qd3', '2026-08-16')).toBeNull();
    expect((await questRow(db, 'qd3', '2026-08-17'))?.progress).toBe(1);
  });

  it('writes nothing for a past period whose goal was not reached', async () => {
    const next = local(8, 17, 9);
    const db = await makeDb(next);
    await playAt(db, local(8, 16, 12));

    await syncQuestProgress(db, next);

    expect(await db.quests.listProgressForPeriod('2026-08-16')).toEqual([]);
  });

  it('keeps the first completion stamp across repeated syncs', async () => {
    const afterMidnight = local(8, 17, 0, 5);
    const db = await makeDb(afterMidnight);
    for (const min of [50, 54, 58]) await playAt(db, local(8, 16, 23, min));

    await syncQuestProgress(db, afterMidnight);
    const first = await questRow(db, 'qd3', '2026-08-16');
    await syncQuestProgress(db, local(8, 17, 15));

    expect(await questRow(db, 'qd3', '2026-08-16')).toEqual(first);
  });

  it('only backfills quests that were active in that past period', async () => {
    const next = local(8, 17, 9);
    const day = local(8, 16, 18);
    const db = await makeDb(next);
    for (let n = 0; n < 20; n += 1) await playAt(db, new Date(day.getTime() + n * 60_000));

    await syncQuestProgress(db, next);

    const activeThen = new Set(
      selectActiveQuests(QUEST_DEFINITIONS_V1, day)
        .filter((quest) => quest.kind === 'daily')
        .map((quest) => quest.id),
    );
    const rows = await db.quests.listProgressForPeriod('2026-08-16');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(activeThen.has(row.questId)).toBe(true);
  });

  it('bounds the catch-up to the most recent active days', async () => {
    const now = local(8, 30, 9);
    const db = await makeDb(now);
    // Nine earlier active days, every one meeting the goal.
    for (let day = 21; day <= 29; day += 1) {
      for (const min of [1, 2, 3]) await playAt(db, local(8, day, 12, min));
    }

    await syncQuestProgress(db, now);

    expect((await questRow(db, 'qd3', '2026-08-23'))?.completedAt).not.toBeNull();
    expect(await questRow(db, 'qd3', '2026-08-22')).toBeNull();
  });

  it('still records the current period as before', async () => {
    const now = local(8, 16, 18);
    const db = await makeDb(now);
    for (const min of [1, 2, 3]) await playAt(db, local(8, 16, 12, min));

    await syncQuestProgress(db, now);

    expect(await questRow(db, 'qd3', currentPeriodKey('daily', now))).toMatchObject({
      progress: 3,
      completedAt: now.getTime(),
    });
  });
});
