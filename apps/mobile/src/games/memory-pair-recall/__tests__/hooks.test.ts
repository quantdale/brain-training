// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  createPairRecallQaForceStateHooks,
  createPairRecallTutorialLifecycle,
} from "../hooks";
import { GAME_ID } from "../types";
import type { PairRecallAction } from "../types";

/** assertDevOnly() passes in the test environment (dev build). */
describe("createPairRecallQaForceStateHooks", () => {
  it("dispatches force-win/lose/state actions bound to the game id", () => {
    const dispatched: PairRecallAction[] = [];
    const dispatch = (action: PairRecallAction) => dispatched.push(action);
    const hooks = createPairRecallQaForceStateHooks(dispatch);

    expect(hooks.gameId).toBe(GAME_ID);

    hooks.forceWin();
    hooks.forceLose();
    // `forceState` is optional in the SDK contract; Pair Recall implements it.
    hooks.forceState?.({ seed: "qa-seed", difficulty: "easy" });
    expect(hooks.forceState).toBeDefined();

    expect(dispatched).toEqual([
      { type: "qa/force-win" },
      { type: "qa/force-lose" },
      { type: "qa/force-state", patch: { seed: "qa-seed", difficulty: "easy" } },
    ]);
  });

  it("creates a tutorial lifecycle over an in-memory store by default", () => {
    const lifecycle = createPairRecallTutorialLifecycle();
    // First play should show the tutorial for this game.
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(true);
  });

  it("completing the tutorial hides it on the next check", () => {
    const lifecycle = createPairRecallTutorialLifecycle();
    lifecycle.complete(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(false);
  });

  it("skipForQa marks the tutorial done without completion semantics", () => {
    const lifecycle = createPairRecallTutorialLifecycle();
    lifecycle.skipForQa(GAME_ID);
    expect(lifecycle.shouldShowTutorial(GAME_ID)).toBe(false);
  });
});
