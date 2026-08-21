/**
 * Achievement claim hardening (campaign 009 W08): transactionality,
 * idempotency and rollback of reward claims, plus evaluation-stability
 * guarantees as the catalog grows (36 → 40+).
 *
 * Contracts under test:
 * - The ledger entry carries a stable `operationId` (`achievement:<id>`,
 *   unique by partial index) so retries/imports can never double-append.
 * - A failure INSIDE the claim transaction rolls back the claim marker, the
 *   XP award, and the currency entry together (atomic or nothing).
 * - Concurrent/duplicate claim attempts grant at most one reward.
 * - Appending hypothetical new definitions never changes an already-earned
 *   met-set, and every definition evaluates to finite progress.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { AppDatabase, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  evaluateAchievementProgress,
  evaluateAchievements,
  toDbAchievementDefinition,
  type AchievementClaimResult,
  type AchievementDef,
  type AchievementSnapshot,
} from '@/achievements';

const T0 = 1_700_000_000_000;

async function makeDb(): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  return new AppDatabase(real, { now: () => T0 });
}

async function unlockedDb(def: AchievementDef): Promise<AppDatabase> {
  const db = await makeDb();
  await db.achievements.upsertDefinition(toDbAchievementDefinition(def));
  expect(await db.achievements.unlock(def.id)).toBe(true);
  return db;
}

const DEF = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-25')!; // 250 xp / 100 coins

describe('claimAchievementReward — transactionality', () => {
  it('stamps the ledger entry with the stable achievement operationId', async () => {
    const db = await unlockedDb(DEF);
    const result = await claimAchievementReward(db, DEF);
    expect(result.status).toBe('claimed');

    const entry = await db.ledger.getByOperation(`achievement:${DEF.id}`);
    expect(entry).not.toBeNull();
    expect(entry?.amount).toBe(DEF.rewardCurrency);

    // Exactly one award + one entry after the claim.
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(DEF.rewardXp);
    expect(await db.ledger.getBalance()).toBe(DEF.rewardCurrency);
  });

  it('rolls back claim + XP + currency atomically when the ledger append fails', async () => {
    const db = await unlockedDb(DEF);
    const spy = jest
      .spyOn(db.ledger, 'append')
      .mockImplementationOnce(async () => {
        throw new Error('simulated crash mid-claim');
      });

    await expect(claimAchievementReward(db, DEF)).rejects.toThrow('simulated crash mid-claim');
    spy.mockRestore();

    // NOTHING committed: not the claim marker, not the XP, not the coins.
    const unlock = await db.achievements.getUnlock(DEF.id);
    expect(unlock?.claimedAt).toBeNull();
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(0);
    expect(await db.ledger.getBalance()).toBe(0);

    // The retry then succeeds cleanly.
    expect(await claimAchievementReward(db, DEF)).toEqual({ status: 'claimed' });
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(DEF.rewardXp);
    expect(await db.ledger.getBalance()).toBe(DEF.rewardCurrency);
  });

  it('rolls back cleanly when the XP award fails before the ledger append', async () => {
    const db = await unlockedDb(DEF);
    const spy = jest
      .spyOn(db.xpAwards, 'award')
      .mockImplementationOnce(async () => {
        throw new Error('simulated crash at xp');
      });

    await expect(claimAchievementReward(db, DEF)).rejects.toThrow('simulated crash at xp');
    spy.mockRestore();

    const unlock = await db.achievements.getUnlock(DEF.id);
    expect(unlock?.claimedAt).toBeNull();
    expect(await db.ledger.getBalance()).toBe(0);
  });

  it('duplicate/concurrent claims can never double-grant', async () => {
    const db = await unlockedDb(DEF);

    // Sequential retry.
    expect((await claimAchievementReward(db, DEF)).status).toBe('claimed');
    expect((await claimAchievementReward(db, DEF)).status).toBe('already-claimed');

    // Concurrent burst (double tap): overlapping transactions may be refused
    // by the backend; whatever settles, the totals must stay at exactly one.
    const burst = await Promise.allSettled([
      claimAchievementReward(db, DEF),
      claimAchievementReward(db, DEF),
    ]);
    const fulfilled = burst.filter(
      (o): o is PromiseFulfilledResult<AchievementClaimResult> => o.status === 'fulfilled',
    );
    expect(fulfilled.some((o) => o.value.status === 'claimed')).toBe(false); // first call already owned it

    expect(await db.xpAwards.getTotalAwardedXp()).toBe(DEF.rewardXp);
    expect(
      (await db.ledger.list()).filter((e) => e.reason === 'achievement'),
    ).toHaveLength(1);
  });
});

describe('evaluation stability as the catalog grows (36 → 40+)', () => {
  const BASELINE_MET = ['ach-first', 'ach-25', 'ach-xp-5000'];

  it('appending hypothetical future definitions never changes an earned met-set', () => {
    const snapshot: AchievementSnapshot = { sessionCount: 25, totalXp: 6000 };
    const futureWave: AchievementDef[] = [
      {
        id: 'ach-future-sessions-5000',
        title: 'Far Future',
        description: 'Complete 5,000 sessions.',
        category: 'Milestone',
        tier: 'platinum',
        criteria: { type: 'session-count', goal: 5000 },
        rewardXp: 20000,
        rewardCurrency: 8000,
        version: 1,
      },
      {
        id: 'ach-future-xp-500000',
        title: 'XP Singularity',
        description: 'Earn 500,000 lifetime XP.',
        category: 'Milestone',
        tier: 'platinum',
        criteria: { type: 'total-xp', goal: 500000 },
        rewardXp: 30000,
        rewardCurrency: 12000,
        version: 1,
      },
      {
        id: 'ach-future-active-1000',
        title: 'Millennium Habit',
        description: 'Be active on 1,000 days.',
        category: 'Milestone',
        tier: 'platinum',
        criteria: { type: 'active-days', goal: 1000 },
        rewardXp: 25000,
        rewardCurrency: 10000,
        version: 1,
      },
    ];

    const grown = [...ACHIEVEMENT_DEFINITIONS_V1, ...futureWave];
    expect(evaluateAchievements(grown, snapshot)).toEqual(BASELINE_MET);
    // Definition order is preserved for the full grown catalog.
    expect(evaluateAchievements(grown, snapshot)).toHaveLength(3);
  });

  it('every definition evaluates to finite progress against a minimal snapshot', () => {
    const minimal: AchievementSnapshot = { sessionCount: 0, totalXp: 0 };
    for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
      const progress = evaluateAchievementProgress(def, minimal);
      expect(Number.isFinite(progress.progress)).toBe(true);
      expect(Number.isFinite(progress.ratio)).toBe(true);
      expect(progress.ratio).toBeGreaterThanOrEqual(0);
      expect(progress.ratio).toBeLessThanOrEqual(1);
      expect(progress.completed).toBe(false);
    }
  });

  it('ratios clamp to 1 for absurdly large snapshots (no overflow past the goal)', () => {
    const huge: AchievementSnapshot = {
      sessionCount: Number.MAX_SAFE_INTEGER,
      totalXp: Number.MAX_SAFE_INTEGER,
      activeDays: 999999,
    };
    // Families backed by the provided fields must complete with a clamped
    // ratio; every other family must stay safely incomplete at ratio 0.
    const providedTypes = new Set(['session-count', 'total-xp', 'active-days']);
    for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
      const progress = evaluateAchievementProgress(def, huge);
      expect(Number.isFinite(progress.ratio)).toBe(true);
      expect(progress.ratio).toBeLessThanOrEqual(1);
      if (providedTypes.has(def.criteria.type)) {
        expect(progress.completed).toBe(true);
        expect(progress.ratio).toBe(1);
      } else {
        expect(progress.completed).toBe(false);
      }
    }
  });

  it('an unknown criteria type fails loudly instead of silently never-met', () => {
    const bogus = {
      id: 'ach-bogus',
      title: 'Bogus',
      description: 'Unknown criteria shape.',
      category: 'Milestone',
      tier: 'bronze',
      criteria: { type: 'time-travel', goal: 1 },
      rewardXp: 1,
      rewardCurrency: 1,
      version: 1,
    } as unknown as AchievementDef;

    expect(() =>
      evaluateAchievementProgress(bogus, { sessionCount: 0, totalXp: 0 }),
    ).toThrow(/unknown achievement criteria/i);
  });
});
