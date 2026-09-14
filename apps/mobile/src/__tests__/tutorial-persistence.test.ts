/**
 * Tutorial persistence tests (006R task 5.4).
 *
 * These tests verify that tutorial completion persists across:
 * - Component unmount/remount
 * - App restart (simulated by creating new db instance)
 * - Tutorial version changes
 */
import { describe, expect, it, beforeEach } from '@jest/globals';

import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { TutorialRepository } from '@/db/tutorial';
import {
  applyImport,
  exportLocalData,
  parseAndValidateBackup,
  serializeBackup,
  wipeLocalData,
} from '@/data-portability';
import {
  createTutorialLifecycle,
  createInMemoryTutorialStore,
  createWriteThroughTutorialStore,
} from '@/sdk/tutorial';
import type { TutorialStore } from '@/sdk/tutorial';

const T0 = 1_700_000_000_000;

describe('Tutorial persistence via db layer', () => {
  let adapter: Awaited<ReturnType<typeof createMigratedDb>>;
  let tutorials: TutorialRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    tutorials = new TutorialRepository(adapter, () => T0);
  });

  it('persists tutorial completion', async () => {
    // Simulate tutorial completion
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });

    // Retrieve and verify
    const state = await tutorials.getTutorialState('memory');
    expect(state).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });

  it('persists replay request', async () => {
    // First complete the tutorial
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });

    // Request replay
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: true,
      version: '1.0.0',
    });

    // Verify replay is persisted
    const state = await tutorials.getTutorialState('memory');
    expect(state?.replayRequested).toBe(true);
  });

  it('handles tutorial version changes', async () => {
    // Complete tutorial v1
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });

    // Update to v2 (new tutorial content)
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: false,
      version: '2.0.0',
    });

    // Verify version is updated
    const state = await tutorials.getTutorialState('memory');
    expect(state?.version).toBe('2.0.0');
  });

  it('returns null for unseen games', async () => {
    const state = await tutorials.getTutorialState('nonexistent');
    expect(state).toBeNull();
  });

  it('simulates app restart by creating new repository instance', async () => {
    // Complete tutorial
    await tutorials.setTutorialState('memory', {
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });

    // Create new repository instance (simulating app restart)
    const newTutorials = new TutorialRepository(adapter, () => T0 + 1000);

    // Verify persistence survived the "restart"
    const state = await newTutorials.getTutorialState('memory');
    expect(state).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });
});

describe('TutorialLifecycle with in-memory store', () => {
  it('shouldShowTutorial returns true for unseen games', () => {
    const store = createInMemoryTutorialStore();
    const lifecycle = createTutorialLifecycle(store, '1.0.0');
    expect(lifecycle.shouldShowTutorial('memory')).toBe(true);
  });

  it('shouldShowTutorial returns false after completion', () => {
    const store = createInMemoryTutorialStore();
    const lifecycle = createTutorialLifecycle(store, '1.0.0');
    lifecycle.complete('memory');
    expect(lifecycle.shouldShowTutorial('memory')).toBe(false);
  });

  it('shouldShowTutorial returns true after version change', () => {
    const store = createInMemoryTutorialStore();
    
    // Complete with v1
    const lifecycle1 = createTutorialLifecycle(store, '1.0.0');
    lifecycle1.complete('memory');
    expect(lifecycle1.shouldShowTutorial('memory')).toBe(false);
    
    // New version v2 should show again
    const lifecycle2 = createTutorialLifecycle(store, '2.0.0');
    expect(lifecycle2.shouldShowTutorial('memory')).toBe(true);
  });
});

describe('In-memory tutorial store', () => {
  it('works correctly for tests', () => {
    const store = createInMemoryTutorialStore();
    const lifecycle = createTutorialLifecycle(store, '1.0.0');
    
    // Should show on first play
    expect(lifecycle.shouldShowTutorial('memory')).toBe(true);
    
    // Complete
    lifecycle.complete('memory');
    expect(lifecycle.shouldShowTutorial('memory')).toBe(false);
    
    // Request replay
    lifecycle.requestReplay('memory');
    expect(lifecycle.shouldShowTutorial('memory')).toBe(true);
    
    // Clear replay
    lifecycle.clearReplay('memory');
    expect(lifecycle.shouldShowTutorial('memory')).toBe(false);
  });
});

/**
 * Production write-through store (frontier audit `persistent-game-tutorials`):
 * the SDK lifecycle is synchronous, but every mutation must land in
 * `tutorial_state` so first-play completion survives process death.
 */
async function hydratePersistentStore(
  repository: TutorialRepository,
  gameId: string,
  tutorialVersion = '1.0.0',
) {
  const persisted = await repository.getTutorialState(gameId);
  const store = createWriteThroughTutorialStore({
    initial: persisted === null ? {} : { [gameId]: persisted },
    persist: (id, state) => repository.setTutorialState(id, state),
  });
  return { store, lifecycle: createTutorialLifecycle(store, tutorialVersion) };
}

describe('WriteThroughTutorialStore over the repository', () => {
  it('completes durably: a fresh repository sees completion (restart)', async () => {
    const adapter = await createMigratedDb();
    const repository = new TutorialRepository(adapter, () => T0);
    const { store, lifecycle } = await hydratePersistentStore(repository, 'memory');

    expect(lifecycle.shouldShowTutorial('memory')).toBe(true);
    lifecycle.complete('memory');
    await store.flush();

    // "Restart": a new repository instance reads the same durable store.
    const restarted = await hydratePersistentStore(
      new TutorialRepository(adapter, () => T0 + 1000),
      'memory',
    );
    expect(restarted.lifecycle.shouldShowTutorial('memory')).toBe(false);
    expect(restarted.store.getTutorialState('memory')).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });

  it('replay request survives a restart and clears after the replay completes', async () => {
    const adapter = await createMigratedDb();
    const repository = new TutorialRepository(adapter, () => T0);
    const { store, lifecycle } = await hydratePersistentStore(repository, 'memory');
    lifecycle.complete('memory');
    await store.flush();

    lifecycle.requestReplay('memory');
    await store.flush();

    const restarted = await hydratePersistentStore(
      new TutorialRepository(adapter, () => T0 + 1000),
      'memory',
    );
    expect(restarted.lifecycle.shouldShowTutorial('memory')).toBe(true);

    restarted.lifecycle.complete('memory');
    await restarted.store.flush();
    expect(restarted.lifecycle.shouldShowTutorial('memory')).toBe(false);
  });

  it('writes land in mutation order (complete then replay)', async () => {
    const adapter = await createMigratedDb();
    const repository = new TutorialRepository(adapter, () => T0);
    const { store, lifecycle } = await hydratePersistentStore(repository, 'memory');

    lifecycle.complete('memory');
    lifecycle.requestReplay('memory');
    await store.flush();

    expect(await repository.getTutorialState('memory')).toEqual({
      completed: true,
      replayRequested: true,
      version: '1.0.0',
    });
  });

  it('reports persistence failures without throwing through the lifecycle', async () => {
    const failures: unknown[] = [];
    const store: TutorialStore = createWriteThroughTutorialStore({
      initial: {},
      persist: () => Promise.reject(new Error('disk full')),
      onPersistError: (_gameId, error) => failures.push(error),
    });
    const lifecycle = createTutorialLifecycle(store);

    lifecycle.complete('memory');
    await (store as ReturnType<typeof createWriteThroughTutorialStore>).flush();

    expect(failures).toHaveLength(1);
    // The player-visible state stays completed; the next cold start decides.
    expect(lifecycle.shouldShowTutorial('memory')).toBe(false);
  });

  it('export → wipe → import carries gameplay tutorial writes', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter, { now: () => T0 });
    await db.profile.ensureExists();

    const { store, lifecycle } = await hydratePersistentStore(db.tutorials, 'memory');
    lifecycle.complete('memory');
    await store.flush();

    const envelope = await exportLocalData(db, { now: () => T0 + 1 });
    const parsed = parseAndValidateBackup(serializeBackup(envelope));

    await wipeLocalData(db);
    expect(await db.tutorials.getTutorialState('memory')).toBeNull();

    await applyImport(db, parsed, 'replace');

    const restored = await hydratePersistentStore(db.tutorials, 'memory');
    expect(restored.lifecycle.shouldShowTutorial('memory')).toBe(false);
  });
});
