/**
 * Achievement engine tests (campaign 003 convergence): pure evaluation,
 * once-only unlock/claim rewards through the real repos (in-memory db).
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  evaluateAchievements,
  toDbAchievementDefinition,
} from '@/achievements';

const T0 = 1_700_000_000_000;

describe('evaluateAchievements', () => {
  it('is pure and deterministic: met criteria are reported in definition order', () => {
    const snapshot = { sessionCount: 25, totalXp: 6000 };
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    // 25 sessions meets ach-first + ach-25; 6000 xp meets ach-xp-5000; ach-100 not yet.
    expect(met).toEqual(['ach-first', 'ach-25', 'ach-xp-5000']);
    expect(evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot)).toEqual(met);
  });

  it('reports nothing for an empty snapshot', () => {
    expect(evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, { sessionCount: 0, totalXp: 0 }))
      .toEqual([]);
  });
});

describe('claimAchievementReward', () => {
  async function makeDb() {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter, { now: () => T0 });
    return db;
  }

  it('refuses to reward an achievement that is not unlocked', async () => {
    const db = await makeDb();
    const result = await claimAchievementReward(db, ACHIEVEMENT_DEFINITIONS_V1[0]);
    expect(result.status).toBe('not-unlocked');
    expect(await db.ledger.getBalance()).toBe(0);
  });

  it('claims once: awards XP + currency, then reports already-claimed', async () => {
    const db = await makeDb();
    const definition = ACHIEVEMENT_DEFINITIONS_V1[0]; // ach-first: 50 xp / 25 coins
    await db.achievements.upsertDefinition(toDbAchievementDefinition(definition));
    expect(await db.achievements.unlock(definition.id)).toBe(true);

    const first = await claimAchievementReward(db, definition);
    expect(first.status).toBe('claimed');
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(definition.rewardXp);
    expect(await db.ledger.getBalance()).toBe(definition.rewardCurrency);

    const second = await claimAchievementReward(db, definition);
    expect(second.status).toBe('already-claimed');
    // No double reward.
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(definition.rewardXp);
    expect(await db.ledger.getBalance()).toBe(definition.rewardCurrency);
  });

  it('unlock is once-only (INSERT OR IGNORE)', async () => {
    const db = await makeDb();
    const definition = ACHIEVEMENT_DEFINITIONS_V1[0];
    await db.achievements.upsertDefinition(toDbAchievementDefinition(definition));
    expect(await db.achievements.unlock(definition.id)).toBe(true);
    expect(await db.achievements.unlock(definition.id)).toBe(false);
    expect(await db.achievements.listUnlocks()).toHaveLength(1);
  });
});
