/**
 * Achievement reward application (campaign 003 convergence). The only
 * achievements-module code that touches the db.
 *
 * Claim flow mirrors the quests reward discipline: the once-only `claim`
 * (`claimed_at IS NULL`) is the commit point; XP award + currency ledger
 * entry are appended only after a successful claim, so a crash between the
 * two never grants a double reward (worst case: claimed-but-unrewarded,
 * detectable via `claimedAt` vs `xp_awards`).
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
): Promise<AchievementClaimResult> {
  const unlock = await db.achievements.getUnlock(definition.id);
  if (!unlock) {
    return { status: 'not-unlocked' };
  }
  if (unlock.claimedAt !== null) {
    return { status: 'already-claimed' };
  }
  const claimed = await db.achievements.claim(definition.id);
  if (!claimed) {
    // Claimed between the read and the update — someone else owns it.
    return { status: 'already-claimed' };
  }
  await db.xpAwards.award(definition.rewardXp, 'achievement', `achievement:${definition.id}`);
  await db.ledger.append({ amount: definition.rewardCurrency, reason: 'achievement' });
  return { status: 'claimed' };
}
