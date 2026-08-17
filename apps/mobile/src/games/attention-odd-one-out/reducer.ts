/**
 * Pure game state machine for the Odd One Out game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the countdown
 * interval (which reads the monotonic clock and dispatches `tick` /
 * `round-timeout`), the SDK `SessionLifecycle`, tutorial state, and
 * persistence.
 *
 * Timing model: the reducer stores monotonic `deadlineMs` (derived from the
 * action's `nowMs` + the round window) and `remainingMs`. Pausing freezes
 * `remainingMs`; resuming rebuilds `deadlineMs = nowMs + remainingMs`, so the
 * window can never be stretched by pausing.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  effectiveParamsForStep,
  escalateStep,
  oddOneOutParamsFromProfile,
  resolveOddOneOutDifficulty,
} from './difficulty';
import { generateBoard } from './generator';
import { WRONG_TAP_PENALTY, perfectSessionScore, roundPoints } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialOddOneOutState } from './types';
import type { OddOneOutAction, OddOneOutGameState, OddOneOutStats } from './types';

export { createInitialOddOneOutState };

/** Open the next round: resolve effective params, generate the board, arm the window. */
function openRound(
  state: OddOneOutGameState,
  roundIndex: number,
  step: number,
  nowMs: number,
  profile: DifficultyProfile,
): OddOneOutGameState {
  const params = oddOneOutParamsFromProfile(profile);
  const effective = effectiveParamsForStep(params, step);
  const rng = createRng(state.seed);
  const board = generateBoard({
    rng,
    roundIndex,
    subtlety: effective.subtlety,
    gridSize: effective.gridSize,
    prevBoard: roundIndex === 0 ? null : state.board,
  });
  return {
    ...state,
    phase: 'playing',
    paused: false,
    roundIndex,
    board,
    prevBoard: roundIndex === 0 ? null : state.board,
    step,
    gridSize: effective.gridSize,
    subtlety: effective.subtlety,
    windowMs: effective.windowMs,
    deadlineMs: nowMs + effective.windowMs,
    roundStartedAtMs: nowMs,
    remainingMs: effective.windowMs,
    roundWrongTaps: 0,
    lastWrongIndex: null,
    roundOutcome: null,
  };
}

export function oddOneOutReducer(
  state: OddOneOutGameState,
  action: OddOneOutAction,
): OddOneOutGameState {
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
      const profile = resolveOddOneOutDifficulty(state.difficulty);
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
          persistState: 'idle',
        },
        0,
        0,
        action.nowMs,
        profile,
      );
    }

    case 'tick': {
      if (state.phase !== 'playing' || state.paused) {
        return state;
      }
      return { ...state, remainingMs: Math.max(0, action.remainingMs) };
    }

    case 'tap-tile': {
      if (state.phase !== 'playing' || state.paused || state.board === null) {
        return state;
      }
      const { board } = state;

      if (action.index !== board.oddIndex) {
        // Wrong tap: penalty now, the round continues until the odd item is
        // found or the window expires.
        return {
          ...state,
          lastWrongIndex: action.index,
          roundWrongTaps: state.roundWrongTaps + 1,
          stats: {
            ...state.stats,
            wrongTaps: state.stats.wrongTaps + 1,
            score: Math.max(0, state.stats.score - WRONG_TAP_PENALTY),
          },
        };
      }

      // Correct tap: the round is solved. Solve ratio is relative to this
      // round's own window, so it stays comparable when windows vary.
      const solveMs = Math.max(0, action.nowMs - state.roundStartedAtMs);
      const solveRatio = Math.min(1, solveMs / state.windowMs);
      const firstTry = state.roundWrongTaps === 0;
      const streak = state.stats.streak + 1;
      const stats: OddOneOutStats = {
        score: state.stats.score + roundPoints(firstTry),
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + 1,
        firstTryCorrect: state.stats.firstTryCorrect + (firstTry ? 1 : 0),
        wrongTaps: state.stats.wrongTaps,
        timeouts: state.stats.timeouts,
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        solveRatioSum: state.stats.solveRatioSum + solveRatio,
      };
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'passed',
        lastWrongIndex: null,
        stats,
      };
    }

    case 'round-timeout': {
      if (state.phase !== 'playing' || state.paused) {
        return state;
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        remainingMs: 0,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          timeouts: state.stats.timeouts + 1,
          streak: 0,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = oddOneOutParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'passed';
      const step = escalateStep(state.step, passed, state.difficulty, params);
      return openRound(state, nextIndex, step, action.nowMs, state.profile);
    }

    case 'pause': {
      if (
        state.paused ||
        (state.phase !== 'playing' && state.phase !== 'roundResult')
      ) {
        return state;
      }
      return { ...state, paused: true, remainingMs: Math.max(0, action.remainingMs) };
    }

    case 'resume': {
      if (!state.paused) {
        return state;
      }
      const next: OddOneOutGameState = { ...state, paused: false };
      if (state.phase === 'playing') {
        // Rebuild the deadline from the frozen remainder so pausing never
        // stretches the window.
        next.deadlineMs = action.nowMs + state.remainingMs;
      }
      return next;
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
      const params = oddOneOutParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          firstTryCorrect: rounds,
          wrongTaps: 0,
          timeouts: 0,
          bestStreak: rounds,
          streak: rounds,
          solveRatioSum: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // An in-flight round (playing) counts as failed; a round already scored
      // in `roundResult` stays as-is.
      const inFlight = state.phase === 'playing' ? 1 : 0;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + inFlight,
          timeouts: state.stats.timeouts + inFlight,
          streak: inFlight === 1 ? 0 : state.stats.streak,
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
