// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import type { DifficultyLevel } from "@/sdk";

import { logicDeductionReducer } from "../reducer";
import {
  ADAPTIVE_PARAMS,
  LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
} from "../difficulty";
import { perfectSessionScore, roundScore } from "../scoring";
import { createInitialLogicDeductionState, INITIAL_STATS } from "../types";
import type { LogicDeductionAction, LogicDeductionState } from "../types";

function dispatch(
  state: LogicDeductionState,
  action: LogicDeductionAction,
): LogicDeductionState {
  return logicDeductionReducer(state, action);
}

function startSession(
  seed: string,
  level: DifficultyLevel = "normal",
  sessionId = "s1",
  nowMs = 1000,
): LogicDeductionState {
  let state = createInitialLogicDeductionState();
  state = dispatch(state, { type: "select-difficulty", level });
  state = dispatch(state, {
    type: "start-session",
    seed,
    sessionId,
    startedAtMs: 100,
    nowMs,
  });
  return state;
}

function answerCorrect(
  state: LogicDeductionState,
  nowMs = 1500,
): LogicDeductionState {
  return dispatch(state, {
    type: "answer-option",
    index: state.round!.correctIndex,
    nowMs,
  });
}

function wrongIndex(state: LogicDeductionState): number {
  const idx = state.round!.options.findIndex(
    (_, i) => i !== state.round!.correctIndex,
  );
  return idx;
}

describe("select-difficulty", () => {
  it("selects a level in the intro", () => {
    const state = dispatch(createInitialLogicDeductionState(), {
      type: "select-difficulty",
      level: "hard",
    });
    expect(state.difficulty).toBe("hard");
  });
  it("ignores selection mid-session", () => {
    const state = dispatch(startSession("x"), {
      type: "select-difficulty",
      level: "easy",
    });
    expect(state.difficulty).toBe("normal");
  });
});

describe("start-session", () => {
  it("opens round 1 in the question phase with a valid round", () => {
    const state = startSession("seed-1");
    expect(state.phase).toBe("question");
    expect(state.profile?.level).toBe("normal");
    expect(state.params?.rounds).toBe(6);
    expect(state.round).not.toBeNull();
    expect(state.roundOutcomes).toEqual([]);
    expect(state.sessionId).toBe("s1");
    expect(state.startedAtMs).toBe(100);
    expect(state.roundStartedAtMs).toBe(1000);
    expect(state.roundDeadlineMs).toBe(1000 + 26_000);
  });

  it("determinism: same seed → same round", () => {
    const a = startSession("det");
    const b = startSession("det");
    expect(a.round).toEqual(b.round);
  });

  it("uses the selected difficulty params", () => {
    const expert = startSession("e", "expert");
    expect(expert.round?.entityCount).toBe(5);
    expect(expert.params?.roundTimeMs).toBe(18_000);
    const easy = startSession("e2", "easy");
    expect(easy.round?.attributes).toHaveLength(2);
  });
});

describe("answer-option", () => {
  it("scores a correct answer with a speed bonus and streak", () => {
    let state = startSession("correct");
    state = answerCorrect(state, 1500); // 500ms used
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("correct");
    expect(state.lastAnswerIndex).toBe(state.round!.correctIndex);
    expect(state.lastAnswerMs).toBe(500);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.score).toBe(roundScore(500, 26_000));
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.roundOutcomes).toEqual(["correct"]);
  });

  it("records a wrong answer without score and resets the streak", () => {
    let state = startSession("wrong");
    state = answerCorrect(state, 1200);
    state = dispatch(state, { type: "next-round", nowMs: 2000 });
    const idx = wrongIndex(state);
    state = dispatch(state, { type: "answer-option", index: idx, nowMs: 3000 });
    expect(state.roundOutcome).toBe("wrong");
    expect(state.lastAnswerIndex).toBe(idx);
    expect(state.stats.score).toBeGreaterThan(0); // kept from round 1
    expect(state.stats.roundsPlayed).toBe(2);
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.bestStreak).toBe(1); // unchanged by the failure
    expect(state.roundOutcomes).toEqual(["correct", "wrong"]);
  });

  it("ignores late taps past the deadline (the timer owns expiry)", () => {
    let state = startSession("late");
    const before = state.stats;
    state = dispatch(state, {
      type: "answer-option",
      index: 0,
      nowMs: 1000 + 26_000 + 1,
    });
    expect(state.phase).toBe("question");
    expect(state.stats).toBe(before);
  });

  it("ignores answers while paused or outside the question phase", () => {
    const paused = dispatch(startSession("p"), {
      type: "pause",
      nowMs: 2000,
    });
    const afterTap = dispatch(paused, {
      type: "answer-option",
      index: 0,
      nowMs: 2100,
    });
    expect(afterTap.phase).toBe("question");
    expect(afterTap.stats.roundsPlayed).toBe(0);
    const intro = createInitialLogicDeductionState();
    expect(
      dispatch(intro, { type: "answer-option", index: 0, nowMs: 0 }).phase,
    ).toBe("intro");
  });
});

describe("expire-round", () => {
  it("times a round out at the deadline with a full-budget ratio", () => {
    let state = startSession("timeout");
    state = dispatch(state, { type: "expire-round", nowMs: 1000 + 26_000 });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("timeout");
    expect(state.lastAnswerIndex).toBeNull();
    expect(state.lastAnswerMs).toBe(26_000);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.sumAnswerRatio).toBe(1);
    expect(state.stats.streak).toBe(0);
  });
  it("is ignored before the deadline, while paused, or outside question", () => {
    const early = dispatch(startSession("early"), {
      type: "expire-round",
      nowMs: 2000,
    });
    expect(early.phase).toBe("question");
    const paused = dispatch(startSession("pz"), { type: "pause", nowMs: 2000 });
    expect(dispatch(paused, { type: "expire-round", nowMs: 99_999 }).paused).toBe(
      true,
    );
    expect(
      dispatch(createInitialLogicDeductionState(), {
        type: "expire-round",
        nowMs: 99_999,
      }).phase,
    ).toBe("intro");
  });
});

describe("next-round", () => {
  it("advances to a fresh question with a new deadline", () => {
    let state = startSession("next");
    state = answerCorrect(state, 1500);
    state = dispatch(state, { type: "next-round", nowMs: 2000 });
    expect(state.phase).toBe("question");
    expect(state.roundIndex).toBe(1);
    expect(state.roundStartedAtMs).toBe(2000);
    expect(state.roundDeadlineMs).toBe(2000 + 26_000);
    expect(state.roundOutcome).toBeNull();
    expect(state.lastAnswerIndex).toBeNull();
  });

  it("moves to results after the final round", () => {
    let state = startSession("final", "easy"); // 5 rounds
    for (let i = 0; i < 5; i += 1) {
      state = answerCorrect(state, 100 + i * 100);
      state = dispatch(state, { type: "next-round", nowMs: 10_000 * (i + 1) });
    }
    expect(state.phase).toBe("results");
    // The final transition does not advance the index past the last played round.
    expect(state.roundIndex).toBe(4);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsCorrect).toBe(5);
    expect(state.stats.score).toBe(
      perfectSessionScore(LOGIC_DEDUCTION_DIFFICULTY_PARAMS.easy),
    );
  });

  it("escalates adaptive params after a pass and eases after a fail", () => {
    let state = startSession("adaptive", "adaptive");
    expect(state.params?.entityCount).toBe(ADAPTIVE_PARAMS.entityCount);
    state = answerCorrect(state, 1100);
    state = dispatch(state, { type: "next-round", nowMs: 1200 });
    expect(state.params?.entityCount).toBe(ADAPTIVE_PARAMS.entityCount! + 1);
    state = dispatch(state, { type: "answer-option", index: wrongIndex(state), nowMs: 1300 });
    state = dispatch(state, { type: "next-round", nowMs: 1400 });
    expect(state.params?.clueCount).toBe(ADAPTIVE_PARAMS.clueCount); // back to baseline after pass+fail
  });

  it("is ignored outside the round-result phase", () => {
    const state = dispatch(startSession("guard"), {
      type: "next-round",
      nowMs: 2000,
    });
    expect(state.roundIndex).toBe(0);
  });
});

describe("pause / resume", () => {
  it("freezes the remaining budget and rebases on resume", () => {
    let state = startSession("p"); // deadline 1000 + 26000
    state = dispatch(state, { type: "pause", nowMs: 6000 });
    expect(state.paused).toBe(true);
    expect(state.roundDeadlineMs).toBeNull();
    expect(state.roundRemainingMs).toBe(21_000);
    expect(state.roundElapsedMs).toBe(5000);
    state = dispatch(state, { type: "resume", nowMs: 9000 });
    expect(state.paused).toBe(false);
    expect(state.roundDeadlineMs).toBe(30_000); // 9000 + 21000
    expect(state.roundStartedAtMs).toBe(4000); // 9000 - 5000
    expect(state.roundRemainingMs).toBeNull();
    expect(state.roundElapsedMs).toBeNull();
  });
  it("ignores pause outside question / double pause / double resume", () => {
    const intro = dispatch(createInitialLogicDeductionState(), {
      type: "pause",
      nowMs: 0,
    });
    expect(intro.paused).toBe(false);
    let state = startSession("pp");
    state = dispatch(state, { type: "pause", nowMs: 2000 });
    const stillPaused = dispatch(state, { type: "pause", nowMs: 2500 });
    expect(stillPaused.roundRemainingMs).toBe(25_000); // unchanged by 2nd pause
    const resumed = dispatch(stillPaused, { type: "resume", nowMs: 3000 });
    expect(resumed.paused).toBe(false);
    expect(dispatch(resumed, { type: "resume", nowMs: 4000 }).paused).toBe(false);
  });
});

describe("session finalization + persistence states", () => {
  it("stores the finalization payload", () => {
    const state = dispatch(createInitialLogicDeductionState(), {
      type: "session-finalized",
      xp: 12,
      normalized: 0.75,
      activeDurationMs: 30_000,
      pausedDurationMs: 2_000,
      completedAtMs: 30_100,
    });
    expect(state.xp).toBe(12);
    expect(state.normalized).toBe(0.75);
    expect(state.activeDurationMs).toBe(30_000);
    expect(state.completedAtMs).toBe(30_100);
  });

  it("tracks persistence progress and errors", () => {
    let state = dispatch(createInitialLogicDeductionState(), {
      type: "persistence-started",
    });
    expect(state.persistState).toBe("started");
    state = dispatch(state, {
      type: "persistence-failed",
      message: "boom",
    });
    expect(state.persistState).toBe("failed");
    expect(state.lastError).toBe("boom");
    expect(
      dispatch(state, { type: "persistence-succeeded" }).persistState,
    ).toBe("succeeded");
  });

  it("stores the authoritative completion outcome", () => {
    const state = dispatch(createInitialLogicDeductionState(), {
      type: "completion-outcome-received",
      xp: 7,
      currency: 3,
      deltas: [{ domain: "Logic & Problem Solving", delta: 0.1, ratingAfter: 1100 }],
    });
    expect(state.authoritativeXp).toBe(7);
    expect(state.authoritativeCurrency).toBe(3);
    expect(state.authoritativeDeltas).toHaveLength(1);
  });
});

describe("QA force hooks (state shaping)", () => {
  it("force-win ends the session as a perfect run", () => {
    const state = dispatch(startSession("qa-win"), { type: "qa/force-win" });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats).toEqual({
      score: 150 * 6,
      roundsPlayed: 6,
      roundsCorrect: 6,
      bestStreak: 6,
      streak: 6,
      totalAnswerMs: 0,
      sumAnswerRatio: 0,
    });
    expect(state.roundOutcomes).toEqual(Array.from({ length: 6 }, () => "correct"));
  });

  it("force-lose counts the in-flight round as wrong", () => {
    const fromQuestion = dispatch(startSession("qa-lose"), {
      type: "qa/force-lose",
    });
    expect(fromQuestion.phase).toBe("results");
    expect(fromQuestion.forced).toBe(true);
    expect(fromQuestion.stats.roundsPlayed).toBe(1);
    expect(fromQuestion.roundOutcomes).toEqual(["wrong"]);

    // From round-result the answered round is already counted; no double count.
    let state = startSession("qa-lose-2");
    state = answerCorrect(state, 1100);
    const played = state.stats.roundsPlayed;
    const fromResult = dispatch(state, { type: "qa/force-lose" });
    expect(fromResult.stats.roundsPlayed).toBe(played);
    expect(fromResult.roundOutcomes).toEqual(["correct"]);
  });

  it("force actions are no-ops in intro/results", () => {
    const intro = dispatch(createInitialLogicDeductionState(), {
      type: "qa/force-win",
    });
    expect(intro.phase).toBe("intro");
    const done = dispatch(startSession("done"), { type: "qa/force-win" });
    const again = dispatch(done, { type: "qa/force-lose" });
    expect(again.stats).toBe(done.stats);
  });

  it("force-timeout expires only the current question round", () => {
    let state = dispatch(startSession("qa-to"), { type: "qa/force-timeout" });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("timeout");
    expect(state.forced).toBe(false); // session itself is not forced
    expect(dispatch(state, { type: "qa/force-timeout" }).phase).toBe(
      "roundResult",
    );
    const paused = dispatch(startSession("qa-to-p"), {
      type: "pause",
      nowMs: 2000,
    });
    expect(dispatch(paused, { type: "qa/force-timeout" }).phase).toBe("question");
  });

  it("force-state seeds and sets difficulty for the next session (intro only)", () => {
    let state = dispatch(createInitialLogicDeductionState(), {
      type: "qa/force-state",
      patch: { seed: "qa-seed-7", difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("qa-seed-7");
    expect(state.difficulty).toBe("expert");
    state = dispatch(state, {
      type: "qa/force-state",
      patch: { seed: 42, difficulty: "not-a-level" as DifficultyLevel },
    });
    expect(state.seedOverride).toBe("42"); // numeric seeds are stringified
    expect(state.difficulty).toBe("expert"); // invalid level ignored
    const mid = dispatch(startSession("x"), {
      type: "qa/force-state",
      patch: { seed: "nope" },
    });
    expect(mid.seedOverride).toBeNull();
  });
});

describe("initial state", () => {
  it("starts in the intro with defaults and frozen initial stats", () => {
    const state = createInitialLogicDeductionState();
    expect(state.phase).toBe("intro");
    expect(state.difficulty).toBe("normal");
    expect(state.stats).toEqual(INITIAL_STATS);
    expect(state.tutorialOpen).toBe(false);
    expect(Object.isFrozen(INITIAL_STATS)).toBe(true);
  });
});
