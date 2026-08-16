import type { SQLiteAdapter } from './adapter';

/**
 * Quest definitions + per-period progress (constitution §18: daily/weekly
 * quests). Definitions are seeded from a versioned app module; progress rows
 * are keyed by period (daily -> local date `YYYY-MM-DD`, weekly -> ISO week
 * `YYYY-Www`). `completed_at` / `claimed_at` gate rewards.
 */

export type QuestKind = 'daily' | 'weekly' | 'longterm';

export interface QuestDefinition {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  /** Versioned opaque criteria document owned by the quest engine. */
  criteria: unknown;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

export interface QuestProgress {
  questId: string;
  period: string;
  /** Raw progress toward the criteria target (0..target). */
  progress: number;
  /** Unix epoch ms when the target was reached, or null. */
  completedAt: number | null;
  /** Unix epoch ms when the reward was claimed, or null. */
  claimedAt: number | null;
}

export interface QuestProgressUpdate {
  questId: string;
  period: string;
  /** Absolute new progress value (>= 0); the row keeps the max seen. */
  progress: number;
  /** Called when progress first reaches `target` (definitions provide it). */
  completedAt?: number | null;
}

interface QuestRow {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  criteria_json: string;
  reward_xp: number;
  reward_currency: number;
  version: number;
}

interface QuestProgressRow {
  quest_id: string;
  period: string;
  progress: number;
  completed_at: number | null;
  claimed_at: number | null;
}

const UPSERT_DEFINITION = `
  INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    kind = excluded.kind,
    title = excluded.title,
    description = excluded.description,
    criteria_json = excluded.criteria_json,
    reward_xp = excluded.reward_xp,
    reward_currency = excluded.reward_currency,
    version = excluded.version`;
const SELECT_ALL = `SELECT id, kind, title, description, criteria_json, reward_xp, reward_currency, version FROM quests ORDER BY id`;
const SELECT_PROGRESS =
  'SELECT quest_id, period, progress, completed_at, claimed_at FROM quest_progress WHERE quest_id = ? AND period = ?';
const UPSERT_PROGRESS = `
  INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (quest_id, period) DO UPDATE SET
    progress = MAX(quest_progress.progress, excluded.progress),
    completed_at = COALESCE(quest_progress.completed_at, excluded.completed_at),
    claimed_at = COALESCE(quest_progress.claimed_at, excluded.claimed_at)`;
const CLAIM_PROGRESS =
  'UPDATE quest_progress SET claimed_at = ? WHERE quest_id = ? AND period = ? AND claimed_at IS NULL';
const SELECT_PERIOD_PROGRESS =
  'SELECT quest_id, period, progress, completed_at, claimed_at FROM quest_progress WHERE period = ? ORDER BY quest_id';

export class QuestRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Seed/replace a quest definition (idempotent upsert). */
  async upsertDefinition(definition: QuestDefinition): Promise<void> {
    await this.adapter.run(UPSERT_DEFINITION, [
      definition.id,
      definition.kind,
      definition.title,
      definition.description,
      JSON.stringify(definition.criteria),
      definition.rewardXp,
      definition.rewardCurrency,
      definition.version,
    ]);
  }

  /** All quest definitions, in id order. */
  async listDefinitions(): Promise<QuestDefinition[]> {
    const rows = await this.adapter.all<QuestRow>(SELECT_ALL);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      criteria: JSON.parse(r.criteria_json),
      rewardXp: r.reward_xp,
      rewardCurrency: r.reward_currency,
      version: r.version,
    }));
  }

  /**
   * Record progress for one quest in a period. Monotonic: a lower value never
   * reduces stored progress; `completedAt` sticks once set. Returns the row.
   */
  async recordProgress(update: QuestProgressUpdate): Promise<QuestProgress> {
    const current = await this.adapter.get<QuestProgressRow>(SELECT_PROGRESS, [
      update.questId,
      update.period,
    ]);
    const completedAt =
      update.completedAt !== undefined
        ? update.completedAt
        : (current?.completed_at ?? null);
    await this.adapter.run(UPSERT_PROGRESS, [
      update.questId,
      update.period,
      Math.max(0, update.progress),
      completedAt,
      current?.claimed_at ?? null,
    ]);
    const row = await this.adapter.get<QuestProgressRow>(SELECT_PROGRESS, [
      update.questId,
      update.period,
    ]);
    if (!row) {
      throw new Error(`quest progress row missing after upsert (${update.questId}/${update.period})`);
    }
    return mapProgressRow(row);
  }

  /** Progress for all quests in one period. */
  async listProgressForPeriod(period: string): Promise<QuestProgress[]> {
    const rows = await this.adapter.all<QuestProgressRow>(SELECT_PERIOD_PROGRESS, [period]);
    return rows.map(mapProgressRow);
  }

  /**
   * Mark a completed quest's reward as claimed. Returns true when this call
   * performed the claim (the row was not already claimed).
   */
  async claim(questId: string, period: string): Promise<boolean> {
    const result = await this.adapter.run(CLAIM_PROGRESS, [this.now(), questId, period]);
    return result.changes > 0;
  }
}

function mapProgressRow(row: QuestProgressRow): QuestProgress {
  return {
    questId: row.quest_id,
    period: row.period,
    progress: row.progress,
    completedAt: row.completed_at,
    claimedAt: row.claimed_at,
  };
}
