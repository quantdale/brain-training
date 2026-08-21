/**
 * Public entry point for the sync-readiness seams (campaign 010 W20;
 * campaign 009 debt D3).
 *
 * This module freezes — without implementing — the vocabulary a future
 * signed-in sync will use: sync DTO conventions, per-table change-log shape,
 * conflict policies, and the SyncEngine transport interface. It contains NO
 * network code and performs NO database writes; the only implementations are
 * deterministic, offline-safe reference objects (in-memory change tracker,
 * no-op engine).
 *
 * Unrelated: `src/progression/sync.ts` (quest/achievement re-evaluation) is
 * an older, different use of the word "sync".
 */

export {
  SYNC_DTO_VERSION,
  SYNC_TABLE_DESCRIPTORS,
  SYNC_TABLE_NAMES,
  syncTableDescriptor,
  type SyncDto,
  type SyncMergeClass,
  type SyncProvenance,
  type SyncRecord,
  type SyncTableDescriptor,
  type SyncTableName,
} from './types';

export {
  coalesceByRow,
  createInMemoryChangeTracker,
  type ChangeLogCursor,
  type ChangeLogEntry,
  type ChangeLogInput,
  type ChangeOperation,
  type ChangeTracker,
} from './change-log';

export {
  resolveFieldMerge,
  resolveLastWriteWins,
  type ConflictPolicyDescriptor,
  type FieldMergeDescriptor,
  type FieldMergeRule,
  type FieldResolution,
  type LastWriteWinsDescriptor,
  type MergeResult,
} from './conflict';

export {
  createNoopSyncEngine,
  type PendingChange,
  type RemoteChange,
  type SyncCursor,
  type SyncEngine,
  type SyncPullResult,
  type SyncPushResult,
  type SyncRejection,
  type SyncStatus,
  type SyncStatusKind,
} from './engine';
