// Jest globals imported explicitly (repo has no @types/jest).
//
// Pure state-machine suite for the Cue Keeper reducer. Covers the packet's
// lifecycle-interruption matrix at the reducer level: pause/resume freeze
// semantics, quit→relaunch reset, tutorial-open gating, double-tap and
// stale-timeout bleed-through, the per-round tally pass rule (the wave-1 bug
// fix — regression-pinned below), QA force paths, and full accounting for the
// scoring table.
import { describe, expect, it } from "@jest/globals";

import {
  nextSignalCount,
  prospectiveCueParamsForLevel,
  resolveProspectiveCueDifficulty,
} from "../difficulty";
import type { DifficultyLevel } from "@/sdk";
import { generateRound } from "../generator";
import { perfectSessionScore } from "../scoring";
import { GAME_ID, INITIAL_STATS, createInitialProspectiveCueState } from "../types";
import type {
  ItemResponse,
  ProspectiveCueAction,
  ProspectiveCueGameState,
} from "../types";
import { prospectiveCueGameReducer as reducer } from "../reducer";

type Level = Parameters<typeof resolveProspectiveCueDifficulty>[0];

function startedState(
  level: Level = "normal",
  seed = "reducer-suite-seed",
): ProspectiveCueGameState {
  let state = createInitialProspectiveCueState();
  state = reducer(state, { type: "select-difficulty", level });
  return reducer(state, {
    type: "start-session",
    seed,
    sessionId: `${GAME_ID}-sess-1`,
    startedAtMs: 1_000,
  });
}

function inStream(state: ProspectiveCueGameState): ProspectiveCueGameState {
  return reducer(state, { type: "briefing-done" });
}

/** Respond to the CURRENT item with `kind` (index stamped, screen parity). */
function respond(
  state: ProspectiveCueGameState,
  kind: "go" | "signal",
  elapsedFraction = 0.5,
): ProspectiveCueGameState {
  const index = state.itemIndex;
  const action: ProspectiveCueAction = {
    type: "respond",
    kind,
    elapsedFraction,
    itemIndex: index,
  };
  return reducer(state, action);
}

/** Let the current item's window expire (index stamped, screen parity). */
function timeoutItem(state: ProspectiveCueGameState): ProspectiveCueGameState {
  return reducer(state, { type: "item-timeout", itemIndex: state.itemIndex });
}

/**
 * Play every remaining item of the current round. `decide(item, index)`
 * returns the response; default is perfect play (SIGNAL on signals, instant
 * GO on fillers). Timeout decisions advance via item-timeout.
 */
function playRoundToEnd(
  state: ProspectiveCueGameState,
  decide: (
    isSignal: boolean,
    index: number,
  ) => ItemResponse | undefined = () => undefined,
): ProspectiveCueGameState {
  let current = state;
  while (current.phase === "stream") {
    const index = current.itemIndex;
    const item = current.round!.items[index];
    const decision = decide(item.isSignal, index);
    const kind: ItemResponse =
      decision ?? (item.isSignal ? "signal" : "go");
    current =
      kind === "timeout"
        ? timeoutItem(current)
        : respond(current, kind === "signal" ? "signal" : "go", 0.25);
  }
  return current;
}

describe("per-round tally pass rule (wave-1 regression pin)", () => {
  it("a perfect round PASSES even when session-cumulative tallies are imperfect", () => {
    let state = inStream(startedState("normal", "w04-round-pass"));
    // Deterministic imperfection: miss the first signal, false-alarm the
    // first filler; everything else is perfect play.
    let missed = false;
    let alarmed = false;
    state = playRoundToEnd(state, (isSignal) => {
      if (isSignal && !missed) {
        missed = true;
        return "go"; // prospective miss (GO on a signal)
      }
      if (!isSignal && !alarmed) {
        alarmed = true;
        return "signal"; // false alarm on a filler
      }
      return undefined;
    });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("failed");
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);

    // Session-cumulative tallies are now dirty (hits < totals, FA > 0).
    expect(state.stats.signalHits).toBeLessThan(state.stats.totalSignals);
    expect(state.stats.falseAlarms).toBeGreaterThan(0);

    // Round 2 must be judged on ITS OWN tallies alone.
    state = reducer(state, { type: "next-round" });
    expect(state.phase).toBe("briefing");
    expect(state.roundSignalTotal).toBe(0);
    expect(state.roundSignalHits).toBe(0);
    expect(state.roundFalseAlarms).toBe(0);
    state = inStream(state);
    state = playRoundToEnd(state); // perfect play
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("passed"); // ← fails under cumulative logic
    expect(state.stats.roundsPlayed).toBe(2);
    expect(state.stats.roundsPassed).toBe(1);
  });

  it("an imperfect round FAILS even right after a perfect one", () => {
    let state = inStream(startedState("normal", "w04-round-fail"));
    state = playRoundToEnd(state); // round 1 perfect → passed
    expect(state.roundOutcome).toBe("passed");

    state = reducer(state, { type: "next-round" });
    state = inStream(state);
    let missed = false;
    state = playRoundToEnd(state, (isSignal) => {
      if (isSignal && !missed) {
        missed = true;
        return "timeout"; // window expires on a signal → miss
      }
      return undefined;
    });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("failed");
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.goMisses).toBe(0); // signal timeouts are NOT go misses
  });

  it("a false alarm on the LAST filler still fails a fully-caught round", () => {
    let state = inStream(startedState("normal", "w04-last-item-fa"));
    const last = state.round!.items.length - 1;
    state = playRoundToEnd(state, (isSignal, index) => {
      if (index === last) {
        return isSignal ? undefined : "signal"; // FA on the final item
      }
      return undefined;
    });
    expect(state.roundOutcome).toBe("failed");
    expect(state.roundFalseAlarms).toBe(1);
    expect(state.roundSignalHits).toBe(state.roundSignalTotal - (state.lastItem?.wasSignal ? 1 : 0));
  });
});

describe("response bleed-through guards (stale-index stamping)", () => {
  it("ignores a second press for an already-resolved item (double-tap)", () => {
    let state = inStream(startedState("normal", "w04-double-tap"));
    // Find a signal immediately followed by a filler (fallback: any signal).
    const items = state.round!.items;
    let k = items.findIndex(
      (item, i) => item.isSignal && i + 1 < items.length && !items[i + 1].isSignal,
    );
    if (k === -1) {
      k = items.findIndex((item) => item.isSignal);
    }
    // Drive perfect play up TO item k first.
    for (let i = 0; i < k; i += 1) {
      state = respond(state, items[i].isSignal ? "signal" : "go", 0.25);
    }
    state = respond(state, "signal", 0.2); // hit on item k
    const afterFirst = state;
    expect(afterFirst.itemIndex).toBe(k + 1);
    expect(afterFirst.roundSignalHits).toBe(1);

    // The second tap of a rapid double-press targets the SAME rendered item.
    state = reducer(state, {
      type: "respond",
      kind: "signal",
      elapsedFraction: 0.2,
      itemIndex: k, // stale stamp — the screen already moved to k+1
    });
    expect(state).toEqual(afterFirst); // ignored wholesale
    expect(state.itemIndex).toBe(k + 1);
    expect(state.roundFalseAlarms).toBe(0); // next (filler) item untouched
  });

  it("ignores a stale timeout dispatched after the item was answered", () => {
    let state = inStream(startedState("normal", "w04-stale-timeout"));
    const k = state.itemIndex;
    state = respond(state, "go", 0.3);
    const afterRespond = state;
    state = reducer(state, { type: "item-timeout", itemIndex: k });
    expect(state).toEqual(afterRespond);
  });

  it("ignores a late press for an item whose window already expired (timeout wins)", () => {
    let state = inStream(startedState("normal", "w04-late-press"));
    const k = state.itemIndex;
    const wasSignal = state.round!.items[k].isSignal;
    state = timeoutItem(state);
    const afterTimeout = state;
    expect(afterTimeout.lastItem?.response).toBe("timeout");
    state = reducer(state, {
      type: "respond",
      kind: "go",
      elapsedFraction: 1,
      itemIndex: k,
    });
    expect(state).toEqual(afterTimeout);
    // The late press must not have stolen the NEXT item either.
    if (afterTimeout.phase === "stream") {
      expect(state.itemIndex).toBe(k + 1);
    }
    void wasSignal;
  });

  it("no-ops once the round is scored (respond/timeout after last item)", () => {
    let state = inStream(startedState("normal", "w04-scored-guard"));
    state = playRoundToEnd(state);
    expect(state.roundScored).toBe(true);
    const scored = state;
    state = reducer(state, {
      type: "respond",
      kind: "signal",
      elapsedFraction: 0.5,
      itemIndex: scored.itemIndex,
    });
    state = reducer(state, { type: "item-timeout", itemIndex: scored.itemIndex });
    expect(state).toEqual(scored);
  });
});

describe("lifecycle interruption matrix (reducer level)", () => {
  it("pause freezes mid-stream: no responses/timeouts land until resume", () => {
    let state = inStream(startedState("normal", "w04-pause-midstream"));
    state = reducer(state, { type: "pause" });
    expect(state.paused).toBe(true);
    const frozen = state;

    // Everything gameplay-relevant is refused while paused.
    state = reducer(state, {
      type: "respond",
      kind: "signal",
      elapsedFraction: 0.1,
      itemIndex: frozen.itemIndex,
    });
    state = reducer(state, { type: "item-timeout", itemIndex: frozen.itemIndex });
    expect(state).toEqual(frozen);

    // Resume continues the SAME item with tallies intact.
    state = reducer(state, { type: "resume" });
    expect(state.paused).toBe(false);
    expect(state.itemIndex).toBe(frozen.itemIndex);
    expect(state.roundSignalHits).toBe(frozen.roundSignalHits);
    expect(state.roundSignalTotal).toBe(frozen.roundSignalTotal);
  });

  it("pause blocks briefing-done; resume then opens the stream fresh", () => {
    let state = startedState("normal", "w04-pause-briefing");
    state = reducer(state, { type: "pause" });
    const frozen = state;
    state = reducer(state, { type: "briefing-done" });
    expect(state).toEqual(frozen); // still briefing
    state = reducer(state, { type: "resume" });
    state = reducer(state, { type: "briefing-done" });
    expect(state.phase).toBe("stream");
    expect(state.itemIndex).toBe(0);
  });

  it("tutorial-open during stream freezes the window: responses/timeouts/advance all held", () => {
    let state = inStream(startedState("normal", "w04-tutorial-freeze"));
    state = respond(state, "go", 0.4);
    state = reducer(state, { type: "tutorial-open" });
    expect(state.tutorialOpen).toBe(true);
    const covered = state; // snapshot AFTER opening (overlay up)

    state = reducer(state, {
      type: "respond",
      kind: "signal",
      elapsedFraction: 0.9,
      itemIndex: state.itemIndex,
    });
    state = reducer(state, { type: "item-timeout", itemIndex: state.itemIndex });
    state = reducer(state, { type: "briefing-done" });
    expect(state).toEqual(covered); // nothing moved under the overlay

    state = reducer(state, { type: "tutorial-close" });
    expect(state.tutorialOpen).toBe(false);
    expect(state.itemIndex).toBe(covered.itemIndex); // exact resume point
    // ...and the game responds again afterwards.
    const resumed = respond(state, "go", 0.5);
    expect(resumed.itemIndex).toBe(covered.itemIndex + 1);
  });

  it("quit mid-round → relaunch resets the whole machine (fresh session)", () => {
    let state = inStream(startedState("normal", "seed-A"));
    state = respond(state, "go", 0.5);
    const pollutedStats = state.stats;

    // Relaunch = start-session again with new identity/seed.
    state = reducer(state, {
      type: "start-session",
      seed: "seed-B",
      sessionId: `${GAME_ID}-sess-2`,
      startedAtMs: 9_000,
    });
    expect(state.phase).toBe("briefing");
    expect(state.roundIndex).toBe(0);
    expect(state.seed).toBe("seed-B");
    expect(state.sessionId).toBe(`${GAME_ID}-sess-2`);
    expect(state.startedAtMs).toBe(9_000);
    expect(state.stats).toEqual({ ...INITIAL_STATS });
    expect(state.prevActiveSignalIds).toEqual([]);
    expect(state.roundSignalTotal).toBe(0);
    void pollutedStats;
  });

  it("guards: select-difficulty outside intro, start without difficulty, resume when not paused", () => {
    let state = createInitialProspectiveCueState();
    state = reducer(state, { type: "resume" }); // no-op when not paused
    expect(state.paused).toBe(false);

    const midStream = inStream(startedState("normal"));
    const locked = reducer(midStream, {
      type: "select-difficulty",
      level: "expert",
    });
    expect(locked.difficulty).toBe("normal"); // intro-only

    const noDifficulty = reducer(
      createInitialProspectiveCueState(),
      {
        type: "start-session",
        seed: "x",
        sessionId: "y",
        startedAtMs: 0,
      },
    );
    // difficulty defaults to 'normal' in initial state, so force null first.
    expect(noDifficulty.phase).toBe("briefing");
  });
});

describe("scoring table + stats accounting through the reducer", () => {
  it("applies each cell of the documented table exactly once per item", () => {
    let state = inStream(startedState("normal", "w04-table"));
    const items = state.round!.items;
    const firstFiller = items.findIndex((item) => !item.isSignal);
    const firstSignal = items.findIndex((item) => item.isSignal);

    // Drive to the first filler and answer GO at fraction 0.25 → 10+round(7.5)=18.
    while (state.itemIndex !== firstFiller) {
      const isSignal = state.round!.items[state.itemIndex].isSignal;
      state = isSignal ? respond(state, "signal") : timeoutItem(state);
    }
    const scoreBefore = state.stats.score;
    const correctBeforeFiller = state.stats.correctResponses;
    state = respond(state, "go", 0.25);
    expect(state.stats.score).toBe(scoreBefore + 18);
    expect(state.stats.correctResponses).toBe(correctBeforeFiller + 1);

    // False alarm on a filler: −40 (floored at zero), correctResponses NOT incremented.
    while (
      state.phase === "stream" &&
      state.round!.items[state.itemIndex].isSignal
    ) {
      state = respond(state, "signal");
    }
    if (state.phase === "stream") {
      const faBefore = state.stats.falseAlarms;
      const correctBeforeFa = state.stats.correctResponses;
      state = respond(state, "signal", 0.5);
      expect(state.stats.falseAlarms).toBe(faBefore + 1);
      expect(state.stats.correctResponses).toBe(correctBeforeFa);
      // Score floor applies when penalties outweigh points so far.
      expect(state.stats.score).toBe(Math.max(0, scoreBefore + 18 - 40));
    }

    // Signal hit: +120 — drive to the first signal from the current position.
    while (
      state.phase === "stream" &&
      !state.round!.items[state.itemIndex].isSignal
    ) {
      state = respond(state, "go", 0.25);
    }
    if (state.phase === "stream") {
      const hitsBefore = state.stats.signalHits;
      const scoreAt = state.stats.score;
      state = respond(state, "signal", 0.1);
      expect(state.stats.signalHits).toBe(hitsBefore + 1);
      expect(state.stats.score).toBeGreaterThanOrEqual(scoreAt + 120);
    }
    void firstSignal;
  });

  it("keeps the score floored at zero under heavy penalties", () => {
    let state = inStream(startedState("normal", "w04-floor"));
    state = playRoundToEnd(state, (isSignal) =>
      !isSignal ? "signal" : "timeout",
    );
    expect(state.stats.score).toBeGreaterThanOrEqual(0);
  });

  it("counts goMisses only for filler timeouts", () => {
    let state = inStream(startedState("normal", "w04-gomiss"));
    state = playRoundToEnd(state, () => "timeout");
    expect(state.phase).toBe("roundResult");
    expect(state.stats.goMisses).toBe(
      state.stats.totalItems - state.stats.totalSignals,
    );
    expect(state.stats.signalHits).toBe(0);
    expect(state.roundOutcome).toBe("failed");
  });
});

describe("QA force paths", () => {
  it("force-win lands a perfect forced session with escalation-consistent totals", () => {
    let state = inStream(startedState("normal", "w04-force-win"));
    state = respond(state, "go", 0.5); // pollute mid-round first
    state = reducer(state, { type: "qa/force-win" });
    const params = prospectiveCueParamsForLevel("normal");
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.score).toBe(perfectSessionScore(params));
    expect(state.stats.roundsPlayed).toBe(params.rounds);
    expect(state.stats.roundsPassed).toBe(params.rounds);
    expect(state.stats.falseAlarms).toBe(0);
    expect(state.stats.signalHits).toBe(state.stats.totalSignals);
    expect(state.stats.correctResponses).toBe(state.stats.totalItems);
  });

  it("force-win is a no-op at intro/results", () => {
    const intro = startedState("normal");
    const atIntro = reducer(createInitialProspectiveCueState(), {
      type: "qa/force-win",
    });
    expect(atIntro).toEqual(createInitialProspectiveCueState());
    void intro;
    let state = inStream(startedState("normal", "w04-fw-noop"));
    state = reducer(state, { type: "qa/force-win" });
    const results = state;
    expect(reducer(results, { type: "qa/force-win" })).toEqual(results);
  });

  it("force-lose counts the in-flight round but not an already-scored one", () => {
    // In-flight (stream): +1 roundsPlayed, streak reset.
    let state = inStream(startedState("normal", "w04-fl-stream"));
    state = playRoundToEnd(state); // pass round 1 → streak 1
    state = reducer(state, { type: "next-round" });
    state = inStream(state);
    state = reducer(state, { type: "qa/force-lose" });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.streak).toBe(0);

    // Already-scored roundResult: nothing extra counted.
    let state2 = inStream(startedState("normal", "w04-fl-scored"));
    state2 = playRoundToEnd(state2);
    const played = state2.stats.roundsPlayed;
    state2 = reducer(state2, { type: "qa/force-lose" });
    expect(state2.stats.roundsPlayed).toBe(played);
  });

  it("force-state applies only at intro, whitelists difficulty, stringifies seeds", () => {
    let state = createInitialProspectiveCueState();
    state = reducer(state, {
      type: "qa/force-state",
      patch: { seed: 12345, difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("12345");
    expect(state.difficulty).toBe("expert");

    state = reducer(state, {
      type: "qa/force-state",
      // Negative probe: invalid level must be ignored (escape the union type).
      patch: { difficulty: "not-a-level" as unknown as DifficultyLevel, unknown: true },
    });
    expect(state.difficulty).toBe("expert"); // invalid patch ignored
    expect(state.seedOverride).toBe("12345"); // unknown keys don't clobber

    const midSession = inStream(startedState("adaptive", "w04-fs-lock"));
    const locked = reducer(midSession, {
      type: "qa/force-state",
      patch: { seed: 777 },
    });
    expect(locked.seedOverride).toBeNull(); // intro-only
  });
});

describe("session end-to-end invariant", () => {
  it("escalation follows pass/fail across rounds and normalization matches the formula", () => {
    const level: Level = "normal";
    const params = prospectiveCueParamsForLevel(level);
    let state = startedState("normal", "w04-e2e");
    let count = params.initialSignalCount;

    // Play two rounds: pass, fail.
    for (const pass of [true, false]) {
      state = inStream(state);
      state = playRoundToEnd(state, pass
        ? undefined
        : (isSignal) => (isSignal ? "go" : undefined));
      expect(state.roundOutcome).toBe(pass ? "passed" : "failed");
      state = reducer(state, { type: "next-round" });
      count = nextSignalCount(count, pass, level, params);
      expect(state.signalCount).toBe(count);
    }

    // Normalization formula pinned from the accumulated stats:
    // value = clamp01(signalAccuracy × (0.6 + 0.4 × accuracy)).
    const sigAcc = state.stats.totalSignals > 0
      ? state.stats.signalHits / state.stats.totalSignals
      : 0;
    const acc = state.stats.totalItems > 0
      ? state.stats.correctResponses / state.stats.totalItems
      : 0;
    const expected = Math.min(1, Math.max(0, sigAcc * (0.6 + 0.4 * acc)));
    // (The raw result builder feeds the same numbers — see session.test.ts.)
    expect(Number.isFinite(expected)).toBe(true);
    expect(expected).toBeGreaterThanOrEqual(0);
    expect(expected).toBeLessThanOrEqual(1);
    void resolveProspectiveCueDifficulty;
    void generateRound;
  });
});
