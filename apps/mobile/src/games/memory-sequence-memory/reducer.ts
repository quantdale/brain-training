/**
 * Pure game state machine for the Sequence Memory game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: reveal pacing
 * timers, the score-attack countdown (`time-up` when the monotonic budget
 * expires), the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Session structure: the score attack keeps generating rounds until
 * `time-up` arrives (or a QA force hook ends the session). A passed round
 * escalates the sequence length; a failed round ends immediately and the
 * next round restarts at the difficulty's base length (classic Simon rule,
 * adaptive levels instead move ±1).
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextSequenceLength,
  resolveSequenceMemoryDifficulty,
  sequenceMemoryParamsFromProfile,
} from './difficulty';
import { generateSequence } from './generator';
import {
  perfectClimbRounds,
  perfectClimbTaps,
  perfectSessionScore,
  sequenceScore,
} from './scoring';
import {
  INITIAL_STATS,
  createInitialSequenceMemoryState,
} from './types';
import type {
  SequenceMemoryAction,
  SequenceMemoryGameState,
  SequenceMemoryStats,
} from './types';

export { createInitialSequenceMemoryState };

export function sequenceMemoryGameReducer(
  state: SequenceMemoryGameState,
  action: SequenceMemoryAction,
): SequenceMemoryGameState {
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
      const profile = resolveSequenceMemoryDifficulty(state.difficulty);
      const params = sequenceMemoryParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const sequence = generateSequence({
        rng,
        sequenceIndex: 0,
        length: params.baseLength,
        tileCount: params.tileCount,
        prevSequence: null,
      });
      return {
        ...state,
        phase: 'reveal',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        length: params.baseLength,
        sequence,
        revealedIndex: 0,
        inputIndex: 0,
        taps: [],
        roundOutcome: null,
        prevSequence: null,
        timeUp: false,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'reveal-tick': {
      if (state.phase !== 'reveal' || state.paused) {
        return state;
      }
      const next = state.revealedIndex + 1;
      if (next >= state.length) {
        return { ...state, phase: 'input', revealedIndex: -1 };
      }
      return { ...state, revealedIndex: next };
    }

    case 'tap-tile': {
      if (state.phase !== 'input' || state.paused || state.profile === null) {
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
            stats: {
              ...state.stats,
              totalTaps,
              correctTaps: state.stats.correctTaps + 1,
            },
          };
        }
        // Round completed successfully.
        const params = sequenceMemoryParamsFromProfile(state.profile);
        const streak = state.stats.streak + 1;
        const stats: SequenceMemoryStats = {
          score: state.stats.score + sequenceScore(state.length, params.baseLength),
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
          stats,
        };
      }

      // Wrong tile: the round fails immediately.
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'failed',
        taps: [...state.taps, action.index],
        inputIndex: state.inputIndex + 1,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalTaps,
        },
      };
    }

    case 'next-round': {
      if (
        state.phase !== 'roundResult' ||
        state.profile === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const params = sequenceMemoryParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      const passed = state.roundOutcome === 'passed';
      const length = nextSequenceLength(state.length, passed, state.difficulty, params);
      const rng = createRng(state.seed);
      const sequence = generateSequence({
        rng,
        sequenceIndex: nextIndex,
        length,
        tileCount: params.tileCount,
        prevSequence: state.sequence,
      });
      return {
        ...state,
        phase: 'reveal',
        roundIndex: nextIndex,
        length,
        sequence,
        revealedIndex: 0,
        inputIndex: 0,
        taps: [],
        roundOutcome: null,
        prevSequence: state.sequence,
      };
    }

    case 'time-up': {
      if (
        state.phase !== 'reveal' &&
        state.phase !== 'input' &&
        state.phase !== 'roundResult'
      ) {
        return state;
      }
      // A round that was still being performed when the budget expired counts
      // as failed; a round already scored in `roundResult` stays as-is.
      const inFlightFailed = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        timeUp: true,
        stats: inFlightFailed
          ? {
              ...state.stats,
              roundsPlayed: state.stats.roundsPlayed + 1,
              streak: 0,
            }
          : state.stats,
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
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (reveal/input) counts as passed; a round already
      // scored in `roundResult` stays as-is.
      const params = sequenceMemoryParamsFromProfile(state.profile);
      const inFlightWon = state.phase === 'roundResult' ? 0 : 1;
      const streak = state.stats.streak + inFlightWon;
      const stats: SequenceMemoryStats = inFlightWon
        ? {
            ...state.stats,
            score: state.stats.score + sequenceScore(state.length, params.baseLength),
            roundsPlayed: state.stats.roundsPlayed + 1,
            roundsPassed: state.stats.roundsPassed + 1,
            bestStreak: Math.max(state.stats.bestStreak, streak),
            streak,
            longestSequence: Math.max(state.stats.longestSequence, state.length),
          }
        : { ...state.stats, streak };
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        timeUp: false,
        forced: true,
        stats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (reveal/input) counts as failed; a round already
      // scored in `roundResult` stays as-is.
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        timeUp: false,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case 'qa/force-perfect': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = sequenceMemoryParamsFromProfile(state.profile);
      const rounds = perfectClimbRounds(params);
      const taps = perfectClimbTaps(params);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        timeUp: false,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          longestSequence: params.maxLength,
          totalTaps: taps,
          correctTaps: taps,
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
