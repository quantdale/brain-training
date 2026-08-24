/**
 * Pure game state machine for the Running Order game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: reveal pacing
 * timer, the SDK `SessionLifecycle` (start/pause/resume/complete/abandon), the
 * tutorial, the dev-only QA panel, and result persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from "@/sdk";

import {
  runningOrderParamsFromProfile,
  nextRecallLength,
  resolveRunningOrderDifficulty,
} from "./difficulty";
import { generateStream, streamTarget } from "./generator";
import {
  perfectSessionScore,
  referenceMaxTargets,
  roundScore,
} from "./scoring";
import {
  INITIAL_STATS,
  createInitialRunningOrderState,
} from "./types";
import type {
  RunningOrderAction,
  RunningOrderGameState,
  RunningOrderStats,
} from "./types";

export { createInitialRunningOrderState };

export function runningOrderGameReducer(
  state: RunningOrderGameState,
  action: RunningOrderAction,
): RunningOrderGameState {
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
      const profile = resolveRunningOrderDifficulty(state.difficulty);
      const params = runningOrderParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const stream = generateStream({
        rng,
        roundIndex: 0,
        streamLen: params.streamLen,
        recallLength: params.initialRecallLength,
        prevTarget: null,
      });
      return {
        ...state,
        phase: "reveal",
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        recallLength: params.initialRecallLength,
        stream,
        revealedIndex: 0,
        answer: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundOutcome: null,
        prevTarget: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "reveal-tick": {
      if (state.phase !== "reveal" || state.paused) {
        return state;
      }
      const next = state.revealedIndex + 1;
      if (next >= state.stream.length) {
        return { ...state, phase: "input", revealedIndex: -1 };
      }
      return { ...state, revealedIndex: next };
    }

    case "tap-symbol": {
      if (state.phase !== "input" || state.paused || state.roundScored) {
        return state;
      }
      if (state.answer.length >= state.recallLength) {
        return state;
      }
      return { ...state, answer: [...state.answer, action.id] };
    }

    case "backspace": {
      if (state.phase !== "input" || state.paused || state.roundScored) {
        return state;
      }
      if (state.answer.length === 0) {
        return state;
      }
      return { ...state, answer: state.answer.slice(0, -1) };
    }

    case "submit": {
      if (state.phase !== "input" || state.paused || state.roundScored) {
        return state;
      }
      if (state.answer.length !== state.recallLength) {
        return state;
      }
      const target = streamTarget(state.stream, state.recallLength);
      let correct = 0;
      for (let i = 0; i < target.length; i += 1) {
        if (state.answer[i] === target[i]) {
          correct += 1;
        }
      }
      const passed = correct === target.length;
      const fraction = target.length > 0 ? correct / target.length : 0;
      const params = runningOrderParamsFromProfile(state.profile!);
      const roundPoints = Math.round(
        roundScore(state.recallLength, params.initialRecallLength) * fraction,
      );
      const streak = passed ? state.stats.streak + 1 : 0;
      const stats: RunningOrderStats = {
        score: state.stats.score + roundPoints,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (passed ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        bestRecall: Math.max(state.stats.bestRecall, correct),
        totalTargets: state.stats.totalTargets + target.length,
        correctTargets: state.stats.correctTargets + correct,
        wrongTaps: 0,
      };
      return {
        ...state,
        phase: "roundResult",
        roundScored: true,
        roundCorrectTargets: correct,
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
      const params = runningOrderParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "passed";
      const recallLength = nextRecallLength(
        state.recallLength,
        passed,
        state.difficulty,
        params,
      );
      const rng = createRng(state.seed);
      const stream = generateStream({
        rng,
        roundIndex: nextIndex,
        streamLen: params.streamLen,
        recallLength,
        prevTarget: streamTarget(state.stream, state.recallLength),
      });
      return {
        ...state,
        phase: "reveal",
        roundIndex: nextIndex,
        recallLength,
        stream,
        revealedIndex: 0,
        answer: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundOutcome: null,
        prevTarget: streamTarget(state.stream, state.recallLength),
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
      const params = runningOrderParamsFromProfile(state.profile);
      const rounds = params.rounds;
      const maxRef = referenceMaxTargets(params);
      let totalTargets = 0;
      for (let round = 0; round < rounds; round += 1) {
        totalTargets += Math.min(
          params.initialRecallLength + round,
          params.streamLen,
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
