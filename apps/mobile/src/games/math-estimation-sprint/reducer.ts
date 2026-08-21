/**
 * Pure game state machine for the Fast Math game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-problem
 * ticker feeding `problem-tick` with active-only elapsed ms, the SDK
 * `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing model: the reducer never reads a clock. `problem-tick` and
 * `submit-answer` carry `atActiveMs` — the SessionLifecycle's active-only
 * elapsed ms (paused segments are excluded by the lifecycle) — and the
 * reducer derives `problemElapsedMs = atActiveMs − problemStartActiveMs`.
 * Pausing therefore freezes the budget exactly; a player can never gain time.
 * Timeouts are checked in the reducer, so they are fully unit-testable.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  adaptiveParamsForStep,
  mathParamsFromProfile,
  resolveMathDifficulty,
} from './difficulty';
import { generateProblem } from './generator';
import { perfectSessionScore, problemScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialMathState } from './types';
import type { MathAction, MathGameState, MathStats } from './types';

export { createInitialMathState };

/** Longest accepted digit entry (answers never exceed 3 digits at any level). */
export const MAX_INPUT_LENGTH = 6;

/** True when the level uses per-problem adaptive difficulty stepping. */
function isAdaptive(state: MathGameState): boolean {
  return state.difficulty === 'adaptive';
}

/** Params of the *current* problem, matching the step it was generated at. */
function currentParams(state: MathGameState): ReturnType<typeof mathParamsFromProfile> {
  const base = mathParamsFromProfile(state.profile as DifficultyProfile);
  if (isAdaptive(state)) {
    return adaptiveParamsForStep(base, state.difficultyStep);
  }
  return base;
}

export function mathGameReducer(
  state: MathGameState,
  action: MathAction,
): MathGameState {
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
      const profile = resolveMathDifficulty(state.difficulty);
      const baseParams = mathParamsFromProfile(profile);
      const params = isAdaptive(state)
        ? adaptiveParamsForStep(baseParams, 0)
        : baseParams;
      const rng = createRng(action.seed);
      const problem = generateProblem({
        rng,
        problemIndex: 0,
        params,
        prevProblem: null,
      });
      return {
        ...state,
        phase: 'problem',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        problemIndex: 0,
        problem,
        prevProblem: null,
        input: '',
        enteredAnswer: '',
        problemStartActiveMs: 0,
        problemElapsedMs: 0,
        problemBudgetMs: params.timeBudgetMs ?? 0,
        outcome: null,
        difficultyStep: 0,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'digit': {
      if (state.phase !== 'problem' || state.paused) {
        return state;
      }
      const digit = action.digit;
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return state;
      }
      if (state.input.length >= MAX_INPUT_LENGTH) {
        return state;
      }
      return { ...state, input: `${state.input}${digit}` };
    }

    case 'backspace': {
      if (state.phase !== 'problem' || state.paused || state.input.length === 0) {
        return state;
      }
      return { ...state, input: state.input.slice(0, -1) };
    }

    case 'clear-input': {
      if (state.phase !== 'problem' || state.paused) {
        return state;
      }
      return { ...state, input: '' };
    }

    case 'submit-answer': {
      if (state.phase !== 'problem' || state.paused || state.input.length === 0) {
        return state;
      }
      const problem = state.problem;
      if (problem === null || state.profile === null) {
        return state;
      }
      const params = currentParams(state);
      const elapsed = Math.max(0, action.atActiveMs - state.problemStartActiveMs);
      // Answers past the budget are scored as timeouts (a tick may not have
      // fired yet at submit time — both paths converge on the same outcome).
      if (params.timeBudgetMs !== null && elapsed >= params.timeBudgetMs) {
        return {
          ...state,
          phase: 'feedback',
          input: '',
          enteredAnswer: state.input,
          outcome: 'timeout',
          problemElapsedMs: params.timeBudgetMs,
          stats: {
            ...state.stats,
            problemsPlayed: state.stats.problemsPlayed + 1,
            streak: 0,
          },
        };
      }
      const correct = Number(state.input) === problem.answer;
      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: MathStats = {
          score: state.stats.score + problemScore(elapsed, params.timeBudgetMs ?? 0),
          problemsPlayed: state.stats.problemsPlayed + 1,
          problemsCorrect: state.stats.problemsCorrect + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          fastestMs:
            state.stats.fastestMs === null
              ? elapsed
              : Math.min(state.stats.fastestMs, elapsed),
          totalCorrectMs: state.stats.totalCorrectMs + elapsed,
        };
        return {
          ...state,
          phase: 'feedback',
          input: '',
          enteredAnswer: state.input,
          outcome: 'correct',
          problemElapsedMs: elapsed,
          stats,
        };
      }
      return {
        ...state,
        phase: 'feedback',
        input: '',
        enteredAnswer: state.input,
        outcome: 'incorrect',
        problemElapsedMs: elapsed,
        stats: {
          ...state.stats,
          problemsPlayed: state.stats.problemsPlayed + 1,
          streak: 0,
        },
      };
    }

    case 'problem-tick': {
      if (state.phase !== 'problem' || state.paused || state.problemBudgetMs <= 0) {
        return state;
      }
      const elapsed = Math.max(0, action.atActiveMs - state.problemStartActiveMs);
      if (elapsed >= state.problemBudgetMs) {
        return {
          ...state,
          phase: 'feedback',
          input: '',
          enteredAnswer: state.input,
          outcome: 'timeout',
          problemElapsedMs: state.problemBudgetMs,
          stats: {
            ...state.stats,
            problemsPlayed: state.stats.problemsPlayed + 1,
            streak: 0,
          },
        };
      }
      return { ...state, problemElapsedMs: elapsed };
    }

    case 'next-problem': {
      if (state.phase !== 'feedback' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const baseParams = mathParamsFromProfile(state.profile);
      const nextIndex = state.problemIndex + 1;
      if (nextIndex >= baseParams.rounds) {
        // Last problem answered: the session finishes; the screen completes
        // the lifecycle and persists in an effect watching the `results`
        // phase.
        return { ...state, phase: 'results', outcome: null };
      }
      // Adaptive: move the difficulty step with the outcome, then generate
      // the next problem at the new step. Fixed levels keep their params.
      const nextStep = isAdaptive(state)
        ? Math.min(
            baseParams.maxStep ?? 4,
            Math.max(
              baseParams.minStep ?? 0,
              state.difficultyStep + (state.outcome === 'correct' ? 1 : -1),
            ),
          )
        : state.difficultyStep;
      const params = isAdaptive(state)
        ? adaptiveParamsForStep(baseParams, nextStep)
        : baseParams;
      const rng = createRng(state.seed);
      const problem = generateProblem({
        rng,
        problemIndex: nextIndex,
        params,
        prevProblem: state.problem,
      });
      return {
        ...state,
        phase: 'problem',
        problemIndex: nextIndex,
        problem,
        prevProblem: state.problem,
        input: '',
        enteredAnswer: '',
        problemStartActiveMs: action.startedAtActiveMs,
        problemElapsedMs: 0,
        problemBudgetMs: params.timeBudgetMs ?? 0,
        outcome: null,
        difficultyStep: nextStep,
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
      const params = currentParams(state);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        outcome: null,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          problemsPlayed: rounds,
          problemsCorrect: rounds,
          bestStreak: rounds,
          streak: rounds,
          // Instant answers: fastest/avg-correct = 0 → normalized 1.
          fastestMs: 0,
          totalCorrectMs: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight problem (problem phase) counts as failed; a problem
      // already scored in `feedback` stays as-is.
      const currentProblemCounted = state.phase === 'feedback' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        outcome: null,
        forced: true,
        stats: {
          ...state.stats,
          problemsPlayed: state.stats.problemsPlayed + currentProblemCounted,
          streak: currentProblemCounted === 1 ? 0 : state.stats.streak,
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
