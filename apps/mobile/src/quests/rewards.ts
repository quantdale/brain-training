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
 * detect that via `claimedAt` vs `xp_awards`. The ledger entry also carries a
 * stable, PERIOD-SCOPED `operationId` (`quest:<id>:<period>`, unique by the
 * schema's partial index) — quests recur every period, so the key must scope
 * to the claimed period while still making a retried claim/import of the same
 * period impossible to double-append.
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
  // All reads/claims/awards run inside one transaction (task 7.3): the claim
  // marker, the XP award, and the currency ledger entry commit together or roll
  // back as one, so a crash can never leave a partial reward.
  return db.transaction(async (txn) => {
    const rows = await db.quests.listProgressForPeriod(periodKey, txn);
    const row = rows.find((r) => r.questId === definition.id);
    if (!row || row.completedAt === null || row.progress < definition.criteria.goal) {
      throw new QuestNotCompleteError(definition.id, periodKey);
    }
    if (row.claimedAt !== null) {
      return { status: 'already-claimed', progress: row.progress };
    }

    // The claim is the once-only commit point — rewards only after it succeeds.
    const claimed = await db.quests.claim(definition.id, periodKey, txn);
    if (!claimed) {
      // Claimed between the read above and this call: someone else owns it.
      return { status: 'already-claimed', progress: row.progress };
    }

    const xpAward = await db.xpAwards.award(
      definition.reward.xp,
      'quest',
      `quest:${definition.id}`,
      txn,
    );
    const ledgerEntry = await db.ledger.append(
      {
        amount: definition.reward.coins,
        reason: 'quest',
        // Period-scoped idempotency key: quests recur per period, so the key
        // must distinguish periods while pinning one entry per claimed period.
        operationId: `quest:${definition.id}:${periodKey}`,
      },
      txn,
    );
    return { status: 'claimed', progress: row.progress, xpAward, ledgerEntry };
  });
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
