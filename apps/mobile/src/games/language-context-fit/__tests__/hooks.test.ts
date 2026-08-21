import { describe, expect, it, jest } from '@jest/globals';

import { createInMemoryTutorialStore } from '@/sdk';

import { createContextFitQaForceStateHooks, createContextFitTutorialLifecycle } from '../hooks';
import { GAME_ID } from '../types';

describe('qa force-state hooks', () => {
  it('dispatches the corresponding reducer actions', () => {
    const dispatch = jest.fn();
    const hooks = createContextFitQaForceStateHooks(dispatch);
    expect(hooks.gameId).toBe(GAME_ID);
    hooks.forceWin();
    expect(dispatch).toHaveBeenCalledWith({ type: 'qa/force-win' });
    hooks.forceLose();
    expect(dispatch).toHaveBeenCalledWith({ type: 'qa/force-lose' });
    hooks.forceTimeout();
    expect(dispatch).toHaveBeenCalledWith({ type: 'qa/force-timeout' });
    hooks.forceState?.({ difficulty: 'hard' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'qa/force-state', patch: { difficulty: 'hard' } });
  });
});

describe('tutorial lifecycle', () => {
  it('opens, completes, and skips for QA', () => {
    const store = createInMemoryTutorialStore();
    const lifecycle = createContextFitTutorialLifecycle(store);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(true);
    lifecycle.complete(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(false);
    lifecycle.requestReplay(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(true);
    lifecycle.skipForQa(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(false);
  });
});
