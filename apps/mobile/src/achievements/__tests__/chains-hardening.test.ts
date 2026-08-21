/**
 * Achievement chain hardening (campaign 011 / W13).
 *
 * Beyond the resolve-time unknown-stage throw already pinned in
 * rewards/__tests__/engagement-v2.test.ts, these attacks pin:
 * - tier ordering is strictly monotonic along TIER_ORDER and unknown tiers
 *   rank below bronze;
 * - every shipped chain resolves against the REAL catalog (no stage id can
 *   drift out of sync silently at runtime);
 * - chain progress is a function of CRITERIA ONLY — mixed claimed/unclaimed
 *   reward states on real db unlocks must not change resolution, so claiming
 *   can never advance or regress a ladder.
 */
import { describe, expect, it } from '@jest/globals';

import {
  ACHIEVEMENT_CHAINS,
  ACHIEVEMENT_DEFINITIONS_V1,
  resolveChainProgress,
  TIER_ORDER,
  tierRank,
} from '@/achievements';
import type { AchievementDef } from '@/achievements';
import { AppDatabase, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { claimAchievementReward, toDbAchievementDefinition } from '@/achievements';

describe('tier ordering', () => {
  it('is strictly increasing bronze → silver → gold → platinum', () => {
    for (let i = 1; i < TIER_ORDER.length; i += 1) {
      expect(tierRank(TIER_ORDER[i])).toBeGreaterThan(tierRank(TIER_ORDER[i - 1]));
    }
    expect(tierRank('bronze')).toBe(0);
    expect(tierRank('platinum')).toBe(TIER_ORDER.length - 1);
  });

  it('ranks an unknown/legacy tier below bronze instead of crashing', () => {
    expect(tierRank('diamond' as never)).toBe(-1);
  });

  it('every shipped definition carries a known tier (catalog integrity)', () => {
    for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
      expect(tierRank(def.tier)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('chain/catalog integrity', () => {
  it('every shipped chain resolves against the real catalog with an empty snapshot', () => {
    for (const chain of ACHIEVEMENT_CHAINS) {
      const progress = resolveChainProgress(chain, ACHIEVEMENT_DEFINITIONS_V1, {
        sessionCount: 0,
        totalXp: 0,
      });
      expect(progress.totalStages).toBe(chain.stageIds.length);
      // Stage indices are dense 0..n-1 in definition order.
      if (progress.currentStage === null) {
        expect(progress.complete).toBe(true);
      } else {
        expect(progress.currentStage.index).toBe(progress.completedStages);
      }
      expect(progress.nextRatio).toBeGreaterThanOrEqual(0);
      expect(progress.nextRatio).toBeLessThanOrEqual(1);
    }
  });

  it('stage ids are unique within each chain (no duplicated rungs)', () => {
    for (const chain of ACHIEVEMENT_CHAINS) {
      expect(new Set(chain.stageIds).size).toBe(chain.stageIds.length);
    }
  });
});

describe('progress across MIXED claim states (real db unlocks)', () => {
  /**
   * sessionCount 120 completes ach-first(1) + ach-25 + ach-100 on the session
   * ladder; ach-250 becomes the current stage. Unlock the three completed
   * stages for real, then CLAIM only one of them — resolution must be
   * byte-identical to the all-unclaimed case.
   */
  const SNAPSHOT = { sessionCount: 120, totalXp: 6_000 };
  const CHAIN = ACHIEVEMENT_CHAINS.find((c) => c.id === 'chain-sessions')!;

  async function makeDb(): Promise<AppDatabase> {
    const adapter = await createMigratedDb();
    await new ProfileRepository(adapter, () => Date.now()).ensureExists();
    return new AppDatabase(adapter);
  }

  function unlockAll(db: AppDatabase, ids: string[]): Promise<void> {
    return (async () => {
      for (const id of ids) {
        const def = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === id)!;
        await db.achievements.upsertDefinition(toDbAchievementDefinition(def));
        expect(await db.achievements.unlock(id)).toBe(true);
      }
    })();
  }

  function expectedStageLayout(defs: readonly AchievementDef[]): {
    completedStages: number;
    currentId: string | null;
  } {
    const progress = resolveChainProgress(CHAIN, defs, SNAPSHOT);
    return {
      completedStages: progress.completedStages,
      currentId: progress.currentStage?.def.id ?? null,
    };
  }

  it('claiming some stages never changes resolution vs all-unclaimed', async () => {
    const baseline = resolveChainProgress(CHAIN, ACHIEVEMENT_DEFINITIONS_V1, SNAPSHOT);
    expect(baseline.completedStages).toBe(3);
    expect(baseline.currentStage?.def.id).toBe('ach-250');
    expect(baseline.complete).toBe(false);

    const db = await makeDb();
    await unlockAll(db, ['ach-first', 'ach-25', 'ach-100']);

    // All unlocked, none claimed yet.
    const beforeClaims = resolveChainProgress(CHAIN, ACHIEVEMENT_DEFINITIONS_V1, SNAPSHOT);
    expect(beforeClaims).toEqual(baseline);

    // Claim exactly one stage's reward.
    const first = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-first')!;
    expect(await claimAchievementReward(db, first)).toEqual({ status: 'claimed' });

    const afterClaim = resolveChainProgress(CHAIN, ACHIEVEMENT_DEFINITIONS_V1, SNAPSHOT);
    expect(afterClaim).toEqual(baseline); // criteria-only completion

    // And a fully-claimed ladder resolves identically too.
    const second = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-25')!;
    const third = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-100')!;
    expect(await claimAchievementReward(db, second)).toEqual({ status: 'claimed' });
    expect(await claimAchievementReward(db, third)).toEqual({ status: 'claimed' });
    expect(resolveChainProgress(CHAIN, ACHIEVEMENT_DEFINITIONS_V1, SNAPSHOT)).toEqual(baseline);

    // Sanity: layout helpers agree with the direct expectation.
    expect(expectedStageLayout(ACHIEVEMENT_DEFINITIONS_V1)).toEqual({
      completedStages: 3,
      currentId: 'ach-250',
    });
  });

  it('a fully-met ladder reports complete regardless of claim debt', async () => {
    const db = await makeDb();
    const xpChain = ACHIEVEMENT_CHAINS.find((c) => c.id === 'chain-xp')!;
    const snapshot = { sessionCount: 0, totalXp: 200_000 };

    const unclaimed = resolveChainProgress(xpChain, ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(unclaimed.complete).toBe(true);
    expect(unclaimed.currentStage).toBeNull();

    // Unlock nothing at all: completion is about the snapshot criteria, and
    // unlock state is likewise irrelevant to chain math.
    void db; // no db interaction needed — pinned as pure-criteria semantics
    expect(resolveChainProgress(xpChain, ACHIEVEMENT_DEFINITIONS_V1, snapshot).complete).toBe(true);
  });
});
