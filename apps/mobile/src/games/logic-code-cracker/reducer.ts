/**
 * Pure game state machine for the Code Cracker game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  codeCrackerParamsFromProfile,
  nextCodeLength,
  resolveCodeCrackerDifficulty,
} from './difficulty';
import { computeFeedback, generateSecretCode } from './generator';
import { roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialCodeCrackerState } from './types';
import type { CodeCrackerAction, CodeCrackerGameState, CodeCrackerStats } from './types';

export { createInitialCodeCrackerState };

export function codeCrackerGameReducer(
  state: CodeCrackerGameState,
  action: CodeCrackerAction,
): CodeCrackerGameState {
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
      const profile = resolveCodeCrackerDifficulty(state.difficulty);
      const params = codeCrackerParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const secretCode = generateSecretCode({
        rng,
        roundIndex: 0,
        codeLength: params.codeLength,
        colorCount: params.colorCount,
        prevSecretCode: null,
      });
      return {
        ...state,
        phase: 'roundReveal',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        secretCode,
        currentGuess: [],
        roundGuesses: [],
        guessesUsed: 0,
        roundSolved: false,
        roundOutcome: null,
        prevSecretCode: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'reveal-code': {
      // Transition from the brief reveal phase to input phase.
      if (state.phase !== 'roundReveal' || state.paused) {
        return state;
      }
      return { ...state, phase: 'input' };
    }

    case 'select-color': {
      if (state.phase !== 'input' || state.paused || state.profile === null) {
        return state;
      }
      const params = codeCrackerParamsFromProfile(state.profile);
      // Can't add more colors than the code length.
      if (state.currentGuess.length >= params.codeLength) {
        return state;
      }
      return {
        ...state,
        currentGuess: [...state.currentGuess, action.colorIndex],
      };
    }

    case 'clear-current-guess': {
      if (state.phase !== 'input' || state.paused) {
        return state;
      }
      return { ...state, currentGuess: [] };
    }

    case 'submit-guess': {
      if (state.phase !== 'input' || state.paused || state.profile === null) {
        return state;
      }
      const params = codeCrackerParamsFromProfile(state.profile);
      // Must have a complete guess.
      if (state.currentGuess.length !== params.codeLength) {
        return state;
      }
      // Can't exceed the guess budget.
      if (state.guessesUsed >= params.guessBudget) {
        return state;
      }

      const feedback = computeFeedback(state.secretCode, state.currentGuess);
      const entry = { guess: [...state.currentGuess], feedback };
      const guessesUsed = state.guessesUsed + 1;
      const roundSolved = feedback.exact === params.codeLength;

      if (roundSolved) {
        // Round solved! Score it and move to roundResult.
        const score = state.stats.score + roundScore(params.guessBudget, guessesUsed);
        const streak = state.stats.streak + 1;
        const stats: CodeCrackerStats = {
          score,
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsSolved: state.stats.roundsSolved + 1,
          totalGuessesUsed: state.stats.totalGuessesUsed + guessesUsed,
          totalGuessesBudget: state.stats.totalGuessesBudget + params.guessBudget,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          bestSolveGuesses: Math.min(state.stats.bestSolveGuesses, guessesUsed),
        };
        return {
          ...state,
          phase: 'roundResult',
          roundGuesses: [...state.roundGuesses, entry],
          guessesUsed,
          roundSolved: true,
          roundOutcome: 'solved',
          currentGuess: [],
          stats,
        };
      }

      // Check if budget is exhausted.
      if (guessesUsed >= params.guessBudget) {
        const stats: CodeCrackerStats = {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalGuessesUsed: state.stats.totalGuessesUsed + guessesUsed,
          totalGuessesBudget: state.stats.totalGuessesBudget + params.guessBudget,
        };
        return {
          ...state,
          phase: 'roundResult',
          roundGuesses: [...state.roundGuesses, entry],
          guessesUsed,
          roundSolved: false,
          roundOutcome: 'budget-exhausted',
          currentGuess: [],
          stats,
        };
      }

      // Normal guess: stay in input, clear current guess.
      return {
        ...state,
        roundGuesses: [...state.roundGuesses, entry],
        guessesUsed,
        currentGuess: [],
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = codeCrackerParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const solved = state.roundOutcome === 'solved';
      const codeLength = nextCodeLength(
        state.secretCode.length,
        solved,
        state.difficulty,
        params,
      );
      const rng = createRng(state.seed);
      const secretCode = generateSecretCode({
        rng,
        roundIndex: nextIndex,
        codeLength,
        colorCount: params.colorCount,
        prevSecretCode: state.secretCode,
      });
      return {
        ...state,
        phase: 'roundReveal',
        roundIndex: nextIndex,
        secretCode,
        currentGuess: [],
        roundGuesses: [],
        guessesUsed: 0,
        roundSolved: false,
        roundOutcome: null,
        prevSecretCode: state.secretCode,
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
      const params = codeCrackerParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          score: rounds * (100 + (params.guessBudget - 1) * 10),
          roundsPlayed: rounds,
          roundsSolved: rounds,
          totalGuessesUsed: rounds,
          totalGuessesBudget: rounds * params.guessBudget,
          bestStreak: rounds,
          streak: rounds,
          bestSolveGuesses: 1,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      const params = codeCrackerParamsFromProfile(state.profile);
      const guessesThisRound = state.guessesUsed;
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
          totalGuessesUsed: state.stats.totalGuessesUsed + (currentRoundCounted === 1 ? guessesThisRound : 0),
          totalGuessesBudget: state.stats.totalGuessesBudget + (currentRoundCounted === 1 ? params.guessBudget : 0),
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
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
