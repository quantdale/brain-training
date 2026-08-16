/**
 * Mental Rotation game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createSpatialQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract (plus the game-specific `forceTimeout`): every method calls
 * `assertDevOnly()` and then dispatches the corresponding reducer action. The
 * screen only renders the entry points (QA panel / skip button) behind
 * `isDevBuild()`.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { SpatialAction } from './types';

/**
 * Game-specific extension of the SDK contract: a dev-only timeout hook, since
 * the SDK interface only standardizes win/lose. Structurally assignable to
 * `QaForceStateHooks`.
 */
export interface SpatialQaForceStateHooks extends QaForceStateHooks {
  /** Force the current round (and session) to end as a timeout. */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createSpatialQaForceStateHooks(
  dispatch: Dispatch<SpatialAction>,
): SpatialQaForceStateHooks {
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
 * Tutorial lifecycle for the Mental Rotation game. Uses the SDK reference
 * lifecycle over the provided store (an in-memory store by default; the db
 * layer may plug a persistent `TutorialStore` in a later wave — see
 * GAME_SDK.md).
 */
export function createSpatialTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
