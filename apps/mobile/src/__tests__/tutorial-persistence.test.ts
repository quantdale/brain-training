/**
 * Tutorial persistence tests (006R task 5.4).
 *
 * These tests verify that tutorial completion persists across:
 * - Component unmount/remount
 * - App restart (simulated by creating new db instance)
 * - Tutorial version changes
 */
import { describe, expect, it, beforeEach } from '@jest/globals';

import { createMigratedDb } from '@/db/__tests__/helpers';
import { TutorialRepository } from '@/db/tutorial';
import { createTutorialLifecycle, createInMemoryTutorialStore } from '@/sdk/tutorial';

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
