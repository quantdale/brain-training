/**
 * Pure game state machine for the Task Switch (flexibility) game.
 *
 * Core loop (the cue-driven task-switching state machine):
 *
 *   trialActive → trialResult → trialActive → … → results
 *
 * Unlike Cue Shift (which publishes a NEW rule every trial) the cued task is
 * one of a small pool and the SWITCH is defined as the task differing from the
 * previous trial's task. The reducer advances through the pre-built `plan`
 * (built by `generateSession`), which encodes, for each trial, whether it is a
 * SWITCH trial (task differs from the previous trial's task) or a REPEAT trial.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: response-time
 * measurement, the SDK `SessionLifecycle`, tutorial state, the cue/answer
 * timing, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { isDifficultyLevel } from "@/sdk";

import {
  flexibilityTaskSwitchParamsFromProfile,
  resolveFlexibilityTaskSwitchDifficulty,
} from "./difficulty";
import { generateSession } from "./generator";
import { perfectSessionScore, roundScore } from "./scoring";
import {
  INITIAL_STATS,
  createInitialFlexibilityTaskSwitchState,
} from "./types";
import type {
  FlexibilityTaskSwitchAction,
  FlexibilityTaskSwitchGameState,
  FlexibilityTaskSwitchStats,
  GeneratedRound,
} from "./types";

export { createInitialFlexibilityTaskSwitchState };

export function flexibilityTaskSwitchReducer(
  state: FlexibilityTaskSwitchGameState,
  action: FlexibilityTaskSwitchAction,
): FlexibilityTaskSwitchGameState {
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
      const profile = resolveFlexibilityTaskSwitchDifficulty(state.difficulty);
      const params = flexibilityTaskSwitchParamsFromProfile(profile);
      // The entire deterministic plan is built up front so the reducer can
      // index into it and QA force paths can count switches accurately.
      const plan = generateSession(action.seed, params);
      const first = plan[0];
      return {
        ...state,
        phase: "trialActive",
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        rounds: params.rounds,
        plan,
        round: first,
        roundOutcome: null,
        lastResponseMs: 0,
        lastPickIndex: -1,
        prevTask: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "answer": {
      if (
        state.phase !== "trialActive" ||
        state.paused ||
        state.round === null ||
        state.profile === null
      ) {
        return state;
      }
      const correct = action.index === state.round.correctIndex;
      const params = flexibilityTaskSwitchParamsFromProfile(state.profile);
      const isSwitch = state.round.isSwitch;
      const isRepeat = !isSwitch;
      const responseMs = action.responseMs;
      const stats: FlexibilityTaskSwitchStats = {
        score:
          state.stats.score +
          roundScore(correct, responseMs, params.speedTargetMs),
        roundsPlayed: state.stats.roundsPlayed + 1,
        correctPicks: state.stats.correctPicks + (correct ? 1 : 0),
        mistakes: state.stats.mistakes + (correct ? 0 : 1),
        bestStreak: Math.max(
          state.stats.bestStreak,
          correct ? state.stats.streak + 1 : 0,
        ),
        streak: correct ? state.stats.streak + 1 : 0,
        totalResponseMs: state.stats.totalResponseMs + responseMs,
        scoredPicks: state.stats.scoredPicks + 1,
        switchPlayed: state.stats.switchPlayed + (isSwitch ? 1 : 0),
        switchCorrect:
          state.stats.switchCorrect + (isSwitch && correct ? 1 : 0),
        repeatPlayed: state.stats.repeatPlayed + (isRepeat ? 1 : 0),
        repeatCorrect:
          state.stats.repeatCorrect + (isRepeat && correct ? 1 : 0),
        switchRtSum: state.stats.switchRtSum + (isSwitch ? responseMs : 0),
        switchRtCount: state.stats.switchRtCount + (isSwitch ? 1 : 0),
        repeatRtSum: state.stats.repeatRtSum + (isRepeat ? responseMs : 0),
        repeatRtCount: state.stats.repeatRtCount + (isRepeat ? 1 : 0),
      };
      return {
        ...state,
        phase: "trialResult",
        roundOutcome: correct ? "correct" : "wrong",
        lastResponseMs: responseMs,
        lastPickIndex: action.index,
        stats,
      };
    }

    case "next-round": {
      if (
        state.phase !== "trialResult" ||
        state.profile === null ||
        state.difficulty === null ||
        state.round === null
      ) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: "results", roundOutcome: null, round: null };
      }
      const nextRound: GeneratedRound = state.plan[nextIndex];
      return {
        ...state,
        phase: "trialActive",
        roundIndex: nextIndex,
        round: nextRound,
        roundOutcome: null,
        lastPickIndex: -1,
        prevTask: state.round.task,
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
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (
        state.phase === "results" ||
        state.phase === "intro" ||
        state.profile === null
      ) {
        return state;
      }
      // Perfect run: every trial correct and instant; switch trials also earn
      // the switch-correct share (exactly what the plan encodes).
      const plan = state.plan;
      const switchPlayed = plan.filter((r) => r.isSwitch).length;
      const switchCorrect = switchPlayed;
      const repeatPlayed = plan.length - switchPlayed;
      const repeatCorrect = repeatPlayed;
      const params = flexibilityTaskSwitchParamsFromProfile(state.profile);
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        round: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: plan.length,
          correctPicks: plan.length,
          mistakes: 0,
          bestStreak: plan.length,
          streak: plan.length,
          totalResponseMs: 0,
          scoredPicks: plan.length,
          switchPlayed,
          switchCorrect,
          repeatPlayed,
          repeatCorrect,
          switchRtSum: 0,
          switchRtCount: switchPlayed,
          repeatRtSum: 0,
          repeatRtCount: repeatPlayed,
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
      // An in-flight pickable round (trialActive) counts as wrong with no
      // recorded response time; a round already scored in `trialResult` stays
      // as-is.
      const countsRound = state.phase === "trialActive" ? 1 : 0;
      const isSwitch =
        countsRound === 1 && state.round !== null
          ? state.round.isSwitch
          : false;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        round: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + countsRound,
          mistakes: state.stats.mistakes + countsRound,
          streak: countsRound === 1 ? 0 : state.stats.streak,
          scoredPicks: state.stats.scoredPicks + countsRound,
          switchPlayed: state.stats.switchPlayed + (isSwitch ? 1 : 0),
          switchCorrect: state.stats.switchCorrect,
          repeatPlayed: state.stats.repeatPlayed + (isSwitch ? 0 : 1),
          repeatCorrect: state.stats.repeatCorrect,
          switchRtSum: state.stats.switchRtSum,
          switchRtCount: state.stats.switchRtCount,
          repeatRtSum: state.stats.repeatRtSum,
          repeatRtCount: state.stats.repeatRtCount,
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
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
