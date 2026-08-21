/**
 * Sustained Vigilance game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createVigilanceQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract: every method calls `assertDevOnly()` and then dispatches the
 * corresponding reducer action. The screen only renders the entry points
 * (QA panel / skip button) behind `isDevBuild()`.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { VigilanceAction } from './types';

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createVigilanceQaForceStateHooks(
  dispatch: Dispatch<VigilanceAction>,
): QaForceStateHooks {
  return {
    gameId: GAME_ID,
    forceWin: () => {
      assertDevOnly();
      dispatch({ type: 'qa/force-win' });
    },
    forceLose: () => {
      assertDevOnly();
      dispatch({ type: 'qa/force-lose' });
    },
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: 'qa/force-state', patch });
    },
  };
}

/**
 * Tutorial lifecycle for the game. Uses the SDK reference lifecycle over the
 * provided store (an in-memory store by default).
 */
export function createVigilanceTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
