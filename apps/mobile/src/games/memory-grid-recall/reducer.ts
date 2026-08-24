/**
 * Pure game state machine for the Grid Recall game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: study pacing timer,
 * the SDK `SessionLifecycle` (start/pause/resume/complete/abandon), the
 * tutorial, the dev-only QA panel, and result persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from "@/sdk";

import {
  gridRecallParamsFromProfile,
  nextTargetCount,
  resolveGridRecallDifficulty,
} from "./difficulty";
import { generateTargetCells } from "./generator";
import {
  perfectSessionScore,
  referenceMaxTargets,
  roundScore,
} from "./scoring";
import {
  INITIAL_STATS,
  createInitialGridRecallState,
} from "./types";
import type {
  GridRecallAction,
  GridRecallGameState,
  GridRecallStats,
} from "./types";

export { createInitialGridRecallState };

export function gridRecallGameReducer(
  state: GridRecallGameState,
  action: GridRecallAction,
): GridRecallGameState {
  switch (action.type) {
    case "select-difficulty": {
      if (state.phase !== "intro") {
        return state;
      }
      return { ...state, difficulty: action.level };
    }

    case "start-session": {
      if (state.difficulty === null) {
        return state;
      }
      const profile = resolveGridRecallDifficulty(state.difficulty);
      const params = gridRecallParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const targets = generateTargetCells({
        rng,
        roundIndex: 0,
        gridSize: params.gridSize,
        targetCount: params.initialTargetCount,
        prevTargets: null,
      });
      return {
        ...state,
        phase: "study",
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        targetCount: params.initialTargetCount,
        targets,
        selections: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundWrongTaps: 0,
        roundOutcome: null,
        prevTargets: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "study-tick": {
      // The study timer expired: hide the pattern and move to input.
      if (state.phase !== "study" || state.paused) {
        return state;
      }
      return { ...state, phase: "input", selections: [] };
    }

    case "tap-cell": {
      if (state.phase !== "input" || state.paused || state.roundScored) {
        return state;
      }
      const selected = state.selections.includes(action.index);
      if (selected) {
        return {
          ...state,
          selections: state.selections.filter((c) => c !== action.index),
        };
      }
      return { ...state, selections: [...state.selections, action.index] };
    }

    case "submit": {
      if (state.phase !== "input" || state.paused || state.roundScored) {
        return state;
      }
      const targetSet = new Set(state.targets);
      const roundCorrectTargets = state.selections.filter((c) =>
        targetSet.has(c),
      ).length;
      const roundWrongTaps = state.selections.filter(
        (c) => !targetSet.has(c),
      ).length;
      const passed =
        roundCorrectTargets === state.targetCount && roundWrongTaps === 0;
      const fraction =
        state.targetCount > 0 ? roundCorrectTargets / state.targetCount : 0;
      const roundPoints = Math.max(
        0,
        Math.round(
          roundScore(
            state.targetCount,
            gridRecallParamsFromProfile(state.profile!).initialTargetCount,
          ) * fraction,
        ) -
          25 * roundWrongTaps,
      );
      const streak = passed ? state.stats.streak + 1 : 0;
      const stats: GridRecallStats = {
        score: state.stats.score + roundPoints,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (passed ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        bestRecall: Math.max(state.stats.bestRecall, roundCorrectTargets),
        totalTargets: state.stats.totalTargets + state.targetCount,
        correctTargets: state.stats.correctTargets + roundCorrectTargets,
        wrongTaps: state.stats.wrongTaps + roundWrongTaps,
      };
      return {
        ...state,
        phase: "roundResult",
        roundScored: true,
        roundCorrectTargets,
        roundWrongTaps,
        roundOutcome: passed ? "passed" : "failed",
        stats,
      };
    }

    case "next-round": {
      if (
        state.phase !== "roundResult" ||
        state.profile === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const params = gridRecallParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "passed";
      const targetCount = nextTargetCount(
        state.targetCount,
        passed,
        state.difficulty,
        params,
      );
      const rng = createRng(state.seed);
      const targets = generateTargetCells({
        rng,
        roundIndex: nextIndex,
        gridSize: params.gridSize,
        targetCount,
        prevTargets: state.targets,
      });
      return {
        ...state,
        phase: "study",
        roundIndex: nextIndex,
        targetCount,
        targets,
        selections: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundWrongTaps: 0,
        roundOutcome: null,
        prevTargets: state.targets,
      };
    }

    case "pause": {
      if (
        state.paused ||
        state.phase === "results" ||
        state.phase === "intro"
      ) {
        return state;
      }
      return { ...state, paused: true };
    }

    case "resume": {
      return state.paused ? { ...state, paused: false } : state;
    }

    case "tutorial-open": {
      return { ...state, tutorialOpen: true };
    }

    case "tutorial-close": {
      return { ...state, tutorialOpen: false };
    }

    case "session-finalized": {
      return {
        ...state,
        xp: action.xp,
        normalized: action.normalized,
        activeDurationMs: action.activeDurationMs,
        pausedDurationMs: action.pausedDurationMs,
        completedAtMs: action.completedAtMs,
      };
    }

    case "persistence-started": {
      return { ...state, persistState: "started" };
    }

    case "persistence-succeeded": {
      return { ...state, persistState: "succeeded" };
    }

    case "persistence-failed": {
      return { ...state, persistState: "failed", lastError: action.message };
    }

    case "completion-outcome-received": {
      return {
        ...state,
        authoritativeXp: action.xp,
        authoritativeCurrency: action.currency,
        authoritativeDeltas: action.deltas,
      };
    }

    case "qa/force-win": {
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      ) {
        return state;
      }
      const params = gridRecallParamsFromProfile(state.profile);
      const rounds = params.rounds;
      const maxRef = referenceMaxTargets(params);
      let totalTargets = 0;
      for (let round = 0; round < rounds; round += 1) {
        totalTargets += Math.min(
          params.initialTargetCount + round,
          params.gridSize,
        );
      }
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        roundScored: true,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          bestRecall: maxRef,
          totalTargets,
          correctTargets: totalTargets,
          wrongTaps: 0,
        },
      };
    }

    case "qa/force-lose": {
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      ) {
        return state;
      }
      // The in-flight round (study/input) counts as failed; a round already
      // scored in `roundResult` stays as-is.
      const currentRoundCounted = state.phase === "roundResult" ? 0 : 1;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case "qa/force-state": {
      if (state.phase !== "intro") {
        return state;
      }
      const patch = action.patch;
      const difficulty =
        patch.difficulty !== undefined && isDifficultyLevel(patch.difficulty)
          ? patch.difficulty
          : state.difficulty;
      const seedOverride =
        patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default: {
      return state;
    }
  }
}
