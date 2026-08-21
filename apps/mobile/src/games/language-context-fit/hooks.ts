/**
 * Context Fit — dev-only QA hooks and tutorial lifecycle wiring.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { ContextFitAction } from './types';

export interface ContextFitQaForceStateHooks extends QaForceStateHooks {
  forceTimeout(): void;
}

export function createContextFitQaForceStateHooks(
  dispatch: Dispatch<ContextFitAction>,
): ContextFitQaForceStateHooks {
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

export function createContextFitTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
