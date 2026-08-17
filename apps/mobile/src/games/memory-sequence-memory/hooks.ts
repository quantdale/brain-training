/**
 * Sequence Memory game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createSequenceMemoryQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract (plus a game-specific `forcePerfect` member): every method calls
 * `assertDevOnly()` and then dispatches the corresponding reducer action. The
 * screen only renders the entry points (QA panel / skip button) behind
 * `isDevBuild()`.
 *
 * Hook semantics (see reducer.ts):
 * - `forceWin` ends the session; the in-flight round counts as passed.
 * - `forceLose` ends the session; the in-flight round counts as failed.
 * - `forcePerfect` ends the session with the canonical perfect-run statistics
 *   (one pass per length from baseLength through maxLength).
 * - `forceState` seeds/difficulty for the next session (intro only).
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { SequenceMemoryAction } from './types';

/** QA hooks surface: the SDK contract plus the game's force-perfect member. */
export type SequenceMemoryQaForceStateHooks = QaForceStateHooks & {
  /** End the session with the canonical perfect-run statistics (dev-only). */
  forcePerfect(): void;
};

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createSequenceMemoryQaForceStateHooks(
  dispatch: Dispatch<SequenceMemoryAction>,
): SequenceMemoryQaForceStateHooks {
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
    forcePerfect: () => {
      assertDevOnly();
      dispatch({ type: 'qa/force-perfect' });
    },
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: 'qa/force-state', patch });
    },
  };
}

/**
 * Tutorial lifecycle for the Sequence Memory game. Uses the SDK reference
 * lifecycle over the provided store (an in-memory store by default; the db
 * layer may plug a persistent `TutorialStore` in a later wave — see
 * GAME_SDK.md).
 */
export function createSequenceMemoryTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
