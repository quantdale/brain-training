// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import { createRng } from "@/sdk";
import type { DifficultyLevel } from "@/sdk";

import { gridRecallGameReducer } from "../reducer";
import { createInitialGridRecallState } from "../types";
import type { GridRecallGameState } from "../types";
import { generateTargetCells } from "../generator";
import { perfectSessionScore, referenceMaxTargets as refMax } from "../scoring";
import { GRID_RECALL_DIFFICULTY_PARAMS } from "../difficulty";

function startSession(
  seed: string,
  level: DifficultyLevel = "normal",
  sessionId = "s1",
): GridRecallGameState {
  let state = createInitialGridRecallState();
  state = gridRecallGameReducer(state, { type: "select-difficulty", level });
  state = gridRecallGameReducer(state, {
    type: "start-session",
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

function targetsFor(
  seed: string,
  roundIndex: number,
  gridSize: number,
  targetCount: number,
  prev: number[] | null,
) {
  return generateTargetCells({
    rng: createRng(seed),
    roundIndex,
    gridSize,
    targetCount,
    prevTargets: prev,
  });
}

describe("select-difficulty", () => {
  it("selects a level in the intro", () => {
    const state = gridRecallGameReducer(createInitialGridRecallState(), {
      type: "select-difficulty",
      level: "hard",
    });
    expect(state.difficulty).toBe("hard");
  });
  it("ignores selection mid-session", () => {
    const state = gridRecallGameReducer(startSession("x"), {
      type: "select-difficulty",
      level: "easy",
    });
    expect(state.difficulty).toBe("normal");
  });
});

describe("start-session", () => {
  it("opens round 1 in the study phase with a valid target set", () => {
    const state = startSession("seed-1");
    expect(state.phase).toBe("study");
    expect(state.profile?.level).toBe("normal");
    expect(state.targetCount).toBe(5);
    expect(state.targets).toHaveLength(5);
    expect(new Set(state.targets).size).toBe(5); // all distinct
    expect(state.sessionId).toBe("s1");
    expect(state.startedAtMs).toBe(100);
  });

  it("determinism: same seed → same target set", () => {
    const a = startSession("det");
    const b = startSession("det");
    expect(a.targets).toEqual(b.targets);
    expect(a.targets).toEqual(targetsFor("det", 0, 16, 5, null));
  });

  it("uses the selected difficulty params", () => {
    const expert = startSession("e", "expert");
    expect(expert.targetCount).toBe(12);
    expect(expert.profile?.parameters.gridSize).toBe(36);
    const easy = startSession("e2", "easy");
    expect(easy.targetCount).toBe(3);
  });

  it("near-duplicate avoidance differs from the previous round", () => {
    const r0 = startSession("nd");
    const r1 = gridRecallGameReducer(r0, { type: "study-tick" });
    // force pass to advance
    const passed = gridRecallGameReducer(r1, { type: "submit" });
    const next = gridRecallGameReducer(passed, { type: "next-round" });
    expect(next.targets).not.toEqual(r0.targets);
  });
});

describe("study-tick", () => {
  it("hides the pattern and moves to input after the study window", () => {
    let state = startSession("r");
    expect(state.phase).toBe("study");
    state = gridRecallGameReducer(state, { type: "study-tick" });
    expect(state.phase).toBe("input");
    expect(state.selections).toEqual([]);
  });
  it("is ignored outside study or while paused", () => {
    const input = startSession("r");
    const toInput = gridRecallGameReducer(input, { type: "study-tick" });
    expect(gridRecallGameReducer(toInput, { type: "study-tick" }).phase).toBe(
      "input",
    );
    const paused = gridRecallGameReducer(startSession("r"), { type: "pause" });
    expect(gridRecallGameReducer(paused, { type: "study-tick" }).phase).toBe(
      "study",
    );
  });
});

describe("tap-cell + submit", () => {
  function toInput(seed = "tap"): GridRecallGameState {
    return gridRecallGameReducer(startSession(seed), { type: "study-tick" });
  }

  it("toggles a cell selection", () => {
    let state = toInput();
    state = gridRecallGameReducer(state, { type: "tap-cell", index: 0 });
    expect(state.selections).toContain(0);
    state = gridRecallGameReducer(state, { type: "tap-cell", index: 0 });
    expect(state.selections).not.toContain(0);
  });

  it("passes when all targets are selected with no wrong taps", () => {
    let state = toInput("perfect");
    const targets = state.targets;
    for (const t of targets) {
      state = gridRecallGameReducer(state, { type: "tap-cell", index: t });
    }
    state = gridRecallGameReducer(state, { type: "submit" });
    expect(state.phase).toBe("roundResult");
    expect(state.roundOutcome).toBe("passed");
    expect(state.roundCorrectTargets).toBe(targets.length);
    expect(state.roundWrongTaps).toBe(0);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.bestRecall).toBe(targets.length);
  });

  it("fails but gives partial credit when some targets missed", () => {
    let state = toInput("partial");
    const targets = state.targets;
    // select only the first target
    state = gridRecallGameReducer(state, {
      type: "tap-cell",
      index: targets[0],
    });
    state = gridRecallGameReducer(state, { type: "submit" });
    expect(state.roundOutcome).toBe("failed");
    expect(state.roundCorrectTargets).toBe(1);
    expect(state.stats.correctTargets).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0); // partial credit
  });

  it("penalizes wrong taps", () => {
    let state = toInput("wrong");
    const targetSet = new Set(state.targets);
    const wrongCell = Array.from({ length: 16 }, (_, i) => i).find(
      (i) => !targetSet.has(i),
    )!;
    state = gridRecallGameReducer(state, {
      type: "tap-cell",
      index: wrongCell,
    });
    state = gridRecallGameReducer(state, { type: "submit" });
    expect(state.roundWrongTaps).toBe(1);
    expect(state.stats.wrongTaps).toBe(1);
  });

  it("cannot submit or tap after submit (no double counting)", () => {
    let state = toInput("double");
    for (const t of state.targets) {
      state = gridRecallGameReducer(state, { type: "tap-cell", index: t });
    }
    state = gridRecallGameReducer(state, { type: "submit" });
    const before = state.stats.roundsPlayed;
    state = gridRecallGameReducer(state, { type: "tap-cell", index: 0 });
    state = gridRecallGameReducer(state, { type: "submit" });
    expect(state.stats.roundsPlayed).toBe(before);
  });
});

describe("next-round", () => {
  it("escalates after a pass and regenerates a distinct set", () => {
    let state = gridRecallGameReducer(startSession("esc"), {
      type: "study-tick",
    });
    for (const t of state.targets) {
      state = gridRecallGameReducer(state, { type: "tap-cell", index: t });
    }
    state = gridRecallGameReducer(state, { type: "submit" });
    const prevTargets = state.targets;
    state = gridRecallGameReducer(state, { type: "next-round" });
    expect(state.phase).toBe("study");
    expect(state.roundIndex).toBe(1);
    expect(state.targetCount).toBe(6);
    expect(state.targets).not.toEqual(prevTargets);
  });

  it("moves to results after the final round", () => {
    let state = startSession("final", "easy"); // 4 rounds, count 3
    for (let round = 0; round < 4; round += 1) {
      state = gridRecallGameReducer(state, { type: "study-tick" });
      for (const t of state.targets) {
        state = gridRecallGameReducer(state, { type: "tap-cell", index: t });
      }
      state = gridRecallGameReducer(state, { type: "submit" });
      state = gridRecallGameReducer(state, { type: "next-round" });
    }
    expect(state.phase).toBe("results");
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(
      perfectSessionScore(GRID_RECALL_DIFFICULTY_PARAMS.easy),
    );
    expect(state.stats.bestRecall).toBe(
      refMax(GRID_RECALL_DIFFICULTY_PARAMS.easy),
    );
  });
});

describe("pause / resume", () => {
  it("pauses only during a session and resumes from paused", () => {
    const intro = gridRecallGameReducer(createInitialGridRecallState(), {
      type: "pause",
    });
    expect(intro.paused).toBe(false);
    let state = gridRecallGameReducer(startSession("p"), { type: "pause" });
    expect(state.paused).toBe(true);
    state = gridRecallGameReducer(state, { type: "resume" });
    expect(state.paused).toBe(false);
    expect(gridRecallGameReducer(state, { type: "resume" }).paused).toBe(false);
  });
});

describe("session finalization + persistence states", () => {
  it("stores the finalization payload", () => {
    const state = gridRecallGameReducer(createInitialGridRecallState(), {
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
  });

  it("tracks persistence progress", () => {
    let state = gridRecallGameReducer(createInitialGridRecallState(), {
      type: "persistence-started",
    });
    expect(state.persistState).toBe("started");
    state = gridRecallGameReducer(state, {
      type: "persistence-failed",
      message: "boom",
    });
    expect(state.persistState).toBe("failed");
    expect(state.lastError).toBe("boom");
    expect(
      gridRecallGameReducer(state, { type: "persistence-succeeded" })
        .persistState,
    ).toBe("succeeded");
  });
});

describe("QA force hooks (state shaping)", () => {
  it("force-win ends the session as a perfect run", () => {
    const state = gridRecallGameReducer(startSession("qa-win"), {
      type: "qa/force-win",
    });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(
      perfectSessionScore(GRID_RECALL_DIFFICULTY_PARAMS.normal),
    );
    expect(state.stats.bestRecall).toBe(
      refMax(GRID_RECALL_DIFFICULTY_PARAMS.normal),
    );
  });

  it("force-lose ends the session with the current round failed", () => {
    const state = gridRecallGameReducer(startSession("qa-lose"), {
      type: "qa/force-lose",
    });
    expect(state.phase).toBe("results");
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it("force actions are no-ops in intro/results", () => {
    const intro = gridRecallGameReducer(createInitialGridRecallState(), {
      type: "qa/force-win",
    });
    expect(intro.phase).toBe("intro");
  });

  it("force-state seeds and sets the difficulty for the next session (intro only)", () => {
    let state = gridRecallGameReducer(createInitialGridRecallState(), {
      type: "qa/force-state",
      patch: { seed: "qa-seed-7", difficulty: "expert" },
    });
    expect(state.seedOverride).toBe("qa-seed-7");
    expect(state.difficulty).toBe("expert");
    const mid = gridRecallGameReducer(startSession("x"), {
      type: "qa/force-state",
      patch: { seed: "nope" },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
