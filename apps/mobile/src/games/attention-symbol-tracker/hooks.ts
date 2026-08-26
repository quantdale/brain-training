/**
 * Symbol Tracker game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createSymbolTrackerQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract: every method calls `assertDevOnly()` and then dispatches the
 * corresponding reducer action. The screen only renders the entry points
 * (QA panel / skip button) behind `isDevBuild()`.
 *
 * `forceTimeout` expires whichever window is currently live: the observe
 * countdown (`observe-tick`) or the respond budget (`respond-deadline`). The
 * caller supplies a phase getter so exactly ONE action is dispatched — both
 * reducer paths ignore foreign phases, but firing both back-to-back would
 * cascade (observe → respond → instant resolution).
 */
import {
  assertDevOnly,
  createInMemoryTutorialStore,
  createTutorialLifecycle,
} from '@/sdk';
import type {
  QaForceStateHooks,
  TutorialLifecycle,
  TutorialStore,
} from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { SymbolTrackerAction, SymbolTrackerPhase } from './types';

/** QA force hooks for the Symbol Tracker game (expires either window). */
export interface SymbolTrackerQaForceStateHooks extends QaForceStateHooks {
  /** Expire the live window immediately (observe → respond; respond → result). */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods).
 *
 * `getPhase` lets `forceTimeout` target the LIVE window; without it the hook
 * conservatively expires the observe window (the pre-deadline behavior). */
export function createSymbolTrackerQaForceStateHooks(
  dispatch: Dispatch<SymbolTrackerAction>,
  getPhase?: () => SymbolTrackerPhase | null,
): SymbolTrackerQaForceStateHooks {
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
      const phase = getPhase?.() ?? 'observe';
      if (phase === 'respond') {
        dispatch({ type: 'respond-deadline' });
      } else {
        dispatch({ type: 'observe-tick' });
      }
    },
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: 'qa/force-state', patch });
    },
  };
}

/**
 * Tutorial lifecycle for the Symbol Tracker game. Uses the SDK reference
 * lifecycle over the provided store (an in-memory store by default; the db
 * layer may plug a persistent `TutorialStore` in a later wave — see
 * GAME_SDK.md).
 */
export function createSymbolTrackerTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
