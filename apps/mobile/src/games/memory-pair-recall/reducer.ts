/**
 * Pure game state machine for the Pair Recall game.
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
  nextPairCount,
  pairRecallParamsFromProfile,
  resolvePairRecallDifficulty,
} from "./difficulty";
import { generateRound } from "./generator";
import {
  WRONG_TAP_PENALTY,
  perfectSessionScore,
  referenceMaxPairs,
  roundScore,
} from "./scoring";
import {
  INITIAL_STATS,
  createInitialPairRecallState,
} from "./types";
import type {
  PairRecallAction,
  PairRecallGameState,
  PairRecallStats,
} from "./types";

export { createInitialPairRecallState };

/** Open a round: resolve params, generate content, enter the study phase. */
function openRound(
  state: PairRecallGameState,
  roundIndex: number,
  pairCount: number,
): PairRecallGameState {
  const rng = createRng(state.seed);
  const round = generateRound({
    rng,
    roundIndex,
    pairCount,
    prevRound: roundIndex === 0 ? null : state.round,
  });
  return {
    ...state,
    phase: "study",
    paused: false,
    roundIndex,
    pairCount,
    round,
    prevRound: roundIndex === 0 ? null : state.round,
    cueIndex: 0,
    correctCues: 0,
    wrongCues: 0,
    lastCue: null,
    roundScored: false,
    roundOutcome: null,
  };
}

export function pairRecallGameReducer(
  state: PairRecallGameState,
  action: PairRecallAction,
): PairRecallGameState {
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
      const profile = resolvePairRecallDifficulty(state.difficulty);
      const params = pairRecallParamsFromProfile(profile);
      // openRound sees roundIndex 0 → no carry-over from any previous session.
      return openRound(
        {
          ...state,
          profile,
          seed: action.seed,
          sessionId: action.sessionId,
          startedAtMs: action.startedAtMs,
          completedAtMs: null,
          activeDurationMs: 0,
          pausedDurationMs: 0,
          stats: { ...INITIAL_STATS },
          forced: false,
          xp: 0,
          normalized: null,
          persistState: "idle",
        },
        0,
        params.initialPairCount,
      );
    }

    case "study-tick": {
      // The study timer expired: hide the pairs and move to cued recall.
      if (state.phase !== "study" || state.paused) {
        return state;
      }
      return {
        ...state,
        phase: "recall",
        cueIndex: 0,
        correctCues: 0,
        wrongCues: 0,
        lastCue: null,
      };
    }

    case "respond": {
      if (
        state.phase !== "recall" ||
        state.paused ||
        state.roundScored ||
        state.round === null
      ) {
        return state;
      }
      const { round } = state;
      const pairIndex = round.cueOrder[state.cueIndex];
      const pair = round.pairs[pairIndex];
      const correct = action.responseId === pair.responseId;
      const lastCue = {
        pairIndex,
        responseId: action.responseId,
        correct,
      };

      const correctCues = state.correctCues + (correct ? 1 : 0);
      const wrongCues = state.wrongCues + (correct ? 0 : 1);
      const isFinalCue = state.cueIndex + 1 >= round.cueOrder.length;

      if (!isFinalCue) {
        return {
          ...state,
          cueIndex: state.cueIndex + 1,
          correctCues,
          wrongCues,
          lastCue,
        };
      }

      // Final cue: score the round (partial credit + wrong-pick penalty).
      const params = pairRecallParamsFromProfile(state.profile!);
      const perfect = roundScore(state.pairCount, params.initialPairCount);
      const fraction = state.pairCount > 0 ? correctCues / state.pairCount : 0;
      const roundPoints = Math.max(
        0,
        Math.round(perfect * fraction) - WRONG_TAP_PENALTY * wrongCues,
      );
      const passed = correctCues === state.pairCount && wrongCues === 0;
      const streak = passed ? state.stats.streak + 1 : 0;
      const stats: PairRecallStats = {
        score: state.stats.score + roundPoints,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (passed ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        bestRecall: Math.max(state.stats.bestRecall, correctCues),
        totalPairs: state.stats.totalPairs + state.pairCount,
        correctPairs: state.stats.correctPairs + correctCues,
        wrongTaps: state.stats.wrongTaps + wrongCues,
      };
      return {
        ...state,
        phase: "roundResult",
        correctCues,
        wrongCues,
        lastCue,
        roundScored: true,
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
      const params = pairRecallParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }
      const passed = state.roundOutcome === "passed";
      const pairCount = nextPairCount(
        state.pairCount,
        passed,
        state.difficulty,
        params,
      );
      return openRound(state, nextIndex, pairCount);
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
      const params = pairRecallParamsFromProfile(state.profile);
      const rounds = params.rounds;
      const maxRef = referenceMaxPairs(params);
      let totalPairs = 0;
      for (let round = 0; round < rounds; round += 1) {
        totalPairs += Math.min(
          params.initialPairCount + round,
          params.maxPairCount,
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
          totalPairs,
          correctPairs: totalPairs,
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
      // The in-flight round (study/recall) counts as failed; a round already
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
