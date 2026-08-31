/**
 * Reward inbox + claim-all (engagement V2, campaign 010 / W12).
 *
 * The inbox unifies every claimable engagement reward into one deterministic
 * list: unlocked-but-unclaimed achievements, completed-but-unclaimed active
 * quests, and reached-but-unclaimed streak milestones. `claimAllRewards`
 * claims them through the EXISTING once-only claim flows, so idempotency is
 * inherited rather than reinvented:
 * - achievements: `claimed_at IS NULL` gate + `achievement:<id>` ledger operationId;
 * - quests: per-period claim gate + `quest:<id>:<period>` operationId;
 * - milestones: persisted `streaks.claimedMilestones` set + `milestone:<id>` operationId.
 *
 * A retried or doubled claim-all therefore can never double-grant: the second
 * pass simply finds nothing (or reports `already-claimed` per item).
 */
import type { AppDatabase } from '@/db';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
} from '@/achievements';
import {
  applyQuestReward,
  QuestNotCompleteError,
  QUEST_DEFINITIONS_V1,
} from '@/quests';
import {
  claimStreakMilestoneReward,
  readClaimedMilestones,
  reconstructStreak,
  readCoveredDates,
  STREAK_MILESTONES,
} from '@/streaks';
import { localDateString } from '@/workout/today';

/** One claimable reward in the inbox. */
export interface RewardInboxItem {
  /** Stable composite key (`achievement:<id>`, `quest:<id>:<period>`, `milestone:<id>`). */
  key: string;
  kind: 'achievement' | 'quest' | 'milestone';
  /** Definition id (achievement/quest/milestone). */
  id: string;
  /** Period key for quest claims; undefined otherwise. */
  periodKey?: string;
  title: string;
  description: string;
  rewardXp: number;
  rewardCurrency: number;
}

/** Result of claiming one inbox item. */
export type ClaimOutcome =
  | { status: 'claimed'; xp: number; coins: number }
  | { status: 'already-claimed' }
  | { status: 'unavailable' };

/** Aggregate outcome of a claim-all pass. */
export interface ClaimAllResult {
  /** Items that were found claimable at collect time. */
  attempted: number;
  /** Items actually claimed by this pass (0 on an immediate retry). */
  claimedCount: number;
  totalXp: number;
  totalCoins: number;
}

/**
 * Best (longest) streak including freeze/recovery coverage, matching the
 * Home/Profile display and the milestone engine's expectations.
 */
async function currentBestStreak(db: AppDatabase, now: Date): Promise<number> {
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs)) {
    throw new RangeError('currentBestStreak: now must be a valid safe-integer Date');
  }
  const [activityDates, profile] = await Promise.all([
    db.sessions.getDistinctActivityDates(nowMs),
    db.profile.get(),
  ]);
  const settings = profile?.settings ?? {};
  return reconstructStreak(
    activityDates,
    localDateString(now),
    readCoveredDates(settings),
  ).longest;
}

/**
 * Collect every currently claimable reward. Deterministic order:
 * achievements (definition order), then quests (definition/period order),
 * then milestones (catalog order).
 */
export async function collectClaimableRewards(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<RewardInboxItem[]> {
  const [unlockRows, profile] = await Promise.all([
    db.achievements.listUnlocks(),
    db.profile.get(),
  ]);
  const settings = profile?.settings ?? {};
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs)) {
    throw new RangeError('collectClaimableRewards: now must be a valid safe-integer Date');
  }

  const items: RewardInboxItem[] = [];

  // Achievements: unlocked but never claimed.
  const unclaimedUnlockIds = new Set(
    unlockRows
      .filter((row) => row.claimedAt === null && row.unlockedAt <= nowMs)
      .map((row) => row.achievementId),
  );
  for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
    if (unclaimedUnlockIds.has(def.id)) {
      items.push({
        key: `achievement:${def.id}`,
        kind: 'achievement',
        id: def.id,
        title: def.title,
        description: def.description,
        rewardXp: def.rewardXp,
        rewardCurrency: def.rewardCurrency,
      });
    }
  }

  // Quests: scan every persisted period, not only the active/current pool.
  // Rotation changes what is surfaced, but must never make an already-earned
  // reward unreachable. `listProgressForQuest` is ordered by period, giving
  // the inbox a stable definition-then-period order across rollovers.
  for (const def of QUEST_DEFINITIONS_V1) {
    const rows = await db.quests.listProgressForQuest(def.id);
    for (const row of rows) {
      if (
        row.completedAt !== null &&
        row.completedAt <= nowMs &&
        row.claimedAt === null &&
        row.progress >= def.criteria.goal
      ) {
        items.push({
          key: `quest:${def.id}:${row.period}`,
          kind: 'quest',
          id: def.id,
          periodKey: row.period,
          title: def.title,
          description: def.description,
          rewardXp: def.reward.xp,
          rewardCurrency: def.reward.coins,
        });
      }
    }
  }

  // Streak milestones: reached (best streak) but never claimed.
  const bestStreak = await currentBestStreak(db, now);
  const claimedMilestones = new Set(readClaimedMilestones(settings));
  for (const milestone of STREAK_MILESTONES) {
    if (
      bestStreak >= milestone.days &&
      !claimedMilestones.has(milestone.id) &&
      (milestone.rewardXp != null || milestone.rewardCurrency != null)
    ) {
      items.push({
        key: `milestone:${milestone.id}`,
        kind: 'milestone',
        id: milestone.id,
        title: milestone.label,
        description: milestone.description,
        rewardXp: milestone.rewardXp ?? 0,
        rewardCurrency: milestone.rewardCurrency ?? 0,
      });
    }
  }

  return items;
}

/**
 * Claim one inbox item through its canonical once-only flow. Safe to retry:
 * a repeated call reports `already-claimed` instead of granting again.
 */
export async function claimReward(
  db: AppDatabase,
  item: RewardInboxItem,
  now: Date = new Date(),
): Promise<ClaimOutcome> {
  switch (item.kind) {
    case 'achievement': {
      const def = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === item.id);
      if (!def) {
        return { status: 'unavailable' };
      }
      const result = await claimAchievementReward(db, def, now);
      if (result.status === 'claimed') {
        return { status: 'claimed', xp: def.rewardXp, coins: def.rewardCurrency };
      }
      return result.status === 'already-claimed'
        ? { status: 'already-claimed' }
        : { status: 'unavailable' };
    }
    case 'quest': {
      const def = QUEST_DEFINITIONS_V1.find((d) => d.id === item.id);
      if (!def || !item.periodKey) {
        return { status: 'unavailable' };
      }
      try {
        const result = await applyQuestReward(db, def, item.periodKey, now);
        if (result.status === 'claimed') {
          return {
            status: 'claimed',
            xp: result.xpAward.amount,
            coins: result.ledgerEntry.amount,
          };
        }
        return { status: 'already-claimed' };
      } catch (error) {
        if (error instanceof QuestNotCompleteError) {
          // Progress regressed or the period rolled over between collect and
          // claim — refuse honestly instead of rewarding.
          return { status: 'unavailable' };
        }
        throw error;
      }
    }
    case 'milestone': {
      const milestone = STREAK_MILESTONES.find((m) => m.id === item.id);
      if (!milestone) {
        return { status: 'unavailable' };
      }
      // Re-derive the best streak at claim time so a stale collect snapshot
      // can never claim an unreached milestone.
      const bestStreak = await currentBestStreak(db, now);
      const result = await claimStreakMilestoneReward(db, milestone, bestStreak, now);
      if (result === 'claimed') {
        return {
          status: 'claimed',
          xp: milestone.rewardXp ?? 0,
          coins: milestone.rewardCurrency ?? 0,
        };
      }
      return result === 'already-claimed'
        ? { status: 'already-claimed' }
        : { status: 'unavailable' };
    }
  }
}

/**
 * Claim all currently claimable rewards. Idempotent end-to-end: each item goes
 * through its once-only claim gate, so an immediate second pass claims nothing.
 */
export async function claimAllRewards(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<ClaimAllResult> {
  const items = await collectClaimableRewards(db, now);
  let claimedCount = 0;
  let totalXp = 0;
  let totalCoins = 0;
  for (const item of items) {
    const outcome = await claimReward(db, item, now);
    if (outcome.status === 'claimed') {
      claimedCount += 1;
      totalXp += outcome.xp;
      totalCoins += outcome.coins;
    }
  }
  return { attempted: items.length, claimedCount, totalXp, totalCoins };
}
