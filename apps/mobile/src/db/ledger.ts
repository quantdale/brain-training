import type { SQLiteAdapter } from './adapter';
import type { LedgerEntry } from './types';

/**
 * Append-only currency transaction ledger (constitution §17). Entries are
 * never mutated or deleted — the schema enforces this with triggers — and ids
 * are strictly monotonic (AUTOINCREMENT). The balance is always derived from
 * the ledger via the `currency_balance` view, never stored as a mutable
 * counter.
 */

interface LedgerRow {
  id: number;
  amount: number;
  reason: string;
  session_id: string | null;
  created_at: number;
}

const SELECT_ORDERED = `SELECT id, amount, reason, session_id, created_at
  FROM currency_ledger ORDER BY id ASC LIMIT ?`;
const SELECT_BALANCE = 'SELECT balance FROM currency_balance';
const INSERT_ENTRY =
  'INSERT INTO currency_ledger (amount, reason, session_id, created_at) VALUES (?, ?, ?, ?)';

function mapRow(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    sessionId: row.session_id,
    createdAt: row.created_at,
  };
}

export class LedgerRepository {
  /**
   * @param now Injectable clock (Unix epoch ms) so tests are deterministic.
   */
  constructor(
    private readonly adapter: SQLiteAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Append one entry. `createdAt` defaults to the injectable clock; callers
   * that append on behalf of a historical event (e.g. a completed session)
   * should pass the event's own timestamp for consistency.
   */
  async append(entry: { amount: number; reason: string; sessionId?: string | null; createdAt?: number }): Promise<LedgerEntry> {
    const createdAt = entry.createdAt ?? this.now();
    const sessionId = entry.sessionId ?? null;
    const result = await this.adapter.run(INSERT_ENTRY, [entry.amount, entry.reason, sessionId, createdAt]);
    return { id: result.lastInsertRowId, amount: entry.amount, reason: entry.reason, sessionId, createdAt };
  }

  /** Current balance derived from the whole ledger (0 when empty). */
  async getBalance(): Promise<number> {
    const row = await this.adapter.get<{ balance: number }>(SELECT_BALANCE);
    return row?.balance ?? 0;
  }

  /** Entries in ledger order (append order). */
  async list(limit = 100): Promise<LedgerEntry[]> {
    const rows = await this.adapter.all<LedgerRow>(SELECT_ORDERED, [limit]);
    return rows.map(mapRow);
  }
}
