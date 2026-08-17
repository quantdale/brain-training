// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { createTutorialLifecycle, createInMemoryTutorialStore } from '../tutorial';
import type { TutorialStore } from '../tutorial';

describe('TutorialLifecycle', () => {
  it('shows on first play, hides after completion', () => {
    const tutorial = createTutorialLifecycle();
    expect(tutorial.shouldShowTutorial('memory-sequence')).toBe(true);
    tutorial.complete('memory-sequence');
    expect(tutorial.shouldShowTutorial('memory-sequence')).toBe(false);
  });

  it('is per-game', () => {
    const tutorial = createTutorialLifecycle();
    tutorial.complete('memory-sequence');
    expect(tutorial.shouldShowTutorial('memory-sequence')).toBe(false);
    expect(tutorial.shouldShowTutorial('math-facts')).toBe(true);
  });

  it('replays after requestReplay and clears on complete', () => {
    const tutorial = createTutorialLifecycle();
    tutorial.complete('game-a');
    tutorial.requestReplay('game-a');
    expect(tutorial.shouldShowTutorial('game-a')).toBe(true);
    tutorial.clearReplay('game-a');
    expect(tutorial.shouldShowTutorial('game-a')).toBe(false);
  });

  it('skipForQa bypasses the tutorial in dev builds', () => {
    const tutorial = createTutorialLifecycle();
    tutorial.skipForQa('game-b');
    expect(tutorial.getState('game-b')).toEqual({ completed: true, replayRequested: false, version: '1.0.0' });
    expect(tutorial.shouldShowTutorial('game-b')).toBe(false);
  });

  it('persists through a pluggable store', () => {
    const writes: Array<{ gameId: string; state: unknown }> = [];
    const store: TutorialStore = {
      getTutorialState: () => null,
      setTutorialState: (gameId, state) => writes.push({ gameId, state }),
    };
    const tutorial = createTutorialLifecycle(store);
    tutorial.complete('game-c');
    expect(writes).toEqual([
      { gameId: 'game-c', state: { completed: true, replayRequested: false, version: '1.0.0' } },
    ]);
  });

  it('defaults a never-seen game to not-completed', () => {
    const tutorial = createTutorialLifecycle();
    expect(tutorial.getState('never-seen')).toEqual({ completed: false, replayRequested: false, version: null });
  });

  it('in-memory store round-trips state', () => {
    const store = createInMemoryTutorialStore();
    store.setTutorialState('x', { completed: true, replayRequested: true, version: '1.0.0' });
    expect(store.getTutorialState('x')).toEqual({ completed: true, replayRequested: true, version: '1.0.0' });
    expect(store.getTutorialState('y')).toBeNull();
  });
});
