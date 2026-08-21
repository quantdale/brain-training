/**
 * Symbol Tracker game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createSymbolTrackerQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract: every method calls `assertDevOnly()` and then dispatches the
 * corresponding reducer action. The screen only renders the entry points
 * (QA panel / skip button) behind `isDevBuild()`.
 *
 * The game's only countdown is the observe window, which expires into the
 * respond phase via `observe-tick`; `forceTimeout` drives that same path so QA
 * can skip the wait without introducing a separate fail state.
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
import type { SymbolTrackerAction } from './types';

/** QA force hooks for the Symbol Tracker game (adds the observe-timeout path). */
export interface SymbolTrackerQaForceStateHooks extends QaForceStateHooks {
  /** Expire the current observe window immediately (no-op outside observe). */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createSymbolTrackerQaForceStateHooks(
  dispatch: Dispatch<SymbolTrackerAction>,
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
      dispatch({ type: 'observe-tick' });
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
