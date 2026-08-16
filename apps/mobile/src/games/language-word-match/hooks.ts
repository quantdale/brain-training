/**
 * Word Match — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createLanguageQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract plus a game-specific `forceTimeout` (forces the current round to
 * expire without ending the session): every method calls `assertDevOnly()`
 * and then dispatches the corresponding reducer action. The screen only
 * renders the entry points (QA panel / skip button) behind `isDevBuild()`.
 */
import { assertDevOnly, createInMemoryTutorialStore, createTutorialLifecycle } from '@/sdk';
import type { QaForceStateHooks, TutorialLifecycle, TutorialStore } from '@/sdk';
import type { Dispatch } from 'react';

import { GAME_ID } from './types';
import type { LanguageAction } from './types';

export interface LanguageQaForceStateHooks extends QaForceStateHooks {
  /** Dev-only: force the current round to expire as a timeout. */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createLanguageQaForceStateHooks(
  dispatch: Dispatch<LanguageAction>,
): LanguageQaForceStateHooks {
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
 * Tutorial lifecycle for Word Match. Uses the SDK reference lifecycle over
 * the provided store (an in-memory store by default; the db layer may plug a
 * persistent `TutorialStore` in a later wave — see GAME_SDK.md).
 */
export function createLanguageTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
