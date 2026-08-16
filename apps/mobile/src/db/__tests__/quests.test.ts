import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '../adapter';
import { AchievementRepository } from '../achievements';
import { QuestRepository } from '../quests';
import { XpAwardsRepository } from '../xp-awards';
import { createMigratedDb } from './helpers';

const T0 = 1_700_000_000_000;

describe('XpAwardsRepository', () => {
  it('awards XP and sums it; rejects non-positive amounts', async () => {
    const adapter = await createMigratedDb();
    const xp = new XpAwardsRepository(adapter, () => T0);

    expect(await xp.getTotalAwardedXp()).toBe(0);
    await xp.award(50, 'quest reward', 'quest:play-three');
    await xp.award(25, 'achievement', 'achievement:first-session');

    expect(await xp.getTotalAwardedXp()).toBe(75);
    const list = await xp.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ amount: 25, source: 'achievement:first-session', createdAt: T0 });

    await expect(xp.award(0, 'nope', 'system')).rejects.toThrow(/positive integer/);
    await expect(xp.award(-5, 'nope', 'system')).rejects.toThrow(/positive integer/);
  });

  it('is append-only: UPDATE and DELETE are rejected', async () => {
    const adapter = await createMigratedDb();
    const xp = new XpAwardsRepository(adapter, () => T0);
    const award = await xp.award(10, 'test', 'system');

    await expect(
      adapter.run('UPDATE xp_awards SET amount = 99 WHERE id = ?', [award.id]),
    ).rejects.toThrow(/append-only/);
    await expect(adapter.run('DELETE FROM xp_awards WHERE id = ?', [award.id])).rejects.toThrow(
      /append-only/,
    );
    expect(await xp.getTotalAwardedXp()).toBe(10);
  });
});

describe('QuestRepository', () => {
  it('upserts definitions and lists them with criteria round-tripped', async () => {
    const adapter = await createMigratedDb();
    const quests = new QuestRepository(adapter, () => T0);

    await quests.upsertDefinition({
      id: 'play-three',
      kind: 'daily',
      title: 'Play three games',
      description: 'Complete three sessions today.',
      criteria: { type: 'session-count', target: 3, scope: 'day' },
      rewardXp: 40,
      rewardCurrency: 5,
      version: 1,
    });
    await quests.upsertDefinition({
      id: 'play-three',
      kind: 'daily',
      title: 'Play three games',
      description: 'Complete three sessions today.',
      criteria: { type: 'session-count', target: 3, scope: 'day' },
      rewardXp: 40,
      rewardCurrency: 5,
      version: 2,
    });

    const definitions = await quests.listDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      id: 'play-three',
      kind: 'daily',
      rewardXp: 40,
      version: 2,
    });
    expect(definitions[0].criteria).toEqual({ type: 'session-count', target: 3, scope: 'day' });
  });

  it('records monotonic progress per period and sticks completion', async () => {
    const adapter = await createMigratedDb();
    const quests = new QuestRepository(adapter, () => T0);
    await quests.upsertDefinition({
      id: 'play-three',
      kind: 'daily',
      title: 'Play three games',
      description: 'Complete three sessions today.',
      criteria: { type: 'session-count', target: 3 },
      rewardXp: 40,
      rewardCurrency: 5,
      version: 1,
    });

    await quests.recordProgress({ questId: 'play-three', period: '2026-08-16', progress: 1 });
    await quests.recordProgress({ questId: 'play-three', period: '2026-08-16', progress: 2 });
    // Regression below the stored value must not reduce it.
    await quests.recordProgress({ questId: 'play-three', period: '2026-08-16', progress: 1 });

    const row = (await quests.listProgressForPeriod('2026-08-16'))[0];
    expect(row.progress).toBe(2);
    expect(row.completedAt).toBeNull();

    // Reaching the target stamps completion exactly once.
    await quests.recordProgress({
      questId: 'play-three',
      period: '2026-08-16',
      progress: 3,
      completedAt: T0 + 5_000,
    });
    await quests.recordProgress({
      questId: 'play-three',
      period: '2026-08-16',
      progress: 4,
      completedAt: T0 + 9_000,
    });
    const done = (await quests.listProgressForPeriod('2026-08-16'))[0];
    expect(done.completedAt).toBe(T0 + 5_000);

    // Claim is once-only.
    expect(await quests.claim('play-three', '2026-08-16')).toBe(true);
    expect(await quests.claim('play-three', '2026-08-16')).toBe(false);
    expect((await quests.listProgressForPeriod('2026-08-16'))[0].claimedAt).toBe(T0);

    // A different period is independent.
    await quests.recordProgress({ questId: 'play-three', period: '2026-08-17', progress: 1 });
    expect(await quests.claim('play-three', '2026-08-17')).toBe(true);
  });
});

describe('AchievementRepository', () => {
  it('unlocks once, claims once, and round-trips definitions', async () => {
    const adapter: SQLiteAdapter = await createMigratedDb();
    const achievements = new AchievementRepository(adapter, () => T0);

    await achievements.upsertDefinition({
      id: 'first-session',
      title: 'First steps',
      description: 'Complete your first session.',
      criteria: { type: 'session-count', target: 1 },
      rewardXp: 20,
      rewardCurrency: 2,
      version: 1,
    });

    expect(await achievements.getUnlock('first-session')).toBeNull();
    expect(await achievements.unlock('first-session')).toBe(true);
    expect(await achievements.unlock('first-session')).toBe(false); // once-only

    const unlock = await achievements.getUnlock('first-session');
    expect(unlock).toMatchObject({ achievementId: 'first-session', unlockedAt: T0, claimedAt: null });

    expect(await achievements.claim('first-session')).toBe(true);
    expect(await achievements.claim('first-session')).toBe(false);

    const definitions = await achievements.listDefinitions();
    expect(definitions[0].criteria).toEqual({ type: 'session-count', target: 1 });

    const unlocks = await achievements.listUnlocks();
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0].claimedAt).toBe(T0);
  });
});
