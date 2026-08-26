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

    // forceTimeout targets the LIVE window: observe by default (back-compat),
    // or the respond budget when the caller reports a respond phase.
    hooks.forceTimeout();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'observe-tick' });

    const respondHooks = createSymbolTrackerQaForceStateHooks(
      dispatch,
      () => 'respond',
    );
    respondHooks.forceTimeout();
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'respond-deadline' });
    // Exactly one action per call — never a cascade into the new phase.
    expect(dispatch).toHaveBeenCalledTimes(4);

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
