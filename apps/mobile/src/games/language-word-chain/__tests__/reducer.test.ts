// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import type { DifficultyLevel } from "@/sdk";

import { ADAPTIVE_PARAMS, WORD_CHAIN_DIFFICULTY_PARAMS } from "../difficulty";
import { wordChainReducer } from "../reducer";
import {
  FULL_CHAIN_BONUS,
  PER_STEP_BASE,
  PER_STEP_MAX_SPEED,
  perfectSessionScore,
} from "../scoring";
import { createInitialLanguageWordChainState } from "../types";
import type { LanguageWordChainState } from "../types";

function startSession(
  seed: string,
  level: DifficultyLevel = "normal",
  sessionId = "s1",
): LanguageWordChainState {
  let state = createInitialLanguageWordChainState();
  state = wordChainReducer(state, { type: "select-difficulty", level });
  state = wordChainReducer(state, {
    type: "start-session",
    seed,
    sessionId,
    startedAtMs: 100,
    nowMs: 1000,
  });
  return state;
}

/** Answer every blank of the current chain correctly; returns the roundResult state. */
function playRoundCorrectly(
  state: LanguageWordChainState,
  startNowMs: number,
): LanguageWordChainState {
  let now = startNowMs;
  let current = state;
  while (current.phase === "question") {
    const step = current.currentRound!.steps[current.currentStepIndex];
    now += 100;
    current = wordChainReducer(current, {
      type: "answer-step",
      index: step.correctIndex,
      nowMs: now,
    });
  }
  return current;
}

describe("select-difficulty", () => {
  it("selects a level in the intro", () => {
    const state = wordChainReducer(createInitialLanguageWordChainState(), {
      type: "select-difficulty",
      level: "hard",
    });
    expect(state.difficulty).toBe("hard");
  });

  it("ignores selection mid-session", () => {
    const state = wordChainReducer(startSession("x"), {
      type: "select-difficulty",
      level: "easy",
    });
    expect(state.difficulty).toBe("normal");
  });
});

describe("start-session", () => {
  it("opens round 1 in the question phase with a valid chain", () => {
    const state = startSession("seed-1");
    expect(state.phase).toBe("question");
    expect(state.profile?.level).toBe("normal");
    expect(state.params?.rounds).toBe(6);
    expect(state.roundIndex).toBe(0);
    expect(state.currentRound).not.toBeNull();
    expect(state.usedChainIds).toEqual([state.currentRound!.chainId]);
    expect(state.sessionId).toBe("s1");
    expect(state.startedAtMs).toBe(100);
    expect(state.roundBudgetMs).toBe(12_000);
    expect(state.roundDeadlineMs).toBe(13_000); // nowMs + budget
    expect(state.chosenPerStep).toEqual(
      state.currentRound!.steps.map(() => null),
    );
  });

  it("determinism: same seed → same round", () => {
    const a = startSession("det");
    const b = startSession("det");
    expect(a.currentRound).toEqual(b.currentRound);
  });

  it("uses the selected difficulty params", () => {
    const expert = startSession("e", "expert");
    expect(expert.params?.rounds).toBe(8);
    expect(expert.roundBudgetMs).toBe(8_500);
    expect(expert.poolTiers).toEqual(["t3"]);
    const easy = startSession("e2", "easy");
    expect(easy.params?.rounds).toBe(5);
    expect(easy.poolTiers).toEqual(["t1"]);
  });

  it("adaptive starts at its initial tier and budget", () => {
    const adaptive = startSession("a", "adaptive");
    expect(adaptive.currentTier).toBe("t1");
    expect(adaptive.poolTiers).toEqual(["t1"]);
    expect(adaptive.roundBudgetMs).toBe(ADAPTIVE_PARAMS.timePerRoundMs);
  });

  it("is ignored without a selected difficulty", () => {
    // The initial state preselects 'normal'; force the null case explicitly.
    const initial = {
      ...createInitialLanguageWordChainState(),
      difficulty: null,
    };
    const state = wordChainReducer(initial, {
      type: "start-session",
      seed: "x",
      sessionId: "s",
      startedAtMs: 0,
      nowMs: 0,
    });
    expect(state.phase).toBe("intro");
    expect(state.currentRound).toBeNull();
  });
});

describe("answer-step", () => {
  /** Find a seed whose opening chain blanks at least `minSteps` positions. */
  function seedWithBlanks(minSteps: number): string {
    for (let i = 0; i < 60; i += 1) {
      const candidate = startSession(`blanks-${minSteps}-${i}`);
      if (candidate.currentRound!.steps.length >= minSteps) {
        return `blanks-${minSteps}-${i}`;
      }
    }
    throw new Error(`no ${minSteps}-blank opening chain found`);
  }

  it("advances to the next blank within a chain and scores the step", () => {
    const state = startSession(seedWithBlanks(2));
    const step = state.currentRound!.steps[0];
    const answered = wordChainReducer(state, {
      type: "answer-step",
      index: step.correctIndex,
      nowMs: 2000,
    });
    expect(answered.phase).toBe("question");
    expect(answered.currentStepIndex).toBe(1);
    expect(answered.stats.score).toBeGreaterThanOrEqual(PER_STEP_BASE);
    expect(answered.stats.stepsPlayed).toBe(1);
    expect(answered.stats.stepsCorrect).toBe(1);
    expect(answered.lastAnswerMs).toBe(1000); // 2000 - stepStartedAtMs(1000)
    // The chosen index is recorded for feedback rendering.
    expect(answered.chosenPerStep[0]).toBe(step.correctIndex);
  });

  it("completes the chain with a full-chain bonus on the last blank", () => {
    const finished = playRoundCorrectly(startSession("complete"), 2000);
    expect(finished.phase).toBe("roundResult");
    expect(finished.roundOutcome).toBe("correct");
    const steps = finished.stats.stepsPlayed;
    const floor = steps * PER_STEP_BASE + FULL_CHAIN_BONUS;
    const ceiling = steps * (PER_STEP_BASE + PER_STEP_MAX_SPEED) + FULL_CHAIN_BONUS;
    expect(finished.stats.score).toBeGreaterThanOrEqual(floor);
    expect(finished.stats.score).toBeLessThanOrEqual(ceiling);
    expect(finished.stats.roundsCorrect).toBe(1);
    // The streak counts consecutive correct steps within the chain.
    expect(finished.stats.bestStreak).toBe(finished.stats.stepsPlayed);
    expect(finished.roundOutcomes).toEqual(["correct"]);
  });

  it("fails the chain on a wrong answer but keeps prior step credit", () => {
    const state = startSession("wrong");
    const step = state.currentRound!.steps[0];
    const wrongIndex = step.options.findIndex(
      (_, i) => i !== step.correctIndex,
    );
    const answered = wordChainReducer(state, {
      type: "answer-step",
      index: wrongIndex,
      nowMs: 1500,
    });
    expect(answered.phase).toBe("roundResult");
    expect(answered.roundOutcome).toBe("wrong");
    expect(answered.lastAnswerIndex).toBe(wrongIndex);
    expect(answered.stats.stepsPlayed).toBe(1);
    expect(answered.stats.stepsCorrect).toBe(0);
    expect(answered.stats.streak).toBe(0);
    expect(answered.chosenPerStep[0]).toBe(wrongIndex);
  });

  it("ignores answers after the deadline, while paused, or outside question", () => {
    const state = startSession("guards");
    const step = state.currentRound!.steps[0];
    const late = wordChainReducer(state, {
      type: "answer-step",
      index: step.correctIndex,
      nowMs: state.roundDeadlineMs! + 1,
    });
    expect(late).toBe(state);
    const paused = wordChainReducer(state, { type: "pause", nowMs: 2000 });
    const whilePaused = wordChainReducer(paused, {
      type: "answer-step",
      index: step.correctIndex,
      nowMs: 2100,
    });
    expect(whilePaused.phase).toBe("question");
    expect(whilePaused.paused).toBe(true);
    const inResult = playRoundCorrectly(state, 2000);
    expect(
      wordChainReducer(inResult, {
        type: "answer-step",
        index: 0,
        nowMs: 9999,
      }),
    ).toBe(inResult);
  });
});

describe("expire-round", () => {
  it("times out the chain at the deadline and records the budget as answer time", () => {
    const state = startSession("timeout");
    const expired = wordChainReducer(state, {
      type: "expire-round",
      nowMs: state.roundDeadlineMs!,
    });
    expect(expired.phase).toBe("roundResult");
    expect(expired.roundOutcome).toBe("timeout");
    expect(expired.lastAnswerMs).toBe(state.roundBudgetMs);
    expect(expired.stats.sumAnswerRatio).toBe(1);
    expect(expired.stats.stepsPlayed).toBe(1);
    expect(expired.roundOutcomes).toEqual(["timeout"]);
  });

  it("ignores premature expiry and fires only during an unpaused question", () => {
    const state = startSession("early");
    expect(
      wordChainReducer(state, {
        type: "expire-round",
        nowMs: state.roundDeadlineMs! - 1,
      }),
    ).toBe(state);
    const paused = wordChainReducer(state, { type: "pause", nowMs: 1100 });
    expect(
      wordChainReducer(paused, { type: "expire-round", nowMs: 99_999 }),
    ).toBe(paused);
  });
});

describe("next-round", () => {
  it("generates a different chain and resets per-chain state", () => {
    const first = playRoundCorrectly(startSession("next"), 2000);
    const second = wordChainReducer(first, { type: "next-round", nowMs: 5000 });
    expect(second.phase).toBe("question");
    expect(second.roundIndex).toBe(1);
    expect(second.currentRound!.chainId).not.toBe(first.currentRound!.chainId);
    expect(second.usedChainIds).toHaveLength(2);
    expect(second.currentStepIndex).toBe(0);
    expect(second.roundOutcome).toBeNull();
    expect(second.roundDeadlineMs).toBe(17_000); // 5000 + 12000
  });

  it("moves to results after the final round", () => {
    let state = startSession("final", "easy"); // 5 rounds
    let now = 2000;
    for (let round = 0; round < 5; round += 1) {
      const played = playRoundCorrectly(state, now);
      now += 10_000;
      state = wordChainReducer(played, { type: "next-round", nowMs: now });
    }
    expect(state.phase).toBe("results");
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsCorrect).toBe(5);
    // Blank count per chain is random within [minBlanks, maxBlanks], so the
    // natural perfect score scales with the drawn blanks: every step answered
    // instantly earns base + max speed bonus, plus one full-chain bonus.
    const expectedScore =
      state.stats.stepsPlayed * (PER_STEP_BASE + PER_STEP_MAX_SPEED) +
      5 * FULL_CHAIN_BONUS;
    expect(state.stats.score).toBe(expectedScore);
    // It can never exceed the reference maximum (all chains at max blanks).
    expect(expectedScore).toBeLessThanOrEqual(
      perfectSessionScore(WORD_CHAIN_DIFFICULTY_PARAMS.easy),
    );
  });

  it("adapts tier and budget between rounds", () => {
    let state = startSession("adapt", "adaptive");
    const played = playRoundCorrectly(state, 2000);
    const next = wordChainReducer(played, { type: "next-round", nowMs: 4000 });
    expect(next.currentTier).toBe("t2");
    expect(next.roundBudgetMs).toBe(8_000);
    const failed = wordChainReducer(next, {
      type: "qa/force-timeout",
    });
    const eased = wordChainReducer(failed, { type: "next-round", nowMs: 6000 });
    expect(eased.currentTier).toBe("t1");
    expect(eased.roundBudgetMs).toBe(9_000);
  });

  it("is ignored outside roundResult", () => {
    const state = startSession("guard-next");
    expect(
      wordChainReducer(state, { type: "next-round", nowMs: 2000 }),
    ).toBe(state);
  });
});

describe("pause / resume", () => {
  it("freezes the deadline and step clock, then rebuilds them on resume", () => {
    const state = startSession("p");
    const paused = wordChainReducer(state, { type: "pause", nowMs: 3000 });
    expect(paused.paused).toBe(true);
    expect(paused.roundDeadlineMs).toBeNull();
    expect(paused.roundRemainingMs).toBe(10_000); // 13000 - 3000
    expect(paused.roundElapsedMs).toBe(2000);
    expect(paused.stepElapsedMs).toBe(2000);
    const resumed = wordChainReducer(paused, { type: "resume", nowMs: 8000 });
    expect(resumed.paused).toBe(false);
    expect(resumed.roundDeadlineMs).toBe(18_000); // 8000 + 10000
    expect(resumed.stepStartedAtMs).toBe(6000); // 8000 - 2000
    expect(resumed.roundRemainingMs).toBeNull();
  });

  it("only pauses during an unpaused question and only resumes from paused", () => {
    const initial = createInitialLanguageWordChainState();
    expect(wordChainReducer(initial, { type: "pause", nowMs: 0 }).paused).toBe(
      false,
    );
    const state = startSession("p2");
    const paused = wordChainReducer(state, { type: "pause", nowMs: 1200 });
    expect(wordChainReducer(paused, { type: "pause", nowMs: 1300 })).toBe(
      paused,
    );
    const resumed = wordChainReducer(paused, { type: "resume", nowMs: 1400 });
    expect(wordChainReducer(resumed, { type: "resume", nowMs: 1500 })).toBe(
      resumed,
    );
  });

  it("excludes paused time from later answer timing", () => {
    const state = startSession("timing");
    const paused = wordChainReducer(state, { type: "pause", nowMs: 2000 });
    const resumed = wordChainReducer(paused, { type: "resume", nowMs: 9000 });
    const step = resumed.currentRound!.steps[0];
    const answered = wordChainReducer(resumed, {
      type: "answer-step",
      index: step.correctIndex,
      nowMs: 9500,
    });
    // Answer time counts only active time. The step started at 1000 and was
    // paused at 2000 (elapsed 1000), so resume rebases it to 9000 - 1000 =
    // 8000; the answer at 9500 yields 1500ms of ACTIVE time — the 7000ms
    // wall gap that included the pause never counts.
    expect(answered.lastAnswerMs).toBe(1500);
  });
});

describe("session finalization + persistence states", () => {
  it("stores the finalization payload", () => {
    const state = wordChainReducer(createInitialLanguageWordChainState(), {
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
    let state = wordChainReducer(createInitialLanguageWordChainState(), {
      type: "persistence-started",
    });
    expect(state.persistState).toBe("started");
    state = wordChainReducer(state, {
      type: "persistence-failed",
      message: "boom",
    });
    expect(state.persistState).toBe("failed");
    expect(state.lastError).toBe("boom");
    expect(
      wordChainReducer(state, { type: "persistence-succeeded" }).persistState,
    ).toBe("succeeded");
  });

  it("records the authoritative completion outcome", () => {
    const state = wordChainReducer(createInitialLanguageWordChainState(), {
      type: "completion-outcome-received",
      xp: 7,
      currency: 3,
      deltas: [{ domain: "language", delta: 4, ratingAfter: 104 }],
    });
    expect(state.authoritativeXp).toBe(7);
    expect(state.authoritativeCurrency).toBe(3);
    expect(state.authoritativeDeltas).toEqual([
      { domain: "language", delta: 4, ratingAfter: 104 },
    ]);
  });
});

describe("tutorial actions", () => {
  it("opens and closes the tutorial overlay", () => {
    let state = wordChainReducer(createInitialLanguageWordChainState(), {
      type: "tutorial-open",
    });
    expect(state.tutorialOpen).toBe(true);
    state = wordChainReducer(state, { type: "tutorial-close" });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe("QA force hooks (state shaping)", () => {
  it("force-win ends the session as a perfect run", () => {
    const state = wordChainReducer(startSession("qa-win"), {
      type: "qa/force-win",
    });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.roundsCorrect).toBe(6);
    expect(state.stats.score).toBe(
      perfectSessionScore(WORD_CHAIN_DIFFICULTY_PARAMS.normal),
    );
    expect(state.stats.sumAnswerRatio).toBe(0);
    expect(state.roundOutcomes).toHaveLength(6);
  });

  it("force-lose ends the session counting the in-flight chain as failed", () => {
    const fromQuestion = wordChainReducer(startSession("qa-lose"), {
      type: "qa/force-lose",
    });
    expect(fromQuestion.phase).toBe("results");
    expect(fromQuestion.forced).toBe(true);
    expect(fromQuestion.stats.roundsPlayed).toBe(1);
    expect(fromQuestion.roundOutcomes).toEqual(["wrong"]);

    // From roundResult the already-scored chain is not double counted.
    const played = playRoundCorrectly(startSession("qa-lose-2"), 2000);
    const fromResult = wordChainReducer(played, { type: "qa/force-lose" });
    expect(fromResult.stats.roundsPlayed).toBe(1);
    expect(fromResult.roundOutcomes).toEqual(["correct"]);
  });

  it("force-timeout expires only the current chain and keeps playing", () => {
    const state = wordChainReducer(startSession("qa-timeout"), {
      type: "qa/force-timeout",
    });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("timeout");
    expect(state.forced).toBe(false);
    expect(state.stats.roundsPlayed).toBe(1);
    // The session continues normally afterwards.
    const next = wordChainReducer(state, { type: "next-round", nowMs: 99_999 });
    expect(next.phase).toBe("question");
    expect(next.roundIndex).toBe(1);
  });

  it("force actions are no-ops in intro/results", () => {
    const intro = createInitialLanguageWordChainState();
    expect(
      wordChainReducer(intro, { type: "qa/force-win" }).phase,
    ).toBe("intro");
    expect(
      wordChainReducer(intro, { type: "qa/force-lose" }).phase,
    ).toBe("intro");
    expect(
      wordChainReducer(intro, { type: "qa/force-timeout" }).phase,
    ).toBe("intro");
    const done = wordChainReducer(startSession("done"), {
      type: "qa/force-win",
    });
    expect(wordChainReducer(done, { type: "qa/force-win" })).toBe(done);
  });

  it("force-state seeds and sets the difficulty for the next session (intro only)", () => {
    let state = wordChainReducer(createInitialLanguageWordChainState(), {
      type: "qa/force-state",
      patch: { seed: "qa-seed-7", difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("qa-seed-7");
    expect(state.difficulty).toBe("expert");
    // Unknown difficulty values are rejected by the isDifficultyLevel guard
    // (the patch arrives untyped from QA tooling, hence the cast).
    state = wordChainReducer(state, {
      type: "qa/force-state",
      patch: { difficulty: "impossible" as unknown as DifficultyLevel },
    });
    expect(state.difficulty).toBe("expert");
    // Mid-session the patch is ignored entirely.
    const mid = wordChainReducer(startSession("x"), {
      type: "qa/force-state",
      patch: { seed: "nope" },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
