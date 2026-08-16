/**
 * Reward application for quests (campaign 003, WP-3A). The only quests-module
 * code that touches the db.
 *
 * Claim flow (all persistence through the `AppDatabase` facade):
 *   1. verify the progress row exists, its target is reached and completion
 *      is stamped (`completedAt`) — otherwise refuse with a typed error;
 *   2. re-record progress in the completed state (idempotent by repo
 *      contract: monotonic-MAX progress, `completedAt` sticks);
 *   3. claim *first* (`claim` returns false when the row is already claimed)
 *      and only then append the XP award (`source: quest:<id>`,
 *      `reason: 'quest'`) and the currency ledger entry.
 *
 * The facade does not expose the adapter, so cross-repo atomicity comes from
 * ordering: the claim is the commit point and rewards are granted only after
 * it returns true. A crash between claim and award leaves a
 * claimed-but-unrewarded quest (never a double reward); the app wiring can
 * detect that via `claimedAt` vs `xp_awards`.
 */
import type { AppDatabase, LedgerEntry, QuestDefinition as DbQuestDefinition, XpAward } from '@/db';
import type { QuestDefinition } from './types';

/** Thrown when a reward is requested for a quest that is not complete yet. */
export class QuestNotCompleteError extends Error {
  constructor(
    readonly questId: string,
    readonly periodKey: string,
  ) {
    super(`quest "${questId}" is not complete for period "${periodKey}" — refusing to reward`);
    this.name = 'QuestNotCompleteError';
  }
}

export type QuestRewardResult =
  | { status: 'claimed'; progress: number; xpAward: XpAward; ledgerEntry: LedgerEntry }
  | { status: 'already-claimed'; progress: number };

/**
 * Apply the reward for one completed quest in one period. Idempotent-safe:
 * the once-only claim gate (`claimed_at IS NULL`) means a second call never
 * grants a second reward.
 */
export async function applyQuestReward(
  db: AppDatabase,
  definition: QuestDefinition,
  periodKey: string,
): Promise<QuestRewardResult> {
  const rows = await db.quests.listProgressForPeriod(periodKey);
  const row = rows.find((r) => r.questId === definition.id);
  if (!row || row.completedAt === null || row.progress < definition.criteria.goal) {
    throw new QuestNotCompleteError(definition.id, periodKey);
  }
  if (row.claimedAt !== null) {
    return { status: 'already-claimed', progress: row.progress };
  }

  // Re-record the completed state (no-op when already recorded: progress is
  // monotonic-MAX and completedAt sticks).
  await db.quests.recordProgress({
    questId: definition.id,
    period: periodKey,
    progress: row.progress,
    completedAt: row.completedAt,
  });

  // The claim is the once-only commit point — rewards only after it succeeds.
  const claimed = await db.quests.claim(definition.id, periodKey);
  if (!claimed) {
    // Claimed between the read above and this call: someone else owns it.
    return { status: 'already-claimed', progress: row.progress };
  }

  const xpAward = await db.xpAwards.award(definition.reward.xp, 'quest', `quest:${definition.id}`);
  const ledgerEntry = await db.ledger.append({ amount: definition.reward.coins, reason: 'quest' });
  return { status: 'claimed', progress: row.progress, xpAward, ledgerEntry };
}

/** Map an engine definition onto the db row shape (for seeding at startup). */
export function toDbQuestDefinition(definition: QuestDefinition): DbQuestDefinition {
  return {
    id: definition.id,
    kind: definition.kind,
    title: definition.title,
    description: definition.description,
    criteria: definition.criteria,
    rewardXp: definition.reward.xp,
    rewardCurrency: definition.reward.coins,
    version: definition.version,
  };
}
