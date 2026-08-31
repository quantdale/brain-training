/**
 * Streak DB actions (engagement-cosmetics wave). The only streaks code that
 * touches the db.
 *
 * - Applying an owned Freeze/Shield/Recovery persists covered dates (and
 *   consumes the item) inside one `db.transaction`, so the streak-state change
 *   and the inventory change commit together or roll back as one. A repeated
 *   application that would add NO new covered date (e.g. a double tap on the
 *   same day) is refused before any write, so it cannot burn a second item on
 *   coverage the player already has.
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
import { reconstructStreak } from './reconstruct';
import {
  applyFreezeToSettings,
  applyRecoveryToSettings,
  applyShieldToSettings,
  canApplyFreeze,
  canApplyRecovery,
  canApplyShield,
} from './rules';
import { readInventory, readCoveredDates } from './inventory';
import {
  markMilestoneClaimed,
  readClaimedMilestones,
  type StreakMilestone,
} from './milestones';
import { localDateString } from '@/workout/today';

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
  _state: StreakState,
  now: Date,
): Promise<StreakApplyResult> {
  // Run the read-precondition-check + transform + write inside one transaction
  // so a concurrent apply (or any interleaved settings write) cannot race the
  // read against the write and silently lose a freeze/coverage update. The
  // precondition is re-evaluated against the fresh in-transaction settings, so
  // the outcome is deterministic regardless of concurrent callers.
  return db.transaction(async (txn) => {
    const settings0 = (await db.profile.get(txn))?.settings ?? {};
    const inventory = readInventory(settings0);
    const nowMs = now.getTime();
    if (!Number.isSafeInteger(nowMs)) {
      throw new RangeError('applyOwnedStreakItem: now must be a valid safe-integer Date');
    }
    // The screen supplies a snapshot for rendering, but the action may run
    // after another session or protection item changed the underlying state.
    // Rebuild the streak from the same transaction snapshot so a stale UI can
    // never apply an item to the wrong window or restore the wrong gap.
    const activityDates = await db.sessions.getDistinctActivityDates(nowMs, txn);
    const state = reconstructStreak(
      activityDates,
      localDateString(now),
      readCoveredDates(settings0),
    );

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

    // Duplicate-apply guard (double tap / stale UI state): if the transform
    // would not add a single new covered date, the coverage already exists and
    // consuming an item would waste it. Refuse without persisting anything.
    // Computed against the fresh in-transaction settings, so it is race-safe.
    const coveredBefore = new Set(readCoveredDates(settings0));
    const addsCoverage = readCoveredDates(nextSettings).some(
      (date) => !coveredBefore.has(date),
    );
    if (!addsCoverage) {
      return 'not-allowed' as const;
    }

    await db.profile.update({ settings: nextSettings }, txn);
    return 'applied' as const;
  });
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
