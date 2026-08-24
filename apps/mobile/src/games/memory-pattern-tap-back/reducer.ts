/**
 * Pure game state machine for the Pattern Tap Back game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: observe pacing
 * timers, recall auto-highlight, the SDK `SessionLifecycle`, tutorial state,
 * and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  adaptiveGridSize,
  nextSequenceLength,
  paramsFromProfile,
  resolvePatternTapBackDifficulty,
} from './difficulty';
import { generateRoundSequence } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialState } from './types';
import type { PatternTapBackAction, PatternTapBackState, PatternTapBackStats } from './types';

export { createInitialState };

export function gameReducer(
  state: PatternTapBackState,
  action: PatternTapBackAction,
): PatternTapBackState {
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
      const profile = resolvePatternTapBackDifficulty(state.difficulty);
      const params = paramsFromProfile(profile);
      const rng = createRng(action.seed);
      const gridSize = adaptiveGridSize(0, params);
      const sequence = generateRoundSequence({
        rng,
        roundIndex: 0,
        length: params.initialSequenceLength,
        gridSize,
        prevSequence: null,
      });
      return {
        ...state,
        phase: 'observe',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        length: params.initialSequenceLength,
        sequence,
        observeIndex: 0,
        inputIndex: 0,
        recallHighlight: false,
        taps: [],
        roundOutcome: null,
        completedRoundLengths: [],
        prevSequence: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'observe-tick': {
      if (state.phase !== 'observe' || state.paused) {
        return state;
      }
      const next = state.observeIndex + 1;
      if (next >= state.length) {
        return { ...state, phase: 'recall', observeIndex: -1 };
      }
      return { ...state, observeIndex: next };
    }

    case 'tap-tile': {
      if (state.phase !== 'recall' || state.paused || state.profile === null || state.recallHighlight) {
        return state;
      }
      const expected = state.sequence[state.inputIndex];
      const correct = action.index === expected;
      const totalTaps = state.stats.totalTaps + 1;

      if (correct) {
        const inputIndex = state.inputIndex + 1;
        if (inputIndex < state.length) {
          return {
            ...state,
            taps: [...state.taps, action.index],
            inputIndex,
            recallHighlight: true,
            stats: {
              ...state.stats,
              totalTaps,
              correctTaps: state.stats.correctTaps + 1,
            },
          };
        }
        // Round completed successfully.
        const streak = state.stats.streak + 1;
        const score = state.stats.score + roundScore(state.length);
        const stats: PatternTapBackStats = {
          score,
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          longestSequence: Math.max(state.stats.longestSequence, state.length),
          totalTaps,
          correctTaps: state.stats.correctTaps + 1,
        };
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'passed',
          taps: [...state.taps, action.index],
          inputIndex,
          recallHighlight: false,
          stats,
          completedRoundLengths: [...state.completedRoundLengths, state.length],
        };
      }

      // Wrong tile: the round fails immediately.
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'failed',
        taps: [...state.taps, action.index],
        inputIndex: state.inputIndex + 1,
        recallHighlight: false,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalTaps,
        },
      };
    }

    case 'recall-tick': {
      if (state.phase !== 'recall' || state.paused || !state.recallHighlight) {
        return state;
      }
      return { ...state, recallHighlight: false };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = paramsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'passed';
      const length = nextSequenceLength(state.length, passed, state.difficulty, params);
      const rng = createRng(state.seed);
      const gridSize = adaptiveGridSize(nextIndex, params);
      const sequence = generateRoundSequence({
        rng,
        roundIndex: nextIndex,
        length,
        gridSize,
        prevSequence: state.sequence,
      });
      return {
        ...state,
        phase: 'observe',
        roundIndex: nextIndex,
        length,
        sequence,
        observeIndex: 0,
        inputIndex: 0,
        recallHighlight: false,
        taps: [],
        roundOutcome: null,
        prevSequence: state.sequence,
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

    case 'completion-outcome-received': {
      return {
        ...state,
        authoritativeXp: action.xp,
        authoritativeCurrency: action.currency,
        authoritativeDeltas: action.deltas,
      };
    }

    case 'qa/force-win': {
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = paramsFromProfile(state.profile);
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
          longestSequence: Math.max(state.stats.longestSequence, params.maxSequenceLength),
        },
        completedRoundLengths: Array.from({ length: rounds }, (_, i) =>
          Math.min(params.initialSequenceLength + i, params.maxSequenceLength),
        ),
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
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
