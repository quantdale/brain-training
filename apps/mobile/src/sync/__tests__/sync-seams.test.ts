/**
 * Focused unit tests for the pure sync-seam logic (campaign 010 W20).
 * Capped per the worker contract — semantics pinning, not a test suite.
 */
import { describe, expect, it } from '@jest/globals';
import {
  coalesceByRow,
  createInMemoryChangeTracker,
  createNoopSyncEngine,
  resolveFieldMerge,
  resolveLastWriteWins,
  SYNC_TABLE_DESCRIPTORS,
  SYNC_TABLE_NAMES,
} from '../index';
import type { SyncTableName } from '../types';

interface Row extends Record<string, unknown> {
  id: string;
  updatedAt: number;
  deleted: boolean;
  rating: number;
  note: string;
}

const row = (over: Partial<Row>): Row => ({
  id: 'row-1',
  updatedAt: 100,
  deleted: false,
  rating: 5,
  note: 'a',
  ...over,
});

describe('resolveLastWriteWins', () => {
  it('picks the later updatedAt and breaks ties by greater id, symmetric in argument order', () => {
    const older = row({ id: 'a', updatedAt: 100 });
    const newer = row({ id: 'b', updatedAt: 200 });
    expect(resolveLastWriteWins(older, newer)).toBe(newer);
    expect(resolveLastWriteWins(newer, older)).toBe(newer);

    const tieLow = row({ id: 'a', updatedAt: 100 });
    const tieHigh = row({ id: 'b', updatedAt: 100 });
    expect(resolveLastWriteWins(tieLow, tieHigh)).toBe(tieHigh);
    expect(resolveLastWriteWins(tieHigh, tieLow)).toBe(tieHigh);
  });
});

describe('resolveFieldMerge', () => {
  const policy = {
    kind: 'field-merge' as const,
    fields: { rating: 'max' as const },
    defaultRule: 'last-write-wins' as const,
  };

  it('merges independent edits: max preserves the best value, lww follows the newer record', () => {
    const local = row({ id: 'a', updatedAt: 200, rating: 7, note: 'local' });
    const remote = row({ id: 'b', updatedAt: 100, rating: 9, note: 'remote' });
    const { merged } = resolveFieldMerge(local, remote, policy);
    expect(merged.rating).toBe(9); // max rule
    expect(merged.note).toBe('local'); // lww -> newer record's field
    expect(merged.updatedAt).toBe(200); // merged sorts after both inputs
  });

  it('collapses to the LWW winner when either side is a tombstone', () => {
    const local = row({ id: 'a', updatedAt: 300, deleted: true });
    const remote = row({ id: 'b', updatedAt: 200, rating: 9 });
    const { merged, resolutions } = resolveFieldMerge(local, remote, policy);
    expect(merged.deleted).toBe(true);
    expect(resolutions).toEqual([]);
  });
});

describe('createInMemoryChangeTracker + coalesceByRow', () => {
  it('assigns gap-free monotonic seqs and since() returns entries strictly after a cursor', () => {
    const tracker = createInMemoryChangeTracker(() => 42);
    expect(tracker.record({ table: 'profile', rowId: 'p', op: 'upsert' })).toBe(1);
    expect(tracker.record({ table: 'game_favorites', rowId: 'g1', op: 'delete' })).toBe(2);
    expect(tracker.head()).toEqual({ lastSeq: 2 });

    const afterFirst = tracker.since({ lastSeq: 1 });
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].rowId).toBe('g1');
    expect(afterFirst[0].changedAt).toBe(42); // injectable clock used
  });

  it('coalesces superseded ops to one entry per row, sorted by (table, rowId)', () => {
    const e = (seq: number, table: SyncTableName, rowId: string, op: 'upsert' | 'delete') => ({
      seq,
      table,
      rowId,
      op,
      changedAt: seq,
    });
    const coalesced = coalesceByRow([
      e(1, 'game_sessions', 's2', 'upsert'),
      e(2, 'profile', 'p', 'upsert'),
      e(3, 'game_sessions', 's2', 'delete'), // supersedes seq 1
      e(4, 'game_sessions', 's1', 'upsert'),
    ]);
    expect(coalesced.map((c) => [c.table, c.rowId, c.op])).toEqual([
      ['game_sessions', 's1', 'upsert'],
      ['game_sessions', 's2', 'delete'],
      ['profile', 'p', 'upsert'],
    ]);
  });
});

describe('createNoopSyncEngine', () => {
  it('accepts every pending change and pulls nothing, offline and deterministically', async () => {
    const engine = createNoopSyncEngine();
    expect(engine.backendId).toBe('noop-local');

    const push = await engine.push(
      'device-1',
      [{ entry: { seq: 7, table: 'profile', rowId: 'p', op: 'upsert', changedAt: 1 } }],
      1234,
    );
    expect(push.acceptedSeqs).toEqual([7]);
    expect(push.rejected).toEqual([]);

    const pull = await engine.pull(null);
    expect(pull).toEqual({ cursor: null, changes: [], hasMore: false });
  });
});

describe('SYNC_TABLE_DESCRIPTORS', () => {
  it('covers every declared syncable table exactly once', () => {
    const names = SYNC_TABLE_DESCRIPTORS.map((d) => d.table);
    expect(names).toEqual(SYNC_TABLE_NAMES);
    expect(new Set(names).size).toBe(names.length);
    // Tables whose SQLite PK is AUTOINCREMENT (integer, device-local) must
    // declare the natural key future merges dedupe on.
    for (const d of SYNC_TABLE_DESCRIPTORS) {
      if (
        d.table === 'currency_ledger' ||
        d.table === 'rating_history' ||
        d.table === 'xp_awards'
      ) {
        expect(d.naturalKey).toBeDefined();
      }
    }
  });
});
