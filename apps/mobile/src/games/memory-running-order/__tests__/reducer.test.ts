// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";
import type { DifficultyLevel } from "@/sdk";

import { runningOrderGameReducer } from "../reducer";
import { createInitialRunningOrderState } from "../types";
import type {
  QaForceStatePatch,
  RunningOrderGameState,
} from "../types";
import { generateStream, streamTarget } from "../generator";
import {
  perfectSessionScore,
  referenceMaxTargets as refMax,
  roundScore,
} from "../scoring";
import { RUNNING_ORDER_DIFFICULTY_PARAMS } from "../difficulty";
import { SYMBOL_COUNT } from "../symbols";

const NORMAL = RUNNING_ORDER_DIFFICULTY_PARAMS.normal;

function startSession(
  seed: string,
  level: DifficultyLevel = "normal",
  sessionId = "s1",
): RunningOrderGameState {
  let state = createInitialRunningOrderState();
  state = runningOrderGameReducer(state, { type: "select-difficulty", level });
  state = runningOrderGameReducer(state, {
    type: "start-session",
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

/** Drive the reveal phase to completion (pure reducer ticks). */
function toInput(seed = "tap", level: DifficultyLevel = "normal") {
  let state = startSession(seed, level);
  while (state.phase === "reveal") {
    state = runningOrderGameReducer(state, { type: "reveal-tick" });
  }
  return state;
}

function targetOf(state: RunningOrderGameState): number[] {
  return streamTarget(state.stream, state.recallLength);
}

function submitAnswer(
  state: RunningOrderGameState,
  answer: readonly number[],
): RunningOrderGameState {
  let next = state;
  for (const id of answer) {
    next = runningOrderGameReducer(next, { type: "tap-symbol", id });
  }
  return runningOrderGameReducer(next, { type: "submit" });
}

describe("select-difficulty", () => {
  it("selects a level in the intro", () => {
    const state = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "select-difficulty",
      level: "hard",
    });
    expect(state.difficulty).toBe("hard");
  });
  it("ignores selection mid-session", () => {
    const state = runningOrderGameReducer(startSession("x"), {
      type: "select-difficulty",
      level: "easy",
    });
    expect(state.difficulty).toBe("normal");
  });
});

describe("start-session", () => {
  it("opens round 1 in the reveal phase with a valid stream", () => {
    const state = startSession("seed-1");
    expect(state.phase).toBe("reveal");
    expect(state.revealedIndex).toBe(0);
    expect(state.profile?.level).toBe("normal");
    expect(state.recallLength).toBe(NORMAL.initialRecallLength);
    expect(state.stream).toHaveLength(NORMAL.streamLen);
    for (const id of state.stream) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(SYMBOL_COUNT);
    }
    expect(state.sessionId).toBe("s1");
    expect(state.startedAtMs).toBe(100);
    expect(state.stats.roundsPlayed).toBe(0);
  });

  it("determinism: same seed → same round-1 stream", () => {
    const a = startSession("det");
    const b = startSession("det");
    expect(a.stream).toEqual(b.stream);
    expect(a.stream).toEqual(
      generateStream({
        rng: createRng("det"),
        roundIndex: 0,
        streamLen: NORMAL.streamLen,
        recallLength: NORMAL.initialRecallLength,
        prevTarget: null,
      }),
    );
  });

  it("uses the selected difficulty params", () => {
    const expert = startSession("e", "expert");
    expect(expert.recallLength).toBe(4);
    expect(expert.stream).toHaveLength(8);
    const easy = startSession("e2", "easy");
    expect(easy.recallLength).toBe(2);
    expect(easy.stream).toHaveLength(3);
  });
});

describe("reveal-tick", () => {
  it("advances through the stream and then moves to input", () => {
    let state = startSession("r"); // streamLen 4, revealedIndex 0
    state = runningOrderGameReducer(state, { type: "reveal-tick" });
    expect(state.revealedIndex).toBe(1);
    state = runningOrderGameReducer(state, { type: "reveal-tick" });
    expect(state.revealedIndex).toBe(2);
    state = runningOrderGameReducer(state, { type: "reveal-tick" });
    expect(state.revealedIndex).toBe(3);
    state = runningOrderGameReducer(state, { type: "reveal-tick" });
    expect(state.phase).toBe("input");
    expect(state.revealedIndex).toBe(-1);
    expect(state.answer).toEqual([]);
  });
  it("is ignored outside reveal or while paused", () => {
    const input = toInput("r");
    expect(
      runningOrderGameReducer(input, { type: "reveal-tick" }).phase,
    ).toBe("input");
    const paused = runningOrderGameReducer(startSession("r"), {
      type: "pause",
    });
    const frozen = runningOrderGameReducer(paused, { type: "reveal-tick" });
    expect(frozen.phase).toBe("reveal");
    expect(frozen.revealedIndex).toBe(paused.revealedIndex);
  });
});

describe("tap-symbol / backspace / submit", () => {
  it("appends taps up to the recall length and ignores extras", () => {
    let state = toInput("full");
    const target = targetOf(state);
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[0] });
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[1] });
    expect(state.answer).toEqual([target[0], target[1]]);
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[2] });
    expect(state.answer).toEqual(target);
    // Answer is full → further taps are ignored.
    const extra = (target[0] + 1) % SYMBOL_COUNT;
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: extra });
    expect(state.answer).toEqual(target);
  });

  it("backspaces the last pick and ignores an empty backspace", () => {
    let state = toInput("back");
    const target = targetOf(state);
    expect(
      runningOrderGameReducer(state, { type: "backspace" }).answer,
    ).toEqual([]);
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[0] });
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[1] });
    state = runningOrderGameReducer(state, { type: "backspace" });
    expect(state.answer).toEqual([target[0]]);
  });

  it("passes a perfectly ordered recall and scores it", () => {
    let state = toInput("perfect");
    const target = targetOf(state);
    state = submitAnswer(state, target);
    expect(state.phase).toBe("roundResult");
    expect(state.roundScored).toBe(true);
    expect(state.roundOutcome).toBe("passed");
    expect(state.roundCorrectTargets).toBe(target.length);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.score).toBe(roundScore(3, NORMAL.initialRecallLength));
    expect(state.stats.bestRecall).toBe(target.length);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.totalTargets).toBe(target.length);
    expect(state.stats.correctTargets).toBe(target.length);
  });

  it("counts positional matches only (order matters)", () => {
    const state0 = toInput("order");
    const target = targetOf(state0);
    const swapped = [target[1], target[0], target[2]];
    const expectedCorrect = swapped.filter((v, i) => v === target[i]).length;
    const state = submitAnswer(state0, swapped);
    expect(state.roundCorrectTargets).toBe(expectedCorrect);
    expect(state.roundOutcome).toBe(
      expectedCorrect === target.length ? "passed" : "failed",
    );
    expect(state.stats.score).toBe(
      Math.round(roundScore(3, NORMAL.initialRecallLength) * (expectedCorrect / target.length)),
    );
  });

  it("ignores an incomplete submit", () => {
    let state = toInput("incomplete");
    const target = targetOf(state);
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[0] });
    const submitted = runningOrderGameReducer(state, { type: "submit" });
    expect(submitted.phase).toBe("input");
    expect(submitted.stats.roundsPlayed).toBe(0);
  });

  it("cannot tap or submit after scoring (no double counting)", () => {
    let state = toInput("double");
    state = submitAnswer(state, targetOf(state));
    const before = state.stats.roundsPlayed;
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: 0 });
    state = runningOrderGameReducer(state, { type: "backspace" });
    state = runningOrderGameReducer(state, { type: "submit" });
    expect(state.stats.roundsPlayed).toBe(before);
    expect(state.phase).toBe("roundResult");
  });

  it("ignores input actions while paused", () => {
    let state = toInput("paused-input");
    state = runningOrderGameReducer(state, { type: "pause" });
    const target = targetOf(state);
    state = runningOrderGameReducer(state, { type: "tap-symbol", id: target[0] });
    expect(state.answer).toEqual([]);
    state = runningOrderGameReducer(state, { type: "submit" });
    expect(state.phase).toBe("input");
    expect(state.stats.roundsPlayed).toBe(0);
  });
});

describe("next-round", () => {
  it("escalates after a pass and regenerates a distinct trailing target", () => {
    let state = toInput("esc");
    const prevTarget = targetOf(state);
    state = submitAnswer(state, prevTarget);
    state = runningOrderGameReducer(state, { type: "next-round" });
    expect(state.phase).toBe("reveal");
    expect(state.roundIndex).toBe(1);
    expect(state.recallLength).toBe(4); // escalated, capped at streamLen
    expect(state.answer).toEqual([]);
    expect(state.roundScored).toBe(false);
    expect(streamTarget(state.stream, state.recallLength)).not.toEqual(
      prevTarget,
    );
  });

  it("holds the recall length after a failure", () => {
    let state = toInput("hold");
    const target = targetOf(state);
    const wrong = target.map((id) => (id + 1) % SYMBOL_COUNT);
    state = submitAnswer(state, wrong);
    expect(state.roundOutcome).toBe("failed");
    state = runningOrderGameReducer(state, { type: "next-round" });
    expect(state.roundIndex).toBe(1);
    expect(state.recallLength).toBe(3); // held
  });

  it("moves to results after the final round", () => {
    let state = startSession("final", "easy"); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      while (state.phase === "reveal") {
        state = runningOrderGameReducer(state, { type: "reveal-tick" });
      }
      state = submitAnswer(state, targetOf(state));
      state = runningOrderGameReducer(state, { type: "next-round" });
    }
    expect(state.phase).toBe("results");
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(
      perfectSessionScore(RUNNING_ORDER_DIFFICULTY_PARAMS.easy),
    );
    expect(state.stats.bestRecall).toBe(
      refMax(RUNNING_ORDER_DIFFICULTY_PARAMS.easy),
    );
  });
});

describe("pause / resume", () => {
  it("pauses only during a session and resumes from paused", () => {
    const intro = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "pause",
    });
    expect(intro.paused).toBe(false);
    let state = runningOrderGameReducer(startSession("p"), { type: "pause" });
    expect(state.paused).toBe(true);
    state = runningOrderGameReducer(state, { type: "resume" });
    expect(state.paused).toBe(false);
    expect(runningOrderGameReducer(state, { type: "resume" }).paused).toBe(
      false,
    );
  });
  it("ignores pause in results", () => {
    const state = runningOrderGameReducer(startSession("p"), {
      type: "qa/force-win",
    });
    expect(runningOrderGameReducer(state, { type: "pause" }).paused).toBe(
      false,
    );
  });
});

describe("session finalization + persistence states", () => {
  it("stores the finalization payload", () => {
    const state = runningOrderGameReducer(createInitialRunningOrderState(), {
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
    expect(state.pausedDurationMs).toBe(2_000);
    expect(state.completedAtMs).toBe(30_100);
  });

  it("tracks persistence progress and failures", () => {
    let state = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "persistence-started",
    });
    expect(state.persistState).toBe("started");
    state = runningOrderGameReducer(state, {
      type: "persistence-failed",
      message: "boom",
    });
    expect(state.persistState).toBe("failed");
    expect(state.lastError).toBe("boom");
    expect(
      runningOrderGameReducer(state, { type: "persistence-succeeded" })
        .persistState,
    ).toBe("succeeded");
  });

  it("stores the authoritative rating outcome", () => {
    const state = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "completion-outcome-received",
      xp: 7,
      currency: 3,
      deltas: [{ domain: "Memory", delta: 0.4, ratingAfter: 1004 }],
    });
    expect(state.authoritativeXp).toBe(7);
    expect(state.authoritativeCurrency).toBe(3);
    expect(state.authoritativeDeltas).toEqual([
      { domain: "Memory", delta: 0.4, ratingAfter: 1004 },
    ]);
  });
});

describe("QA force hooks (state shaping)", () => {
  it("force-win ends the session as a perfect run", () => {
    const state = runningOrderGameReducer(startSession("qa-win"), {
      type: "qa/force-win",
    });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(NORMAL.rounds);
    expect(state.stats.roundsPassed).toBe(NORMAL.rounds);
    expect(state.stats.score).toBe(perfectSessionScore(NORMAL));
    expect(state.stats.bestRecall).toBe(refMax(NORMAL));
    expect(state.stats.bestStreak).toBe(NORMAL.rounds);
    expect(state.stats.correctTargets).toBe(state.stats.totalTargets);
  });

  it("force-win is a no-op in intro", () => {
    const intro = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "qa/force-win",
    });
    expect(intro.phase).toBe("intro");
    expect(intro.forced).toBe(false);
  });

  it("force-win is a no-op in results (stats stay perfect, not doubled)", () => {
    const won = runningOrderGameReducer(startSession("qa-again"), {
      type: "qa/force-win",
    });
    const again = runningOrderGameReducer(won, { type: "qa/force-win" });
    expect(again.phase).toBe("results");
    expect(again.stats.score).toBe(won.stats.score);
    expect(again.stats.roundsPlayed).toBe(won.stats.roundsPlayed);
  });

  it("force-lose ends the session with the current round failed", () => {
    const state = runningOrderGameReducer(startSession("qa-lose"), {
      type: "qa/force-lose",
    });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it("force-lose does not double count an already-scored round", () => {
    let state = toInput("qa-lose-scored");
    state = submitAnswer(state, targetOf(state));
    expect(state.stats.roundsPlayed).toBe(1);
    state = runningOrderGameReducer(state, { type: "qa/force-lose" });
    expect(state.phase).toBe("results");
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it("force-state seeds and sets the difficulty for the next session (intro only)", () => {
    let state = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "qa/force-state",
      patch: { seed: "qa-seed-7", difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("qa-seed-7");
    expect(state.difficulty).toBe("expert");
    const mid = runningOrderGameReducer(startSession("x"), {
      type: "qa/force-state",
      patch: { seed: "nope" },
    });
    expect(mid.seedOverride).toBeNull();
  });

  it("force-state ignores an invalid difficulty value", () => {
    const state = runningOrderGameReducer(createInitialRunningOrderState(), {
      type: "qa/force-state",
      patch: {
        seed: "qa-seed",
        difficulty: "lunatic",
      } as unknown as QaForceStatePatch,
    });
    expect(state.difficulty).toBe("normal");
    expect(state.seedOverride).toBe("qa-seed");
  });
});
