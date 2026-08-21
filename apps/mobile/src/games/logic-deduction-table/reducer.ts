/**
 * Pure game state machine for the Deduction Table game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no side
 * effects — so the whole loop (including QA force paths and the per-round
 * deadline math) is unit testable without a UI. The screen owns the side
 * effects: the round-expiry timer, the SDK `SessionLifecycle`, tutorial state,
 * and persistence.
 *
 * Timing model: actions that depend on time carry `nowMs` from the SDK monotonic
 * clock (never `Date.now()`). The reducer stores the round deadline and rebases
 * the answer clock across pauses so answer times never include paused time. QA
 * force actions only reshape state; the screen gates their entry points behind
 * `isDevBuild()` and the hooks call `assertDevOnly()` (see hooks.ts).
 */
import { createRng, isDifficultyLevel } from "@/sdk";
import type { DifficultyProfile } from "@/sdk";

import {
  adaptiveRoundParams,
  logicDeductionParamsFromProfile,
  resolveLogicDeductionDifficulty,
} from "./difficulty";
import { generateRound, validateGeneratedRound } from "./generator";
import { roundScore } from "./scoring";
import {
  GAME_ID,
  INITIAL_STATS,
  createInitialLogicDeductionState,
} from "./types";
import type {
  LogicDeductionAction,
  LogicDeductionRound,
  LogicDeductionState,
  LogicDeductionStats,
  RoundOutcome,
} from "./types";

export { createInitialLogicDeductionState };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function answerRatio(answerMs: number, budgetMs: number): number {
  return budgetMs > 0 ? clamp01(answerMs / budgetMs) : 1;
}

function failedRoundStats(
  stats: LogicDeductionStats,
  answerMs: number,
  ratio: number,
): LogicDeductionStats {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    streak: 0,
    totalAnswerMs: stats.totalAnswerMs + answerMs,
    sumAnswerRatio: stats.sumAnswerRatio + ratio,
  };
}

export function logicDeductionReducer(
  state: LogicDeductionState,
  action: LogicDeductionAction,
): LogicDeductionState {
  switch (action.type) {
    case "select-difficulty": {
      if (state.phase !== "intro") return state;
      return { ...state, difficulty: action.level };
    }

    case "start-session": {
      if (state.difficulty === null) return state;
      const profile = resolveLogicDeductionDifficulty(state.difficulty);
      const params = logicDeductionParamsFromProfile(profile);
      const round = generateRound({
        rng: createRng(action.seed),
        roundIndex: 0,
        params,
        prevRound: null,
      });
      return {
        ...state,
        phase: "question",
        paused: false,
        profile,
        params,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        round,
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + params.roundTimeMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
        roundOutcomes: [],
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "answer-option": {
      if (
        state.phase !== "question" ||
        state.paused ||
        state.round === null ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null ||
        state.params === null
      ) {
        return state;
      }
      if (action.nowMs > state.roundDeadlineMs) {
        return state; // late tap: the screen's timer fires the timeout transition
      }
      const correct = action.index === state.round.correctIndex;
      const answerMs = Math.max(0, action.nowMs - state.roundStartedAtMs);
      const ratio = answerRatio(answerMs, state.params.roundTimeMs);
      const outcome: RoundOutcome = correct ? "correct" : "wrong";
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats: LogicDeductionStats = correct
        ? {
            ...state.stats,
            score:
              state.stats.score +
              roundScore(answerMs, state.params.roundTimeMs),
            roundsPlayed: state.stats.roundsPlayed + 1,
            roundsCorrect: state.stats.roundsCorrect + 1,
            bestStreak: Math.max(state.stats.bestStreak, streak),
            streak,
            totalAnswerMs: state.stats.totalAnswerMs + answerMs,
            sumAnswerRatio: state.stats.sumAnswerRatio + ratio,
          }
        : failedRoundStats(state.stats, answerMs, ratio);
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: outcome,
        lastAnswerIndex: action.index,
        lastAnswerMs: answerMs,
        roundOutcomes: [...state.roundOutcomes, outcome],
        stats,
      };
    }

    case "expire-round": {
      if (
        state.phase !== "question" ||
        state.paused ||
        state.round === null ||
        state.roundDeadlineMs === null ||
        state.params === null
      ) {
        return state;
      }
      if (action.nowMs < state.roundDeadlineMs) {
        return state; // premature: the round is not expired yet
      }
      const budget = state.params.roundTimeMs;
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "timeout",
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, "timeout"],
        stats: failedRoundStats(state.stats, budget, 1),
      };
    }

    case "next-round": {
      if (
        state.phase !== "roundResult" ||
        state.params === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "correct";
      const nextParams = adaptiveRoundParams(
        state.difficulty,
        state.params,
        passed,
      );
      const round = generateRound({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        params: nextParams,
        prevRound: state.round,
      });
      return {
        ...state,
        phase: "question",
        roundIndex: nextIndex,
        params: nextParams,
        round,
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + nextParams.roundTimeMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
      };
    }

    case "pause": {
      if (
        state.paused ||
        state.phase !== "question" ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null
      ) {
        return state;
      }
      return {
        ...state,
        paused: true,
        roundDeadlineMs: null,
        roundRemainingMs: Math.max(0, state.roundDeadlineMs - action.nowMs),
        roundElapsedMs: Math.max(0, action.nowMs - state.roundStartedAtMs),
      };
    }

    case "resume": {
      if (
        state.paused === false ||
        state.roundRemainingMs === null ||
        state.roundElapsedMs === null
      ) {
        return state;
      }
      return {
        ...state,
        paused: false,
        roundDeadlineMs: action.nowMs + state.roundRemainingMs,
        roundStartedAtMs: action.nowMs - state.roundElapsedMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
      };
    }

    case "tutorial-open":
      return { ...state, tutorialOpen: true };
    case "tutorial-close":
      return { ...state, tutorialOpen: false };

    case "session-finalized":
      return {
        ...state,
        xp: action.xp,
        normalized: action.normalized,
        activeDurationMs: action.activeDurationMs,
        pausedDurationMs: action.pausedDurationMs,
        completedAtMs: action.completedAtMs,
      };

    case "persistence-started":
      return { ...state, persistState: "started" };
    case "persistence-succeeded":
      return { ...state, persistState: "succeeded" };
    case "persistence-failed":
      return { ...state, persistState: "failed", lastError: action.message };
    case "completion-outcome-received":
      return {
        ...state,
        authoritativeXp: action.xp,
        authoritativeCurrency: action.currency,
        authoritativeDeltas: action.deltas,
      };

    case "qa/force-win": {
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.params === null
      )
        return state;
      const rounds = state.params.rounds;
      const perfect: LogicDeductionStats = {
        score: 150 * rounds,
        roundsPlayed: rounds,
        roundsCorrect: rounds,
        bestStreak: rounds,
        streak: rounds,
        totalAnswerMs: 0,
        sumAnswerRatio: 0,
      };
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes: Array.from({ length: rounds }, () => "correct" as const),
        stats: perfect,
      };
    }

    case "qa/force-lose": {
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      )
        return state;
      const currentRoundCounted = state.phase === "roundResult" ? 0 : 1;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes:
          currentRoundCounted === 1
            ? [...state.roundOutcomes, "wrong" as const]
            : state.roundOutcomes,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case "qa/force-timeout": {
      if (
        state.phase !== "question" ||
        state.paused ||
        state.round === null ||
        state.params === null
      )
        return state;
      const budget = state.params.roundTimeMs;
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "timeout",
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, "timeout"],
        stats: failedRoundStats(state.stats, budget, 1),
      };
    }

    case "qa/force-state": {
      if (state.phase !== "intro") return state;
      const patch = action.patch;
      const difficulty =
        patch.difficulty !== undefined && isDifficultyLevel(patch.difficulty)
          ? patch.difficulty
          : state.difficulty;
      const seedOverride =
        patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default:
      return state;
  }
}

/** Re-export the round type for convenience in tests/screens. */
export type { LogicDeductionRound };
