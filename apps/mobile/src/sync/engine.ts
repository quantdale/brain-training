/**
 * SyncEngine seam + no-op local implementation (campaign 010 W20; campaign
 * 009 debt D3).
 *
 * The interface skeleton a future backend adapter (Supabase is the preferred
 * direction, constitution §6) must satisfy. NOTHING here performs I/O: the
 * only implementation is `createNoopSyncEngine`, which resolves locally and
 * transmits nothing, so the app can already depend on the seam shape without
 * gaining any network behavior.
 *
 * Contract notes for future implementations (frozen now so call sites can be
 * written against them):
 * - `push` is idempotent per change identity — retrying after a crash must
 *   not duplicate effects (the ledger's `operation_id` pattern, generalized).
 * - `pull` returns changes strictly after the given cursor; a null cursor
 *   means "from the beginning" (first sign-in on a fresh device).
 * - Engines never mutate local state directly; they return data that the
 *   caller resolves through the conflict policies (`conflict.ts`) and applies
 *   in one transaction. This keeps merge decisions inspectable and testable.
 */

import type { ChangeLogEntry } from './change-log';
import type { SyncDto, SyncProvenance, SyncTableName } from './types';

/* ------------------------------------------------------------------ */
/* Push side                                                           */
/* ------------------------------------------------------------------ */

/** One pending local change plus its payload (absent payload = tombstone). */
export interface PendingChange {
  readonly entry: ChangeLogEntry;
  /**
   * Current DTO of the row. Required for `'upsert'`; may be omitted for
   * `'delete'` (the tombstone itself travels as a deleted DTO when the
   * backend needs one).
   */
  readonly dto?: SyncDto;
}

/** Result of offering pending changes to an engine. */
export interface SyncPushResult {
  /** Seqs accepted by the backend; safe to advance the local cursor past. */
  readonly acceptedSeqs: readonly number[];
  /** Seqs refused, with a stable machine-readable reason each. */
  readonly rejected: readonly SyncRejection[];
}

export interface SyncRejection {
  readonly seq: number;
  readonly reason: string;
}

/* ------------------------------------------------------------------ */
/* Pull side                                                           */
/* ------------------------------------------------------------------ */

/** Opaque backend progress marker. Shapes are engine-specific. */
export type SyncCursor = string | number | null;

/** One remote change offered to the local merger. */
export interface RemoteChange<T extends SyncDto = SyncDto> {
  readonly table: SyncTableName;
  readonly dto: T & SyncProvenance;
}

export interface SyncPullResult {
  /** New cursor to persist ONLY after the batch is durably applied. */
  readonly cursor: SyncCursor;
  readonly changes: readonly RemoteChange[];
  /**
   * True when more data is available past `cursor` — engines may paginate;
   * callers loop until false.
   */
  readonly hasMore: boolean;
}

/* ------------------------------------------------------------------ */
/* Engine interface                                                    */
/* ------------------------------------------------------------------ */

/** Lifecycle/state snapshot a future UI or diagnostics layer can read. */
export type SyncStatusKind = 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  readonly kind: SyncStatusKind;
  /** Unix epoch ms of the last fully completed sync cycle; null if never. */
  readonly lastCompletedAt: number | null;
  /** Human-readable detail for the last error, if kind === 'error'. */
  readonly errorDetail?: string;
}

/**
 * The transport seam. Implementations are ASYNCHRONOUS and may fail; the
 * no-op implementation below never does. No method reads the wall clock
 * internally — timestamps arrive from injectable clocks at the call sites.
 */
export interface SyncEngine {
  /** Backend identity for provenance/diagnostics, e.g. `'noop-local'`. */
  readonly backendId: string;
  push(
    deviceId: string,
    changes: readonly PendingChange[],
    nowMs: number,
  ): Promise<SyncPushResult>;
  pull(cursor: SyncCursor): Promise<SyncPullResult>;
}

/* ------------------------------------------------------------------ */
/* No-op local implementation                                          */
/* ------------------------------------------------------------------ */

/**
 * Local-only engine: accepts every change (so callers can advance their
 * cursors in dev flows) and always pulls nothing. Deterministic, offline,
 * zero dependencies — the app runs identically with it installed forever.
 */
export function createNoopSyncEngine(): SyncEngine {
  return {
    backendId: 'noop-local',

    async push(_deviceId, changes, _nowMs): Promise<SyncPushResult> {
      return {
        acceptedSeqs: changes.map((c) => c.entry.seq),
        rejected: [],
      };
    },

    async pull(cursor): Promise<SyncPullResult> {
      // Even a no-op engine must preserve the caller's opaque cursor. This
      // keeps a future adapter's "no changes" response composable and avoids
      // accidentally rewinding durable sync progress during offline cycles.
      return { cursor, changes: [], hasMore: false };
    },
  };
}
