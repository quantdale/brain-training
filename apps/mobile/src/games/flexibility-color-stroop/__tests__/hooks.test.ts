// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';

import {
  createColorStroopQaForceStateHooks,
  createColorStroopTutorialLifecycle,
} from '../hooks';
import { GAME_ID } from '../types';
import type { ColorStroopAction } from '../types';

describe('createColorStroopQaForceStateHooks', () => {
  it('dispatches the matching reducer action for each hook', () => {
    const dispatch = jest.fn();
    const hooks = createColorStroopQaForceStateHooks(dispatch);

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
    const hooks = createColorStroopQaForceStateHooks(jest.fn());
    expect(hooks.gameId).toBe(GAME_ID);
    // In dev builds (jest sets __DEV__) the hooks execute without throwing.
    expect(() => hooks.forceWin()).not.toThrow();
  });
});

describe('createColorStroopTutorialLifecycle', () => {
  it('shows on first play, completes, and honors replays', () => {
    const tutorial = createColorStroopTutorialLifecycle();
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
    tutorial.complete(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(false);
    tutorial.requestReplay(GAME_ID);
    expect(tutorial.shouldShowTutorial(GAME_ID)).toBe(true);
  });

  it('supports the QA skip path', () => {
    const tutorial = createColorStroopTutorialLifecycle();
    tutorial.skipForQa(GAME_ID);
    expect(tutorial.getState(GAME_ID)).toEqual({ completed: true, replayRequested: false, version: '1.0.0' });
  });
});