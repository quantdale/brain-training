/**
 * Order Path — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createOrderPathQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract plus game-specific `forceTimeout` (expires the current round without
 * ending the session); every method calls `assertDevOnly()` and then dispatches
 * the corresponding reducer action. The screen only renders the entry points
 * (QA panel / skip button) behind `isDevBuild()`.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { OrderPathAction } from './types';

export interface OrderPathQaForceStateHooks extends QaForceStateHooks {
  /** Dev-only: force the current round to expire as a timeout. */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createOrderPathQaForceStateHooks(
  dispatch: Dispatch<OrderPathAction>,
): OrderPathQaForceStateHooks {
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
    forceTimeout: () => {
      assertDevOnly();
      dispatch({ type: 'qa/force-timeout' });
    },
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: 'qa/force-state', patch });
    },
  };
}

/**
 * Tutorial lifecycle for Order Path. Uses the SDK reference lifecycle over the
 * provided store (an in-memory store by default).
 */
export function createOrderPathTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
