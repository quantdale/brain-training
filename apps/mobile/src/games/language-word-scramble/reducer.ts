/**
 * Pure game state machine for the Word Scramble game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()`.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  adaptiveRoundParams,
  wordScrambleParamsFromProfile,
  resolveWordScrambleDifficulty,
} from './difficulty';
import { generateRound } from './generator';
import { roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialWordScrambleState } from './types';
import type {
  WordScrambleAction,
  WordScrambleGameState,
  WordScrambleStats,
} from './types';

export { createInitialWordScrambleState };

export function wordScrambleGameReducer(
  state: WordScrambleGameState,
  action: WordScrambleAction,
): WordScrambleGameState {
  switch (action.type) {
    case 'select-difficulty': {
      if (state.phase !== 'intro') {
        return state;
      }
      return { ...state, difficulty: action.level };
    }

    case 'start-session': {
      if (state.difficulty === null) {
        return state;
      }
      const profile = resolveWordScrambleDifficulty(state.difficulty);
      const params = wordScrambleParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const round = generateRound({
        rng,
        roundIndex: 0,
        optionsCount: params.optionsCount,
        minWordLength: params.minWordLength,
        maxWordLength: params.maxWordLength,
        prevAnswer: null,
      });
      return {
        ...state,
        phase: 'play',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        currentRound: round,
        selectedIndex: -1,
        submitted: false,
        roundOutcome: null,
        prevAnswer: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'select-option': {
      if (state.phase !== 'play' || state.paused || state.submitted) {
        return state;
      }
      return { ...state, selectedIndex: action.index };
    }

    case 'submit-answer': {
      if (state.phase !== 'play' || state.paused || state.profile === null) {
        return state;
      }
      if (state.selectedIndex < 0 || state.currentRound === null) {
        return state;
      }
      const correct = state.selectedIndex === state.currentRound.correctIndex;
      const totalTaps = state.stats.totalTaps + 1;

      if (correct) {
        const wordLength = state.currentRound.wordLength;
        const streak = state.stats.streak + 1;
        const stats: WordScrambleStats = {
          score: state.stats.score + roundScore(wordLength),
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          longestWord: Math.max(state.stats.longestWord, wordLength),
          totalTaps,
          correctTaps: state.stats.correctTaps + 1,
        };
        return {
          ...state,
          phase: 'roundResult',
          submitted: true,
          roundOutcome: 'passed',
          stats,
        };
      }

      // Wrong answer: the round fails immediately.
      return {
        ...state,
        phase: 'roundResult',
        submitted: true,
        roundOutcome: 'failed',
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalTaps,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = wordScrambleParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;

      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes.
        return { ...state, phase: 'results', roundOutcome: null };
      }

      const passed = state.roundOutcome === 'passed';
      const adaptive = adaptiveRoundParams(state.difficulty, params, passed);
      const rng = createRng(state.seed);
      const round = generateRound({
        rng,
        roundIndex: nextIndex,
        optionsCount: adaptive.optionsCount,
        minWordLength: adaptive.minWordLength,
        maxWordLength: adaptive.maxWordLength,
        prevAnswer: state.currentRound?.answer ?? null,
      });

      return {
        ...state,
        phase: 'play',
        roundIndex: nextIndex,
        currentRound: round,
        selectedIndex: -1,
        submitted: false,
        roundOutcome: null,
        prevAnswer: state.currentRound?.answer ?? null,
        // Update params in profile for adaptive escalation.
        ...(state.difficulty === 'adaptive'
          ? {
              profile: {
                ...state.profile,
                parameters: {
                  ...state.profile.parameters,
                  optionsCount: adaptive.optionsCount,
                  minWordLength: adaptive.minWordLength,
                  maxWordLength: adaptive.maxWordLength,
                },
              },
            }
          : {}),
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'results' || state.phase === 'intro') {
        return state;
      }
      return { ...state, paused: true };
    }

    case 'resume': {
      return state.paused ? { ...state, paused: false } : state;
    }

    case 'tutorial-open': {
      return { ...state, tutorialOpen: true };
    }

    case 'tutorial-close': {
      return { ...state, tutorialOpen: false };
    }

    case 'session-finalized': {
      return {
        ...state,
        xp: action.xp,
        normalized: action.normalized,
        activeDurationMs: action.activeDurationMs,
        pausedDurationMs: action.pausedDurationMs,
        completedAtMs: action.completedAtMs,
      };
    }

    case 'persistence-started': {
      return { ...state, persistState: 'started' };
    }

    case 'persistence-succeeded': {
      return { ...state, persistState: 'succeeded' };
    }

    case 'persistence-failed': {
      return { ...state, persistState: 'failed', lastError: action.message };
    }

    case 'qa/force-win': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = wordScrambleParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          longestWord: Math.max(state.stats.longestWord, params.maxWordLength),
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
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

    case 'qa/force-state': {
      if (state.phase !== 'intro') {
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

/** Helper: compute the perfect session score from params. */
function perfectSessionScore(params: { rounds: number; maxWordLength: number }): number {
  let total = 0;
  for (let i = 0; i < params.rounds; i += 1) {
    total += roundScore(params.maxWordLength);
  }
  return total;
}
