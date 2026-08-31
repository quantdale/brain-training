/**
 * Achievement reward application (campaign 003 convergence). The only
 * achievements-module code that touches the db.
 *
 * Claim flow mirrors the quests reward discipline: the once-only `claim`
 * (`claimed_at IS NULL`) is the commit point; XP award + currency ledger
 * entry are appended only after a successful claim, so a crash between the
 * two never grants a double reward (worst case: claimed-but-unrewarded,
 * detectable via `claimedAt` vs `xp_awards`). The ledger entry additionally
 * carries a stable `operationId` (`achievement:<id>`), enforced unique by the
 * schema's partial index, so a retried import/merge or replayed claim can
 * never create a second currency entry for the same achievement.
 */
import type { AppDatabase, AchievementDefinition as DbAchievementDefinition } from '@/db';
import type { AchievementDef } from './types';

export type AchievementClaimResult =
  | { status: 'claimed' }
  | { status: 'already-claimed' }
  | { status: 'not-unlocked' };

/** Map an engine definition onto the db row shape (for seeding at startup). */
export function toDbAchievementDefinition(
  definition: AchievementDef,
): DbAchievementDefinition {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    criteria: definition.criteria,
    rewardXp: definition.rewardXp,
    rewardCurrency: definition.rewardCurrency,
    version: definition.version,
  };
}

/**
 * Claim an unlocked achievement's reward. Idempotent-safe: once claimed,
 * later calls report `already-claimed` and never grant a second reward.
 * Refuses when the achievement is not unlocked yet.
 */
export async function claimAchievementReward(
  db: AppDatabase,
  definition: AchievementDef,
  now: Date = new Date(),
): Promise<AchievementClaimResult> {
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs)) {
    throw new RangeError('claimAchievementReward: now must be a valid safe-integer Date');
  }
  // All reads/claims/awards run inside one transaction (task 7.3): the claim
  // marker, the XP award, and the currency ledger entry commit together or roll
  // back as one, so a crash can never leave a partial reward.
  return db.transaction(async (txn) => {
    const unlock = await db.achievements.getUnlock(definition.id, txn);
    if (!unlock) {
      return { status: 'not-unlocked' };
    }
    // A clock-skewed/imported unlock is not claimable before its recorded
    // event time. This keeps direct claims consistent with the inbox and
    // prevents a future unlock from granting progression early.
    if (unlock.unlockedAt > nowMs) {
      return { status: 'not-unlocked' };
    }
    if (unlock.claimedAt !== null) {
      return { status: 'already-claimed' };
    }
    const claimed = await db.achievements.claim(definition.id, txn);
    if (!claimed) {
      // Claimed between the read and the update — someone else owns it.
      return { status: 'already-claimed' };
    }
    await db.xpAwards.award(definition.rewardXp, 'achievement', `achievement:${definition.id}`, txn);
    await db.ledger.append(
      {
        amount: definition.rewardCurrency,
        reason: 'achievement',
        // Stable idempotency key (unique partial index in the schema): a
        // retried claim/import can never append a second entry for this id.
        operationId: `achievement:${definition.id}`,
      },
      txn,
    );
    return { status: 'claimed' };
  });
}
