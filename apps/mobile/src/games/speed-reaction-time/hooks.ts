/**
 * Reaction Time game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createSpeedQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract: every method calls `assertDevOnly()` and then dispatches the
 * corresponding reducer action. `forceTimeout` fails the current round as a
 * timeout without ending the session (it is a per-round shortcut, not a
 * session ender, so it never sets the session-level `forced` flag). The screen
 * only renders the entry points (QA panel / skip button) behind
 * `isDevBuild()`.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { SpeedAction } from './types';

/**
 * QA hooks for Reaction Time: the SDK contract plus the game-specific
 * `forceTimeout` shortcut (fails the current round as a timeout).
 */
export type SpeedQaForceStateHooks = QaForceStateHooks & {
  readonly forceTimeout: () => void;
};

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createSpeedQaForceStateHooks(
  dispatch: Dispatch<SpeedAction>,
): SpeedQaForceStateHooks {
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
    forceTimeout: () => {
      assertDevOnly();
      dispatch({ type: 'qa/force-timeout' });
    },
  };
}

/**
 * Tutorial lifecycle for the Reaction Time game. Uses the SDK reference
 * lifecycle over the provided store (an in-memory store by default; the db
 * layer may plug a persistent `TutorialStore` in a later wave — see
 * GAME_SDK.md).
 */
export function createSpeedTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
