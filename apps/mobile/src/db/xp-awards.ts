import type { SQLiteAdapter } from './adapter';

/**
 * XP awards — engagement XP granted outside game sessions (quests,
 * achievements; constitution §17: one global level driven by XP). Append-only
 * (schema triggers reject UPDATE/DELETE); total XP = session XP +
 * awarded XP.
 */

export interface XpAward {
  id: number;
  amount: number;
  reason: string;
  /** Stable source identifier, e.g. `quest:play-three` or `achievement:first`. */
  source: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

interface XpAwardRow {
  id: number;
  amount: number;
  reason: string;
  source: string;
  created_at: number;
}

const INSERT = 'INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)';
const SELECT_TOTAL = 'SELECT COALESCE(SUM(amount), 0) AS total FROM xp_awards';
const SELECT_RECENT =
  'SELECT id, amount, reason, source, created_at FROM xp_awards ORDER BY id DESC LIMIT ?';

export class XpAwardsRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Append one award. Returns the persisted row. `txn` runs it inside a transaction (task 7.3). */
  async award(amount: number, reason: string, source: string, txn?: SQLiteAdapter): Promise<XpAward> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`xp award amount must be a positive integer, got ${amount}`);
    }
    const a = txn ?? this.adapter;
    const result = await a.run(INSERT, [amount, reason, source, this.now()]);
    return { id: result.lastInsertRowId, amount, reason, source, createdAt: this.now() };
  }

  /** Total XP awarded outside sessions (0 when none). */
  async getTotalAwardedXp(): Promise<number> {
    const row = await this.adapter.get<{ total: number }>(SELECT_TOTAL);
    return row?.total ?? 0;
  }

  /** Most recent awards, newest first. */
  async list(limit = 100): Promise<XpAward[]> {
    const rows = await this.adapter.all<XpAwardRow>(SELECT_RECENT, [limit]);
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      source: r.source,
      createdAt: r.created_at,
    }));
  }
}
