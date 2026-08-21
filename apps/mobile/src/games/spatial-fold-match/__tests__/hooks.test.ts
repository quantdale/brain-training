// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';

import {
  createSpatialFoldMatchQaForceStateHooks,
  createSpatialFoldMatchTutorialLifecycle,
} from '../hooks';
import { GAME_ID } from '../types';

describe('createSpatialFoldMatchQaForceStateHooks', () => {
  it('dispatches the matching reducer action for each hook', () => {
    const dispatch = jest.fn();
    const hooks = createSpatialFoldMatchQaForceStateHooks(dispatch);

    hooks.forceWin();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'qa/force-win' });

    hooks.forceLose();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'qa/force-lose' });

    hooks.forceState?.({ seed: 'abc', difficulty: 'hard' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'qa/force-state',
      patch: { seed: 'abc', difficulty: 'hard' },
    });
  });

  it('is bound to the game id and runs in dev builds', () => {
    const hooks = createSpatialFoldMatchQaForceStateHooks(jest.fn());
    expect(hooks.gameId).toBe(GAME_ID);
    // In dev builds (jest sets __DEV__) the hooks execute without throwing.
    expect(() => hooks.forceWin()).not.toThrow();
    expect(() => hooks.forceLose()).not.toThrow();
    expect(() => hooks.forceState?.({ seed: 1 })).not.toThrow();
  });
});

describe('createSpatialFoldMatchTutorialLifecycle', () => {
  it('shows on first play, completes, and honors replays', () => {
    const tutorial = createSpatialFoldMatchTutorialLifecycle();
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.complete(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(false);
    tutorial.requestReplay(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
  });

  it('supports the QA skip path', () => {
    const tutorial = createSpatialFoldMatchTutorialLifecycle();
    tutorial.skipForQa(GAME_ID);
    expect(tutorial.getState(GAME_ID)).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });

  it('accepts an injected store so screens can persist tutorial state', () => {
    const saved: Record<string, unknown> = {};
    const store = {
      getTutorialState: (gameId: string) => (saved[gameId] as never) ?? null,
      setTutorialState: (gameId: string, state: never) => {
        saved[gameId] = state;
      },
    };
    const tutorial = createSpatialFoldMatchTutorialLifecycle(store);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.complete(GAME_ID);
    expect(saved[GAME_ID]).toBeDefined();
    // A second lifecycle over the same store sees the completion.
    expect(createSpatialFoldMatchTutorialLifecycle(store).shouldShowTutorial(GAME_ID)).toBe(
      false,
    );
  });
});
