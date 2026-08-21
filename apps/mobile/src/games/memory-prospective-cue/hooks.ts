/**
 * Cue Keeper game — dev-only QA hooks and tutorial lifecycle wiring.
 *
 * `createProspectiveCueQaForceStateHooks` implements the SDK
 * `QaForceStateHooks` contract: every method calls `assertDevOnly()` and then
 * dispatches the corresponding reducer action. The screen only renders the
 * entry points (QA panel / skip button) behind `isDevBuild()`.
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
import type { ProspectiveCueAction } from "./types";

/** Create the QA hooks bound to a reducer dispatch (dev-only methods). */
export function createProspectiveCueQaForceStateHooks(
  dispatch: Dispatch<ProspectiveCueAction>,
): QaForceStateHooks {
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
    forceState: (patch) => {
      assertDevOnly();
      dispatch({ type: "qa/force-state", patch });
    },
  };
}

/**
 * Tutorial lifecycle for the Cue Keeper game. Uses the SDK reference
 * lifecycle over the provided store (an in-memory store by default; the db
 * layer may plug a persistent `TutorialStore` in a later wave — see
 * GAME_SDK.md).
 */
export function createProspectiveCueTutorialLifecycle(
  store: TutorialStore = createInMemoryTutorialStore(),
): TutorialLifecycle {
  return createTutorialLifecycle(store);
}
