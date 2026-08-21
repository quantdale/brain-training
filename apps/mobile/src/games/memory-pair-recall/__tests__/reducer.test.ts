// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";

import { pairRecallGameReducer, createInitialPairRecallState } from "../reducer";
import { generateRound } from "../generator";
import { PAIR_RECALL_DIFFICULTY_PARAMS } from "../difficulty";
import { perfectSessionScore } from "../scoring";
import type { PairRecallGameState, PairRecallRound } from "../types";

/** Select a difficulty (intro step). */
function selectLevel(
  state: PairRecallGameState,
  level: keyof typeof PAIR_RECALL_DIFFICULTY_PARAMS = "normal",
): PairRecallGameState {
  return pairRecallGameReducer(state, { type: "select-difficulty", level });
}

/** Start a session from the intro with a fixed seed. */
function begin(state: PairRecallGameState, seed = "reducer-seed"): PairRecallGameState {
  return pairRecallGameReducer(state, {
    type: "start-session",
    seed,
    sessionId: "sid-1",
    startedAtMs: 1000,
  });
}

/** Answer every cue of the current round correctly. */
function answerAllCorrect(state: PairRecallGameState): PairRecallGameState {
  let next = state;
  const round = next.round!;
  for (let i = 0; i < round.cueOrder.length; i += 1) {
    const pairIndex = round.cueOrder[next.cueIndex];
    next = pairRecallGameReducer(next, {
      type: "respond",
      responseId: round.pairs[pairIndex].responseId,
    });
  }
  return next;
}

describe("pairRecallGameReducer", () => {
  it("starts in the intro with 'normal' preselected", () => {
    const state = createInitialPairRecallState();
    expect(state.phase).toBe("intro");
    expect(state.difficulty).toBe("normal");
  });

  it("selects difficulty only in the intro", () => {
    let state = createInitialPairRecallState();
    state = selectLevel(state, "hard");
    expect(state.difficulty).toBe("hard");
    state = begin(state);
    expect(state.phase).toBe("study");
    const during = pairRecallGameReducer(state, { type: "select-difficulty", level: "easy" });
    expect(during.difficulty).toBe("hard");
  });

  it("generates round 1 deterministically and enters study", () => {
    const state = begin(selectLevel(createInitialPairRecallState()));
    expect(state.phase).toBe("study");
    expect(state.seed).toBe("reducer-seed");
    expect(state.round!.pairs).toHaveLength(
      PAIR_RECALL_DIFFICULTY_PARAMS.normal.initialPairCount,
    );
    const again = begin(selectLevel(createInitialPairRecallState()));
    expect(again.round).toEqual(state.round);
  });

  it("study-tick moves to recall; taps are ignored while studying", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    const duringStudy = pairRecallGameReducer(state, { type: "respond", responseId: 0 });
    expect(duringStudy.phase).toBe("study");

    state = pairRecallGameReducer(state, { type: "study-tick" });
    expect(state.phase).toBe("recall");
    expect(state.cueIndex).toBe(0);
  });

  it("scores a fully correct round as passed with full credit", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    state = pairRecallGameReducer(state, { type: "study-tick" });
    state = answerAllCorrect(state);
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("passed");
    expect(state.correctCues).toBe(state.pairCount);
    expect(state.wrongCues).toBe(0);
    expect(state.stats.roundsPassed).toBe(1);
    // Perfect round 1 pays exactly the base score.
    expect(state.stats.score).toBe(100);
  });

  it("gives partial credit and penalizes wrong picks", () => {
    let state = begin(selectLevel(createInitialPairRecallState(), "normal"));
    state = pairRecallGameReducer(state, { type: "study-tick" });
    const round = state.round!;
    // Answer the first cue WRONG (pick a response that is not the partner).
    const firstPair = round.pairs[round.cueOrder[0]];
    const wrongResponse = round.responseOptions.find((id) => id !== firstPair.responseId)!;
    state = pairRecallGameReducer(state, { type: "respond", responseId: wrongResponse });
    expect(state.wrongCues).toBe(1);
    // Then finish the remaining cues correctly.
    while (state.phase === "recall") {
      const pairIndex = round.cueOrder[state.cueIndex];
      state = pairRecallGameReducer(state, {
        type: "respond",
        responseId: round.pairs[pairIndex].responseId,
      });
    }
    expect(state.roundOutcome).toBe("failed");
    // fraction = (n-1)/n of 100, minus one penalty.
    const expected = Math.round(100 * ((state.pairCount - 1) / state.pairCount)) - 15;
    expect(state.stats.score).toBe(expected);
  });

  it("ignores extra responses after the round is scored (double-submit)", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    state = pairRecallGameReducer(state, { type: "study-tick" });
    state = answerAllCorrect(state);
    const scored = state;
    const again = pairRecallGameReducer(scored, { type: "respond", responseId: 0 });
    expect(again).toBe(scored);
  });

  it("escalates the pair count on a pass and holds on a failure (fixed levels)", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    const initialCount = PAIR_RECALL_DIFFICULTY_PARAMS.normal.initialPairCount;
    state = pairRecallGameReducer(state, { type: "study-tick" });
    state = answerAllCorrect(state);
    state = pairRecallGameReducer(state, { type: "next-round" });
    expect(state.pairCount).toBe(initialCount + 1);
    expect(state.prevRound).not.toBeNull();

    // Fail round 2 → count holds.
    state = pairRecallGameReducer(state, { type: "study-tick" });
    const round = state.round!;
    const firstPair = round.pairs[round.cueOrder[0]];
    const wrongResponse = round.responseOptions.find((id) => id !== firstPair.responseId)!;
    state = pairRecallGameReducer(state, { type: "respond", responseId: wrongResponse });
    while (state.phase === "recall") {
      const pairIndex = round.cueOrder[state.cueIndex];
      state = pairRecallGameReducer(state, {
        type: "respond",
        responseId: round.pairs[pairIndex].responseId,
      });
    }
    state = pairRecallGameReducer(state, { type: "next-round" });
    expect(state.pairCount).toBe(initialCount + 1);
  });

  it("carries re-paired stimuli into the next round (interference)", () => {
    let state = begin(selectLevel(createInitialPairRecallState(), "normal"), "interference-seed");
    state = pairRecallGameReducer(state, { type: "study-tick" });
    state = answerAllCorrect(state);
    state = pairRecallGameReducer(state, { type: "next-round" });
    const prevMap = new Map(
      state.prevRound!.pairs.map((p) => [p.stimulusId, p.responseId]),
    );
    const carried = state.round!.pairs.filter((p) => prevMap.has(p.stimulusId));
    expect(carried.length).toBeGreaterThanOrEqual(1);
    for (const p of carried) {
      expect(p.responseId).not.toBe(prevMap.get(p.stimulusId));
    }
  });

  it("finishes the session after the last round", () => {
    let state = begin(selectLevel(createInitialPairRecallState(), "easy"), "finish-seed");
    const rounds = PAIR_RECALL_DIFFICULTY_PARAMS.easy.rounds;
    for (let r = 0; r < rounds; r += 1) {
      state = pairRecallGameReducer(state, { type: "study-tick" });
      state = answerAllCorrect(state);
      state = pairRecallGameReducer(state, { type: "next-round" });
    }
    expect(state.phase).toBe("results");
    expect(state.stats.roundsPassed).toBe(rounds);
  });

  it("pauses and resumes; timers' actions are ignored while paused", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    state = pairRecallGameReducer(state, { type: "pause" });
    expect(state.paused).toBe(true);
    // Study tick while paused is a no-op.
    const frozen = pairRecallGameReducer(state, { type: "study-tick" });
    expect(frozen.phase).toBe("study");
    state = pairRecallGameReducer(state, { type: "resume" });
    expect(state.paused).toBe(false);
  });

  it("force-win produces a perfect forced session", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    state = pairRecallGameReducer(state, { type: "qa/force-win" });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.score).toBe(perfectSessionScore(PAIR_RECALL_DIFFICULTY_PARAMS.normal));
    expect(state.stats.roundsPassed).toBe(PAIR_RECALL_DIFFICULTY_PARAMS.normal.rounds);
  });

  it("force-lose counts an in-flight round as failed", () => {
    let state = begin(selectLevel(createInitialPairRecallState()));
    state = pairRecallGameReducer(state, { type: "qa/force-lose" });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it("force-state applies seed/difficulty only in the intro", () => {
    let state = createInitialPairRecallState();
    state = pairRecallGameReducer(state, {
      type: "qa/force-state",
      patch: { seed: "qa-seed", difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("qa-seed");
    expect(state.difficulty).toBe("expert");
    // Ignored once out of the intro.
    state = begin(state);
    const during = pairRecallGameReducer(state, {
      type: "qa/force-state",
      patch: { seed: "other" },
    });
    expect(during.seedOverride).toBe("qa-seed");
  });

  it("regenerates identical rounds from the same seed after restart", () => {
    const run = () => {
      let state = begin(selectLevel(createInitialPairRecallState(), "normal"), "restart-seed");
      state = pairRecallGameReducer(state, { type: "study-tick" });
      return (state.round as PairRecallRound).pairs;
    };
    expect(run()).toEqual(run());
  });

  it("generateRound is exercised through the reducer with valid content", () => {
    const state = begin(selectLevel(createInitialPairRecallState(), "normal"), "valid-seed");
    expect(generateRound({
      rng: createRng(state.seed),
      roundIndex: 0,
      pairCount: state.pairCount,
      prevRound: null,
    })).toEqual(state.round);
  });
});
