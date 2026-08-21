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
  operation_id: string | null;
}

const SELECT_ORDERED = `SELECT id, amount, reason, session_id, created_at, operation_id
  FROM currency_ledger ORDER BY id ASC LIMIT ?`;
const SELECT_RECENT = `SELECT id, amount, reason, session_id, created_at, operation_id
  FROM currency_ledger ORDER BY id DESC LIMIT ?`;
const SELECT_BALANCE = 'SELECT balance FROM currency_balance';
const SELECT_BY_OPERATION =
  'SELECT id, amount, reason, session_id, created_at, operation_id FROM currency_ledger WHERE operation_id = ?';
const INSERT_ENTRY =
  'INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)';

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
   * should pass the event's own timestamp for consistency. `operationId` is an
   * optional idempotency key (task 7.5): when supplied, an entry already
   * committed under the same key is returned instead of a duplicate, so a
   * retried caller cannot double-award. `txn` runs the insert on a transaction
   * connection (used by the economy service for atomic multi-step ops).
   */
  async append(
    entry: { amount: number; reason: string; sessionId?: string | null; createdAt?: number; operationId?: string | null },
    txn?: SQLiteAdapter,
  ): Promise<LedgerEntry> {
    const a = txn ?? this.adapter;
    const createdAt = entry.createdAt ?? this.now();
    const sessionId = entry.sessionId ?? null;
    const operationId = entry.operationId ?? null;
    if (operationId !== null) {
      const existing = await a.get<LedgerRow>(SELECT_BY_OPERATION, [operationId]);
      if (existing) {
        return mapRow(existing);
      }
    }
    const result = await a.run(INSERT_ENTRY, [entry.amount, entry.reason, sessionId, createdAt, operationId]);
    return { id: result.lastInsertRowId, amount: entry.amount, reason: entry.reason, sessionId, createdAt };
  }

  /** Current balance derived from the whole ledger (0 when empty). */
  async getBalance(txn?: SQLiteAdapter): Promise<number> {
    const row = await (txn ?? this.adapter).get<{ balance: number }>(SELECT_BALANCE);
    return row?.balance ?? 0;
  }

  /**
   * Look up an entry by its idempotency key (task 7.5). Returns null when no
   * entry carries that `operation_id`. Used by the economy service to make a
   * retried spend/claim/reroll return the original entry instead of
   * double-applying.
   */
  async getByOperation(operationId: string, txn?: SQLiteAdapter): Promise<LedgerEntry | null> {
    const row = await (txn ?? this.adapter).get<LedgerRow>(SELECT_BY_OPERATION, [operationId]);
    return row ? mapRow(row) : null;
  }

  /** Entries in ledger order (append order). */
  async list(limit = 100): Promise<LedgerEntry[]> {
    const rows = await this.adapter.all<LedgerRow>(SELECT_ORDERED, [limit]);
    return rows.map(mapRow);
  }

  /**
   * Most recent entries first (engagement V2 reward-history feed). Additive —
   * `list` keeps its append-order contract for existing callers.
   */
  async listRecent(limit = 100): Promise<LedgerEntry[]> {
    const rows = await this.adapter.all<LedgerRow>(SELECT_RECENT, [limit]);
    return rows.map(mapRow);
  }
}
