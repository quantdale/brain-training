/**
 * Finding 1: the focus-time progression-sync gate.
 *
 * Pins the two required behaviors at the decision level: repeated focuses
 * inside the window sync once, and a changed newest-session fingerprint (a
 * completion performed in-app) always forces a sync. Also pins the concurrent
 * dedupe: a focus bounce can start two loads, which must share one sync.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AppDatabase } from '@/db';
import {
  FOCUS_PROGRESSION_SYNC_MIN_MS,
  lastSyncedQuestSnapshot,
  markProgressionSynced,
  progressionFocusSyncDue,
  progressionInputFingerprint,
  readNewestProgressionInput,
  resetProgressionFocusSyncForTests,
  runProgressionSync,
  shouldSyncProgression,
} from '@/progression/focus-sync';
import type { QuestSnapshot } from '@/quests';

const SNAPSHOT: QuestSnapshot = {
  sessions: [],
  lifetime: { sessionCount: 0, totalXp: 0 },
};

describe('progression focus-sync gate', () => {
  beforeEach(() => {
    resetProgressionFocusSyncForTests();
  });

  it('syncs on first focus, then throttles repeated focuses inside the window', () => {
    // A fresh gate has no fingerprint: the first focus always syncs.
    expect(shouldSyncProgression(0, 1_000, '', null)).toBe(true);
    expect(progressionFocusSyncDue(1_000, '')).toBe(true);
    markProgressionSynced(1_000, '', SNAPSHOT);

    expect(progressionFocusSyncDue(1_100, '')).toBe(false);
    // The boundary is exclusive: exactly at the window end still throttles.
    expect(progressionFocusSyncDue(1_000 + FOCUS_PROGRESSION_SYNC_MIN_MS, '')).toBe(false);
    expect(progressionFocusSyncDue(1_000 + FOCUS_PROGRESSION_SYNC_MIN_MS + 1, '')).toBe(true);
  });

  it('a changed fingerprint (a completion) syncs inside the window', () => {
    markProgressionSynced(1_000, 'session-1@100', SNAPSHOT);

    expect(progressionFocusSyncDue(1_100, 'session-2@200')).toBe(true);
    expect(progressionFocusSyncDue(1_100, 'session-1@100')).toBe(false);
  });

  it('fingerprints the newest session and maps an absent one to empty', () => {
    expect(progressionInputFingerprint(null)).toBe('');
    expect(progressionInputFingerprint({ id: 'session-1', completedAt: 100 })).toBe(
      'session-1@100',
    );
  });

  it('exposes the last snapshot only after a successful sync', () => {
    expect(lastSyncedQuestSnapshot()).toBeNull();
    markProgressionSynced(1_000, '', SNAPSHOT);
    expect(lastSyncedQuestSnapshot()).toBe(SNAPSHOT);
  });

  it('shares one in-flight sync between concurrent loads', async () => {
    let resolveSync!: (snapshot: QuestSnapshot) => void;
    const sync = jest.fn(
      () =>
        new Promise<QuestSnapshot>((resolve) => {
          resolveSync = resolve;
        }),
    );

    const first = runProgressionSync(sync, new Date(1_000), 'session-1@100');
    const second = runProgressionSync(sync, new Date(1_000), 'session-1@100');
    expect(sync).toHaveBeenCalledTimes(1);

    resolveSync(SNAPSHOT);
    await expect(first).resolves.toBe(SNAPSHOT);
    await expect(second).resolves.toBe(SNAPSHOT);
    expect(progressionFocusSyncDue(1_100, 'session-1@100')).toBe(false);
  });

  it('leaves the window open when a sync fails so the next focus retries', async () => {
    const failing = jest.fn(async () => {
      throw new Error('sync boom');
    });

    await expect(runProgressionSync(failing, new Date(1_000), '')).rejects.toThrow('sync boom');
    expect(progressionFocusSyncDue(1_100, '')).toBe(true);
    expect(lastSyncedQuestSnapshot()).toBeNull();
  });

  it('reads the newest session defensively', async () => {
    const full = {
      sessions: { listRecent: async () => [{ id: 'session-1', completedAt: 42 }] },
    } as unknown as AppDatabase;
    expect(await readNewestProgressionInput(full, 100)).toEqual({
      id: 'session-1',
      completedAt: 42,
    });

    const partial = { sessions: {} } as unknown as AppDatabase;
    expect(await readNewestProgressionInput(partial, 100)).toBeNull();

    const broken = {
      sessions: {
        listRecent: async () => {
          throw new Error('read boom');
        },
      },
    } as unknown as AppDatabase;
    expect(await readNewestProgressionInput(broken, 100)).toBeNull();
  });
});
