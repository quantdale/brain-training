// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';

import {
  createSymbolTrackerQaForceStateHooks,
  createSymbolTrackerTutorialLifecycle,
} from '../hooks';
import { GAME_ID } from '../types';

describe('createSymbolTrackerQaForceStateHooks', () => {
  it('dispatches the matching reducer action for each hook', () => {
    const dispatch = jest.fn();
    const hooks = createSymbolTrackerQaForceStateHooks(dispatch);

    hooks.forceWin();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'qa/force-win' });

    hooks.forceLose();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'qa/force-lose' });

    // The game's only countdown is the observe window; force-timeout drives
    // the same expiry path the pacing timer uses.
    hooks.forceTimeout();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'observe-tick' });

    hooks.forceState?.({ seed: 'abc', difficulty: 'hard' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'qa/force-state',
      patch: { seed: 'abc', difficulty: 'hard' },
    });
  });

  it('is bound to the game id and runs in dev builds', () => {
    const hooks = createSymbolTrackerQaForceStateHooks(jest.fn());
    expect(hooks.gameId).toBe(GAME_ID);
    // In dev builds (jest sets __DEV__) the hooks execute without throwing.
    expect(() => hooks.forceWin()).not.toThrow();
    expect(() => hooks.forceTimeout()).not.toThrow();
  });
});

describe('createSymbolTrackerTutorialLifecycle', () => {
  it('shows on first play, completes, and honors replays', () => {
    const tutorial = createSymbolTrackerTutorialLifecycle();
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.complete(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(false);
    tutorial.requestReplay(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
  });

  it('supports the QA skip path', () => {
    const tutorial = createSymbolTrackerTutorialLifecycle();
    tutorial.skipForQa(GAME_ID);
    expect(tutorial.getState(GAME_ID)).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
  });
});
