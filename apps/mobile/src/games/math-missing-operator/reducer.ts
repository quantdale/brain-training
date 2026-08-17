/**
 * Pure game state machine for the Math Missing Operator game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-round
 * budget timer, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Pacing model: `roundStartedAtMs` anchors the current active segment and
 * `roundElapsedMs` accumulates the time of finished segments. The `pause`
 * action banks the elapsed segment and re-anchors `roundStartedAtMs`, and
 * `resume` re-anchors it again — so pausing never inflates response time and
 * the remaining round budget is computed as
 * `budget − roundElapsedMs − (now − roundStartedAtMs)` by the screen.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  adaptiveRatingAfter,
  budgetForRound,
  mathMissingOperatorParamsFromProfile,
  resolveMathMissingOperatorDifficulty,
} from './difficulty';
import { generateEquation } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialMathMissingOperatorState } from './types';
import type { MathMissingOperatorAction, MathMissingOperatorGameState } from './types';

export { createInitialMathMissingOperatorState };

export function mathMissingOperatorGameReducer(
  state: MathMissingOperatorGameState,
  action: MathMissingOperatorAction,
): MathMissingOperatorGameState {
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
      const profile = resolveMathMissingOperatorDifficulty(state.difficulty);
      const params = mathMissingOperatorParamsFromProfile(profile);
      const equation = generateEquation({
        rng: createRng(action.seed),
        roundIndex: 0,
        params,
        level: state.difficulty,
        rating: 0.5,
      });
      return {
        ...state,
        phase: 'answer',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        equation,
        roundStartedAtMs: action.roundStartedAtMs,
        roundElapsedMs: 0,
        roundOutcome: null,
        lastAnsweredOperator: null,
        adaptiveRating: 0.5,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'answer-round': {
      if (state.phase !== 'answer' || state.paused || state.profile === null || state.equation === null) {
        return state;
      }
      const params = mathMissingOperatorParamsFromProfile(state.profile);
      const correct = action.operator === state.equation.answerOperator;
      const responseMs = Math.max(0, action.responseMs);
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats = {
        score: state.stats.score + roundScore(correct, responseMs, budgetForRound(params, state.roundIndex)),
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsCorrect: state.stats.roundsCorrect + (correct ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        // Response time is recorded for every answered round (correct or not).
        totalResponseMs: state.stats.totalResponseMs + responseMs,
        timeouts: state.stats.timeouts,
      };
      const adaptiveRating =
        state.difficulty === 'adaptive'
          ? adaptiveRatingAfter(
              state.adaptiveRating,
              correct ? 'correct' : 'wrong',
              correct && responseMs <= budgetForRound(params, state.roundIndex) / 2,
            )
          : state.adaptiveRating;
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: correct ? 'correct' : 'wrong',
        lastAnsweredOperator: action.operator,
        stats,
        adaptiveRating,
      };
    }

    case 'round-timeout': {
      if (state.phase !== 'answer' || state.paused) {
        return state;
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        lastAnsweredOperator: null,
        adaptiveRating:
          state.difficulty === 'adaptive'
            ? adaptiveRatingAfter(state.adaptiveRating, 'timeout')
            : state.adaptiveRating,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          timeouts: state.stats.timeouts + 1,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = mathMissingOperatorParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const equation = generateEquation({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        params,
        level: state.difficulty,
        rating: state.adaptiveRating,
      });
      return {
        ...state,
        phase: 'answer',
        roundIndex: nextIndex,
        equation,
        roundStartedAtMs: action.roundStartedAtMs,
        roundElapsedMs: 0,
        roundOutcome: null,
        lastAnsweredOperator: null,
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'intro' || state.phase === 'results') {
        return state;
      }
      // Bank the elapsed active time of the current round and re-anchor so a
      // long pause can never eat into the round budget or response time.
      const elapsed = Math.max(0, action.pausedAtMs - state.roundStartedAtMs);
      return {
        ...state,
        paused: true,
        roundElapsedMs: state.roundElapsedMs + elapsed,
        roundStartedAtMs: action.pausedAtMs,
      };
    }

    case 'resume': {
      if (!state.paused) {
        return state;
      }
      return { ...state, paused: false, roundStartedAtMs: action.resumedAtMs };
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
      const params = mathMissingOperatorParamsFromProfile(state.profile);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        adaptiveRating: state.difficulty === 'adaptive' ? 1 : state.adaptiveRating,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: params.rounds,
          roundsCorrect: params.rounds,
          bestStreak: params.rounds,
          streak: params.rounds,
          totalResponseMs: 0,
          timeouts: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (answer) counts as played-and-failed; a round
      // already scored in `roundResult` stays as-is.
      const inFlight = state.phase === 'answer' ? 1 : 0;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        adaptiveRating: state.difficulty === 'adaptive' ? 0 : state.adaptiveRating,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + inFlight,
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
