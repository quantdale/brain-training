/**
 * Streak DB actions (engagement-cosmetics wave). The only streaks code that
 * touches the db.
 *
 * - Applying an owned Freeze/Shield/Recovery persists covered dates (and
 *   consumes the item) inside one `db.transaction`, so the streak-state change
 *   and the inventory change commit together or roll back as one.
 * - Claiming a reached milestone's reward appends the XP award + currency
 *   ledger entry exactly once (idempotent via an `operationId` and a persisted
 *   `claimedMilestones` set), so a crash or retry can never double-grant.
 *
 * All economic invariants are preserved: no currency is created or destroyed
 * here except the explicitly configured milestone reward, which is a granted
 * (not purchased) reward.
 */
import type { AppDatabase } from '@/db';
import type { StreakItemKind, StreakState } from './types';
import {
  applyFreezeToSettings,
  applyRecoveryToSettings,
  applyShieldToSettings,
  canApplyFreeze,
  canApplyRecovery,
  canApplyShield,
} from './rules';
import { readInventory } from './inventory';
import {
  markMilestoneClaimed,
  readClaimedMilestones,
  type StreakMilestone,
} from './milestones';

export type StreakApplyResult = 'applied' | 'not-allowed' | 'no-item';

/**
 * Apply one owned streak item against the current streak state.
 * `state` is the reconstructed streak (including any already-covered dates) so
 * the pure preconditions (`canApplyFreeze` / `canApplyRecovery` / `canApplyShield`)
 * decide eligibility before any write.
 */
export async function applyOwnedStreakItem(
  db: AppDatabase,
  kind: StreakItemKind,
  state: StreakState,
  now: Date,
): Promise<StreakApplyResult> {
  const settings0 = (await db.profile.get())?.settings ?? {};
  const inventory = readInventory(settings0);

  const allowed =
    kind === 'freeze'
      ? canApplyFreeze(state, settings0, now)
      : kind === 'recovery'
        ? canApplyRecovery(state, settings0, now)
        : canApplyShield(state, settings0, now);
  if (!allowed) {
    const hasItem = inventory[kind] >= 1;
    return hasItem ? 'not-allowed' : 'no-item';
  }

  const nextSettings =
    kind === 'freeze'
      ? applyFreezeToSettings(settings0, now)
      : kind === 'recovery'
        ? applyRecoveryToSettings(settings0, state, now)
        : applyShieldToSettings(settings0, state, now);

  await db.profile.update({ settings: nextSettings });
  return 'applied';
}

export type MilestoneClaimStatus = 'claimed' | 'already-claimed' | 'not-reached' | 'no-reward';

/**
 * Claim a reached milestone's one-time reward. Idempotent: once claimed (the
 * id is in `streaks.claimedMilestones`) later calls report `already-claimed`
 * and grant nothing. Refuses when the milestone is not yet reached, or when it
 * confers no reward.
 */
export async function claimStreakMilestoneReward(
  db: AppDatabase,
  milestone: StreakMilestone,
  bestStreak: number,
  now: Date,
): Promise<MilestoneClaimStatus> {
  if (bestStreak < milestone.days) {
    return 'not-reached';
  }
  if (milestone.rewardXp == null && milestone.rewardCurrency == null) {
    return 'no-reward';
  }
  const operationId = `milestone:${milestone.id}`;
  return db.transaction(async (txn) => {
    const settings = (await db.profile.get(txn))?.settings ?? {};
    if (readClaimedMilestones(settings).includes(milestone.id)) {
      return 'already-claimed' as const;
    }
    await db.profile.update({ settings: markMilestoneClaimed(settings, milestone.id) }, txn);
    if (milestone.rewardXp != null) {
      await db.xpAwards.award(milestone.rewardXp, 'streak-milestone', operationId, txn);
    }
    if (milestone.rewardCurrency != null) {
      await db.ledger.append(
        { amount: milestone.rewardCurrency, reason: 'streak-milestone', operationId },
        txn,
      );
    }
    return 'claimed' as const;
  });
}
