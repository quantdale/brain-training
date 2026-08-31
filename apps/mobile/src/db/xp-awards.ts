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
  /** Stable source identifier, e.g. `quest:play-three:2026-08-30` or `achievement:first`. */
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
  'SELECT id, amount, reason, source, created_at FROM xp_awards';

function requireThroughMs(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`xp awards upper bound must be a safe integer (got ${String(value)})`);
  }
  return value;
}

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
    // Capture the clock once so the returned timestamp always equals the
    // stored `created_at` even if the injectable clock advances mid-call.
    const createdAt = this.now();
    if (!Number.isSafeInteger(createdAt)) {
      throw new Error(`xp award createdAt must be a safe integer (got ${String(createdAt)})`);
    }
    const a = txn ?? this.adapter;
    const result = await a.run(INSERT, [amount, reason, source, createdAt]);
    return { id: result.lastInsertRowId, amount, reason, source, createdAt };
  }

  /** Total XP awarded outside sessions (0 when none). */
  async getTotalAwardedXp(throughMs?: number): Promise<number> {
    const params = throughMs === undefined ? [] : [requireThroughMs(throughMs)];
    const row = await this.adapter.get<{ total: number }>(
      `${SELECT_TOTAL}${throughMs === undefined ? '' : ' WHERE created_at <= ?'}`,
      params,
    );
    return row?.total ?? 0;
  }

  /** Most recent awards, newest first. */
  async list(limit = 100, throughMs?: number): Promise<XpAward[]> {
    const bound = throughMs === undefined ? undefined : requireThroughMs(throughMs);
    const rows = await this.adapter.all<XpAwardRow>(
      `${SELECT_RECENT}${bound === undefined ? '' : ' WHERE created_at <= ?'} ORDER BY id DESC LIMIT ?`,
      bound === undefined ? [limit] : [bound, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      source: r.source,
      createdAt: r.created_at,
    }));
  }
}
