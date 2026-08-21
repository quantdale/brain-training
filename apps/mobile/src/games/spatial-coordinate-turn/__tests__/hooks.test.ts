// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';

import {
  createSpatialCoordinateTurnQaForceStateHooks,
  createSpatialCoordinateTurnTutorialLifecycle,
} from '../hooks';
import { GAME_ID } from '../types';

describe('createSpatialCoordinateTurnQaForceStateHooks', () => {
  it('dispatches the matching reducer action for each hook', () => {
    const dispatch = jest.fn();
    const hooks = createSpatialCoordinateTurnQaForceStateHooks(dispatch);

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
    const hooks = createSpatialCoordinateTurnQaForceStateHooks(jest.fn());
    expect(hooks.gameId).toBe(GAME_ID);
    // In dev builds (jest sets __DEV__) the hooks execute without throwing.
    expect(() => hooks.forceWin()).not.toThrow();
    expect(() => hooks.forceLose()).not.toThrow();
    expect(() => hooks.forceState?.({ seed: 1 })).not.toThrow();
  });
});

describe('createSpatialCoordinateTurnTutorialLifecycle', () => {
  it('shows on first play, completes, and honors replays', () => {
    const tutorial = createSpatialCoordinateTurnTutorialLifecycle();
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.complete(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(false);
    tutorial.requestReplay(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.clearReplay(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(false);
  });

  it('supports the QA skip path', () => {
    const tutorial = createSpatialCoordinateTurnTutorialLifecycle();
    tutorial.skipForQa(GAME_ID);
    expect(tutorial.getState(GAME_ID)).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });

  it('keeps per-game isolation', () => {
    // A second game id must not inherit this game's completion state.
    const lifecycle = createSpatialCoordinateTurnTutorialLifecycle();
    lifecycle.complete(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(false);
    expect(lifecycle.shouldShowTutorial('some-other-game')).toBe(true);
  });
});
