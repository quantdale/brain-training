import type { SQLiteAdapter } from './adapter';

/**
 * Long-term achievements (constitution §18). Definitions are seeded from a
 * versioned app module; unlocks are once-per-achievement with `claimed_at`
 * gating the reward.
 */

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  /** Versioned opaque criteria document owned by the achievement engine. */
  criteria: unknown;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

export interface AchievementUnlock {
  achievementId: string;
  /** Unix epoch ms. */
  unlockedAt: number;
  /** Unix epoch ms when the reward was claimed, or null. */
  claimedAt: number | null;
}

interface AchievementRow {
  id: string;
  title: string;
  description: string;
  criteria_json: string;
  reward_xp: number;
  reward_currency: number;
  version: number;
}

interface UnlockRow {
  achievement_id: string;
  unlocked_at: number;
  claimed_at: number | null;
}

const UPSERT_DEFINITION = `
  INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    criteria_json = excluded.criteria_json,
    reward_xp = excluded.reward_xp,
    reward_currency = excluded.reward_currency,
    version = excluded.version`;
const SELECT_ALL = `SELECT id, title, description, criteria_json, reward_xp, reward_currency, version FROM achievements ORDER BY id`;
const INSERT_UNLOCK = 'INSERT OR IGNORE INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES (?, ?, ?)';
const SELECT_UNLOCK = 'SELECT achievement_id, unlocked_at, claimed_at FROM achievement_unlocks WHERE achievement_id = ?';
const SELECT_ALL_UNLOCKS = 'SELECT achievement_id, unlocked_at, claimed_at FROM achievement_unlocks ORDER BY unlocked_at';
const CLAIM_UNLOCK = 'UPDATE achievement_unlocks SET claimed_at = ? WHERE achievement_id = ? AND claimed_at IS NULL';

export class AchievementRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Seed/replace an achievement definition (idempotent upsert). */
  async upsertDefinition(definition: AchievementDefinition): Promise<void> {
    await this.adapter.run(UPSERT_DEFINITION, [
      definition.id,
      definition.title,
      definition.description,
      JSON.stringify(definition.criteria),
      definition.rewardXp,
      definition.rewardCurrency,
      definition.version,
    ]);
  }

  /** All achievement definitions, in id order. */
  async listDefinitions(): Promise<AchievementDefinition[]> {
    const rows = await this.adapter.all<AchievementRow>(SELECT_ALL);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      criteria: JSON.parse(r.criteria_json),
      rewardXp: r.reward_xp,
      rewardCurrency: r.reward_currency,
      version: r.version,
    }));
  }

  /**
   * Record an unlock (no-op when already unlocked). Returns whether this call
   * performed the unlock.
   */
  async unlock(achievementId: string): Promise<boolean> {
    const result = await this.adapter.run(INSERT_UNLOCK, [achievementId, this.now(), null]);
    return result.changes > 0;
  }

  async getUnlock(achievementId: string): Promise<AchievementUnlock | null> {
    const row = await this.adapter.get<UnlockRow>(SELECT_UNLOCK, [achievementId]);
    return row ? mapUnlockRow(row) : null;
  }

  /** All unlocks, oldest first. */
  async listUnlocks(): Promise<AchievementUnlock[]> {
    const rows = await this.adapter.all<UnlockRow>(SELECT_ALL_UNLOCKS);
    return rows.map(mapUnlockRow);
  }

  /** Mark an unlocked achievement's reward as claimed. */
  async claim(achievementId: string): Promise<boolean> {
    const result = await this.adapter.run(CLAIM_UNLOCK, [this.now(), achievementId]);
    return result.changes > 0;
  }
}

function mapUnlockRow(row: UnlockRow): AchievementUnlock {
  return {
    achievementId: row.achievement_id,
    unlockedAt: row.unlocked_at,
    claimedAt: row.claimed_at,
  };
}
