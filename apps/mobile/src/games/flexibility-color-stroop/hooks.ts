/**
 * Color Stroop game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createColorStroopQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract: every method calls `assertDevOnly()` and then dispatches the
 * corresponding reducer action.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { ColorStroopAction } from './types';

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createColorStroopQaForceStateHooks(
  dispatch: Dispatch<ColorStroopAction>,
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
 * Tutorial lifecycle for the Color Stroop game.
 */
export function createColorStroopTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}