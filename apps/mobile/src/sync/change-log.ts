/**
 * Per-table change-tracking seam (campaign 010 W20; campaign 009 debt D3).
 *
 * The future sync needs to know WHAT changed locally since the last
 * successful push. This module freezes the change-log entry shape and the
 * tracker interface that db repositories will eventually call after mutations
 * — without touching `db/schema.ts` or any repository (no persistent change
 * log exists yet; the in-memory implementation below is the reference
 * semantics + test double).
 *
 * Determinism: sequence numbers come from a monotonic counter, never from
 * randomness or wall-clock alone, so two replays of the same mutation order
 * produce the same log.
 */

import type { SyncTableName } from './types';

/** Kind of local mutation. Tombstoned deletes are recorded as `'delete'`. */
export type ChangeOperation = 'upsert' | 'delete';

/**
 * One recorded local mutation. Shape is the frozen seam: a future persistent
 * change log must be able to produce exactly this.
 */
export interface ChangeLogEntry {
  /**
   * Process-wide monotonic sequence, 1-based, gap-free in the in-memory
   * implementation. Ordering authority for push batches; a future persistent
   * log keeps the same contract (strictly increasing per device).
   */
  readonly seq: number;
  readonly table: SyncTableName;
  /** Row identity within the table (primary key or natural key). */
  readonly rowId: string;
  readonly op: ChangeOperation;
  /** Unix epoch ms of the mutation, from the injectable clock. */
  readonly changedAt: number;
}

/** Opaque "everything up to here has been pushed" marker. */
export interface ChangeLogCursor {
  readonly lastSeq: number;
}

/** Input for recording a change (seq assigned, changedAt defaulted by the tracker). */
export type ChangeLogInput = Omit<ChangeLogEntry, 'seq' | 'changedAt'> & {
  /** Omit to use the tracker's clock; explicit values keep tests deterministic. */
  readonly changedAt?: number;
};

/**
 * The write-side seam. Repositories call `record` after committing a
 * mutation; the sync engine consumes `since(cursor)`. Kept synchronous:
 * recording must never make gameplay wait on sync infrastructure
 * (constitution §6: gameplay writes locally and never waits on network).
 */
export interface ChangeTracker {
  /** Append one mutation; returns its assigned sequence number. */
  record(input: ChangeLogInput): number;
  /** Current head — safe to persist as a cursor after a full push. */
  head(): ChangeLogCursor;
  /** All entries strictly after `cursor.seq`, ordered by ascending `seq`. */
  since(cursor: ChangeLogCursor): ChangeLogEntry[];
}

/**
 * In-memory reference implementation. NOT durable — it exists to pin the
 * semantics (monotonic gap-free seq, stable ordering) and to serve tests and
 * the no-op engine. A future campaign replaces this with a SQLite-backed
 * tracker implementing the same interface.
 */
export function createInMemoryChangeTracker(now: () => number = Date.now): ChangeTracker {
  let seq = 0;
  const entries: ChangeLogEntry[] = [];

  return {
    record(input: ChangeLogInput): number {
      seq += 1;
      entries.push({
        seq,
        table: input.table,
        rowId: input.rowId,
        op: input.op,
        // Explicit clock parameter wins; default keeps the zero-argument
        // ergonomics of the rest of the codebase.
        changedAt: input.changedAt ?? now(),
      });
      return seq;
    },
    head(): ChangeLogCursor {
      return { lastSeq: seq };
    },
    since(cursor: ChangeLogCursor): ChangeLogEntry[] {
      return entries.filter((e) => e.seq > cursor.lastSeq);
    },
  };
}

/**
 * Reduce a change list to at most one entry per `(table, rowId)` — the latest
 * by `seq`. Pure; input order does not matter for the result set, and the
 * output is sorted deterministically by `(table, rowId)` so push batches are
 * byte-stable. Coalescing before push avoids transmitting superseded ops
 * (e.g. an upsert followed by a delete sends only the tombstone).
 */
export function coalesceByRow(
  entries: readonly ChangeLogEntry[],
): ChangeLogEntry[] {
  const latest = new Map<string, ChangeLogEntry>();
  for (const entry of entries) {
    const key = `${entry.table}\u0000${entry.rowId}`;
    const current = latest.get(key);
    if (current === undefined || entry.seq > current.seq) {
      latest.set(key, entry);
    }
  }
  return [...latest.values()].sort((a, b) =>
    a.table === b.table
      ? a.rowId < b.rowId
        ? -1
        : a.rowId > b.rowId
          ? 1
          : 0
      : a.table < b.table
        ? -1
        : 1,
  );
}
