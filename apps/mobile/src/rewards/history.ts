/**
 * Reward history feed (engagement V2, campaign 010 / W12).
 *
 * Projects the two append-only reward records — `xp_awards` and the currency
 * ledger — into one unified, newest-first feed so players can see HOW and
 * WHEN every XP/coin grant happened (constitution §17: append-only ledger;
 * unlock provenance). Pure projection: nothing here mutates state.
 */
import type { AppDatabase, LedgerEntry, XpAward } from '@/db';

/** One merged reward-history entry. */
export interface RewardHistoryEntry {
  /** Stable id (`xp:<rowId>` / `coins:<rowId>`). */
  id: string;
  /** Unix epoch ms the reward was recorded. */
  at: number;
  /** XP granted (xp_awards rows only). */
  xp?: number;
  /** Coins granted/spent (ledger rows; negative = spend). */
  coins?: number;
  /** Human-readable source label ("Quest reward", "Cosmetic purchase", …). */
  label: string;
  /** Optional detail line (source/operation identifier). */
  detail?: string;
}

/**
 * Map an xp_award onto a label. `source` values follow the `<kind>:<id>`
 * convention used by the claim flows (`quest:qd3`, `achievement:ach-first`,
 * `milestone:mil-7`).
 */
export function describeXpSource(source: string): { label: string; detail?: string } {
  const [kind, ...rest] = source.split(':');
  const id = rest.join(':');
  switch (kind) {
    case 'quest':
      return { label: 'Quest reward', detail: id || undefined };
    case 'achievement':
      return { label: 'Achievement reward', detail: id || undefined };
    case 'streak-milestone':
      return { label: 'Streak milestone', detail: id || undefined };
    default:
      return { label: 'XP award', detail: source || undefined };
  }
}

/**
 * Map a ledger reason onto a label. Reasons are the short tokens written by
 * the economy/claim flows (`gameplay`, `quest`, `achievement`,
 * `streak-milestone`, `cosmetic`, `reroll`, `streak-item-<kind>`).
 */
export function describeLedgerReason(reason: string): { label: string; detail?: string } {
  if (reason.startsWith('streak-item')) {
    return { label: 'Streak item', detail: reason.slice('streak-item-'.length) || undefined };
  }
  switch (reason) {
    case 'gameplay':
      return { label: 'Session reward' };
    case 'quest':
      return { label: 'Quest reward' };
    case 'achievement':
      return { label: 'Achievement reward' };
    case 'streak-milestone':
      return { label: 'Streak milestone' };
    case 'cosmetic':
      return { label: 'Cosmetic purchase' };
    case 'reroll':
      return { label: 'Workout reroll' };
    default:
      return { label: 'Coin update', detail: reason || undefined };
  }
}

/**
 * Merge xp awards + ledger entries into one newest-first feed. Ties break by
 * row id descending (later insert first), then by id string for total
 * determinism. Returns at most `limit` entries.
 */
export function mergeRewardHistory(
  xpAwards: readonly XpAward[],
  ledgerEntries: readonly LedgerEntry[],
  limit = 20,
): RewardHistoryEntry[] {
  const merged: RewardHistoryEntry[] = [];
  for (const award of xpAwards) {
    const { label, detail } = describeXpSource(award.source);
    merged.push({
      id: `xp:${award.id}`,
      at: award.createdAt,
      xp: award.amount,
      label,
      detail,
    });
  }
  for (const entry of ledgerEntries) {
    const { label, detail } = describeLedgerReason(entry.reason);
    merged.push({
      id: `coins:${entry.id}`,
      at: entry.createdAt,
      coins: entry.amount,
      label,
      detail,
    });
  }
  merged.sort(
    (a, b) => b.at - a.at || b.id.localeCompare(a.id),
  );
  return merged.slice(0, Math.max(0, limit));
}

/** Load the merged reward history from the db (newest first). */
export async function loadRewardHistory(
  db: AppDatabase,
  limit = 20,
): Promise<RewardHistoryEntry[]> {
  const [xpAwards, ledgerEntries] = await Promise.all([
    db.xpAwards.list(limit),
    db.ledger.listRecent(limit),
  ]);
  return mergeRewardHistory(xpAwards, ledgerEntries, limit);
}
