/**
 * Pure game state machine for the Sentence Builder game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, auto-pause on backgrounding, tutorial state, and
 * persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()`.
 */
import { createRng, isDifficultyLevel } from "@/sdk";
import type { DifficultyProfile } from "@/sdk";

import { generateRound } from "./generator";
import { SENTENCE_BANK } from "./content/sentence-bank";
import {
  paramsFromProfile,
  resolveSentenceBuilderDifficulty,
} from "./difficulty";
import { computeRoundScore } from "./scoring";
import { GAME_ID, INITIAL_STATS, createInitialState } from "./types";
import type {
  SentenceBuilderAction,
  SentenceBuilderDifficultyParams,
  SentenceBuilderState,
  SentenceBuilderStats,
} from "./types";

export { createInitialState };

/**
 * Advance a stat object by a completed round.
 */
function advanceStats(
  prev: SentenceBuilderStats,
  points: number,
  passed: boolean,
  wordCount: number,
  positionAccuracy: number,
): SentenceBuilderStats {
  const streak = passed ? prev.streak + 1 : 0;
  return {
    score: prev.score + points,
    roundsPlayed: prev.roundsPlayed + 1,
    roundsPassed: prev.roundsPassed + (passed ? 1 : 0),
    bestStreak: Math.max(prev.bestStreak, streak),
    streak,
    longestSentence: Math.max(prev.longestSentence, wordCount),
    totalTaps: prev.totalTaps + wordCount,
    correctTaps: prev.correctTaps + Math.round(positionAccuracy * wordCount),
    accuracySum: prev.accuracySum + positionAccuracy,
  };
}

export function sentenceBuilderReducer(
  state: SentenceBuilderState,
  action: SentenceBuilderAction,
): SentenceBuilderState {
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
      const profile = resolveSentenceBuilderDifficulty(state.difficulty);
      const params = paramsFromProfile(profile);
      const rng = createRng(action.seed);
      const { scrambled, sentence } = generateRound({
        rng,
        roundIndex: 0,
        bank: SENTENCE_BANK,
        minWords: params.minWords,
        maxWords: params.maxWords,
        prevCategory: null,
        usedCategories: [],
      });

      return {
        ...state,
        phase: "puzzle",
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        scrambled,
        taps: [],
        inputIndex: 0,
        roundOutcome: null,
        prevCategory: sentence.category,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: "idle",
      };
    }

    case "tap-word": {
      if (
        state.phase !== "puzzle" ||
        state.paused ||
        state.profile === null ||
        state.scrambled === null
      ) {
        return state;
      }
      const { scrambled } = state;
      const expectedIndex = state.inputIndex;

      // Check if the tapped scrambled index matches the expected original word.
      const tappedScrambledIndex = action.index;
      const expectedOriginalWord = scrambled.original[expectedIndex];
      const tappedWord = scrambled.scrambled[tappedScrambledIndex];
      const correct = tappedWord === expectedOriginalWord;

      const newTaps = [...state.taps, tappedScrambledIndex];
      const nextInputIndex = state.inputIndex + 1;

      if (correct && nextInputIndex < scrambled.original.length) {
        // Correct tap, still more words to place.
        return {
          ...state,
          taps: newTaps,
          inputIndex: nextInputIndex,
          stats: {
            ...state.stats,
            totalTaps: state.stats.totalTaps + 1,
            correctTaps: state.stats.correctTaps + 1,
          },
        };
      }

      // Round complete (either all correct or wrong).
      const playerOrder = newTaps.map((i) => scrambled.scrambled[i]);
      const { points, passed } = computeRoundScore(
        scrambled.original,
        playerOrder,
      );
      const accuracy =
        playerOrder.length > 0
          ? playerOrder.filter((w, i) => w === scrambled.original[i]).length /
            scrambled.original.length
          : 0;
      const wordCount = scrambled.original.length;
      const stats = advanceStats(
        state.stats,
        points,
        passed,
        wordCount,
        accuracy,
      );

      return {
        ...state,
        phase: "roundResult",
        roundOutcome: passed ? "passed" : "failed",
        taps: newTaps,
        inputIndex: nextInputIndex,
        stats,
      };
    }

    case "timer-expired": {
      if (state.phase !== "puzzle" || state.scrambled === null) {
        return state;
      }
      // Timer expired: round fails.
      const wordCount = state.scrambled.original.length;
      const stats = advanceStats(state.stats, 0, false, wordCount, 0);
      return {
        ...state,
        phase: "roundResult",
        roundOutcome: "failed",
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
      const params = paramsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;

      if (nextIndex >= params.rounds) {
        return { ...state, phase: "results", roundOutcome: null };
      }

      const rng = createRng(state.seed);
      const usedCategories =
        state.prevCategory !== null ? [state.prevCategory] : [];

      const { scrambled: newScrambled, sentence: newSentence } = generateRound({
        rng,
        roundIndex: nextIndex,
        bank: SENTENCE_BANK,
        minWords: params.minWords,
        maxWords: params.maxWords,
        prevCategory: state.prevCategory,
        usedCategories,
      });

      return {
        ...state,
        phase: "puzzle",
        roundIndex: nextIndex,
        scrambled: newScrambled,
        taps: [],
        inputIndex: 0,
        roundOutcome: null,
        prevCategory: newSentence.category,
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
      const params = paramsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: "results",
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScoreFromParams(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
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

/** Helper: perfect session score from params. */
function perfectSessionScoreFromParams(
  params: SentenceBuilderDifficultyParams,
): number {
  let total = 0;
  for (let i = 0; i < params.rounds; i += 1) {
    const avgWords = Math.round((params.minWords + params.maxWords) / 2);
    total += 100 + 10 * avgWords;
  }
  return total;
}
