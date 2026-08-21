/**
 * Word Chain — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createWordChainQaForceStateHooks` implements the SDK `QaForceStateHooks`
 * contract plus a game-specific `forceTimeout` (forces the current chain to
 * expire without ending the session): every method calls `assertDevOnly()`
 * and then dispatches the corresponding reducer action. The screen only
 * renders the entry points (QA panel / skip button) behind `isDevBuild()`.
 */
import {
  assertDevOnly,
  createInMemoryTutorialStore,
  createTutorialLifecycle,
} from "@/sdk";
import type {
  QaForceStateHooks,
  TutorialLifecycle,
  TutorialStore,
} from "@/sdk";
import type { Dispatch } from "react";

import { GAME_ID } from "./types";
import type { LanguageWordChainAction } from "./types";

export interface WordChainQaForceStateHooks extends QaForceStateHooks {
  /** Dev-only: force the current chain to expire as a timeout. */
  forceTimeout(): void;
}

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createWordChainQaForceStateHooks(
  dispatch: Dispatch<LanguageWordChainAction>,
): WordChainQaForceStateHooks {
  return {
    gameId: GAME_ID,
    forceWin: () => {
      assertDevOnly();
      dispatch({ type: "qa/force-win" });
    },
    forceLose: () => {
      assertDevOnly();
      dispatch({ type: "qa/force-lose" });
    },
    forceTimeout: () => {
      assertDevOnly();
      dispatch({ type: "qa/force-timeout" });
    },
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: "qa/force-state", patch });
    },
  };
}

/**
 * Tutorial lifecycle for Word Chain. Uses the SDK reference lifecycle over
 * the provided store (an in-memory store by default; the db layer may plug a
 * persistent `TutorialStore` in a later wave — see GAME_SDK.md).
 */
export function createWordChainTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
