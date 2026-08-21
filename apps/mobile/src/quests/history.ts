/**
 * Quest history summarization (engagement V2, campaign 010 / W12).
 *
 * Quest progress rows are keyed by (questId, period) and are never deleted,
 * so the full completion/claim history already exists implicitly. This pure
 * module projects those rows into per-quest lifetime summaries for the UI
 * (history lists, "times completed" counters). No db access.
 */
import type { QuestProgress } from '@/db';

/** Lifetime summary of one quest across all recorded periods. */
export interface QuestHistorySummary {
  questId: string;
  /** Distinct periods with any progress row. */
  periodsPlayed: number;
  /** Periods where the quest reached its target (`completedAt` stamped). */
  completions: number;
  /** Periods whose reward was claimed. */
  claims: number;
  /** Most recent period with a completion, if any (period keys sort chronologically for daily/weekly). */
  lastCompletedPeriod: string | null;
  /** Most recent period with a claim, if any. */
  lastClaimedPeriod: string | null;
}

/**
 * Summarize progress rows into per-quest histories. Rows may come from
 * `db.quests.listAllProgress()` in any order; grouping is by quest id and
 * `lastCompletedPeriod` / `lastClaimedPeriod` take the MAX period key among
 * matching rows (period keys are zero-padded `YYYY-MM-DD` / `YYYY-Www`, so
 * lexicographic max = chronological max; longterm uses the `'all'` sentinel).
 */
export function summarizeQuestHistory(
  rows: readonly QuestProgress[],
): Map<string, QuestHistorySummary> {
  const summaries = new Map<string, QuestHistorySummary>();
  for (const row of rows) {
    let summary = summaries.get(row.questId);
    if (!summary) {
      summary = {
        questId: row.questId,
        periodsPlayed: 0,
        completions: 0,
        claims: 0,
        lastCompletedPeriod: null,
        lastClaimedPeriod: null,
      };
      summaries.set(row.questId, summary);
    }
    summary.periodsPlayed += 1;
    if (row.completedAt !== null) {
      summary.completions += 1;
      if (
        summary.lastCompletedPeriod === null ||
        row.period > summary.lastCompletedPeriod
      ) {
        summary.lastCompletedPeriod = row.period;
      }
    }
    if (row.claimedAt !== null) {
      summary.claims += 1;
      if (summary.lastClaimedPeriod === null || row.period > summary.lastClaimedPeriod) {
        summary.lastClaimedPeriod = row.period;
      }
    }
  }
  return summaries;
}
