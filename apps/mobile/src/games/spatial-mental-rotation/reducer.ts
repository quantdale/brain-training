/**
 * Pure game state machine for the Mental Rotation game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the round-clock
 * polling, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Round timing model: the screen periodically dispatches `clock-tick` with
 * the time remaining in the round's budget, measured against the SDK
 * lifecycle's active (non-paused) elapsed time — pausing freezes the budget
 * automatically because the lifecycle clock freezes. The reducer only records
 * values and transitions on `remainingMs <= 0`; it never reads a clock.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  nextAdaptivePosition,
  paramsForPosition,
  resolveSpatialDifficulty,
  spatialParamsFromProfile,
} from './difficulty';
import { generateRound } from './generator';
import type { RotationRound } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialSpatialState } from './types';
import type { SpatialAction, SpatialGameState, SpatialStats } from './types';

export { createInitialSpatialState };

/** Round parameters for the upcoming round, given the current state. */
function nextRoundParams(
  state: SpatialGameState,
): { params: ReturnType<typeof spatialParamsFromProfile>; adaptivePosition: number } {
  const profile = state.profile;
  const params = profile !== null ? spatialParamsFromProfile(profile) : null;
  if (params === null) {
    throw new Error('spatial: nextRoundParams called without a resolved profile');
  }
  if (state.difficulty === 'adaptive') {
    const position = nextAdaptivePosition(
      state.adaptivePosition,
      state.roundOutcome === 'passed',
    );
    const perRound = paramsForPosition(position, params);
    return {
      params: {
        ...perRound,
        rounds: params.rounds,
        ...(params.minBlocks !== undefined ? { minBlocks: params.minBlocks } : {}),
        ...(params.maxBlocks !== undefined ? { maxBlocks: params.maxBlocks } : {}),
        ...(params.minTimeBudgetMs !== undefined ? { minTimeBudgetMs: params.minTimeBudgetMs } : {}),
        ...(params.maxTimeBudgetMs !== undefined ? { maxTimeBudgetMs: params.maxTimeBudgetMs } : {}),
      },
      adaptivePosition: position,
    };
  }
  return { params, adaptivePosition: state.adaptivePosition };
}

/** Generate the next round's content from the session seed (deterministic). */
function buildRound(
  seed: string,
  roundIndex: number,
  params: ReturnType<typeof spatialParamsFromProfile>,
  prevTarget: readonly { x: number; y: number }[] | null,
): RotationRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    params: {
      blocks: params.blocks,
      angleMask: params.angleMask,
      timeBudgetMs: params.timeBudgetMs,
      rounds: params.rounds,
    },
    prevTarget,
  });
}
export function spatialGameReducer(
  state: SpatialGameState,
  action: SpatialAction,
): SpatialGameState {
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
      const profile = resolveSpatialDifficulty(state.difficulty);
      const params = spatialParamsFromProfile(profile);
      const round = buildRound(action.seed, 0, params, null);
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
        rounds: params.rounds,
        blocks: params.blocks,
        angleMask: params.angleMask,
        timeBudgetMs: params.timeBudgetMs,
        roundStartedElapsedMs: 0,
        timeRemainingMs: params.timeBudgetMs,
        target: round.target,
        candidate: round.candidate,
        kind: round.kind,
        candidateDegrees: round.candidateDegrees,
        transform: round.transform,
        roundOutcome: null,
        adaptivePosition: state.difficulty === 'adaptive' ? 0.5 : state.adaptivePosition,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'clock-tick': {
      if (state.phase !== 'play' || state.paused) {
        return state;
      }
      if (action.remainingMs <= 0) {
        // Time budget expired: the round ends as a timeout without an answer.
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'timeout',
          timeRemainingMs: 0,
          stats: {
            ...state.stats,
            roundsPlayed: state.stats.roundsPlayed + 1,
            streak: 0,
            timeouts: state.stats.timeouts + 1,
            totalBudgetMs: state.stats.totalBudgetMs + state.timeBudgetMs,
          },
        };
      }
      return { ...state, timeRemainingMs: action.remainingMs };
    }

    case 'answer': {
      if (state.phase !== 'play' || state.paused || state.kind === null) {
        return state;
      }
      const correct = action.answer === state.kind;
      const remaining = Math.max(0, state.timeRemainingMs);
      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: SpatialStats = {
          score: state.stats.score + roundScore(state.timeBudgetMs, remaining),
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          totalAnswers: state.stats.totalAnswers + 1,
          correctAnswers: state.stats.correctAnswers + 1,
          timeouts: state.stats.timeouts,
          totalRemainingMs: state.stats.totalRemainingMs + remaining,
          totalBudgetMs: state.stats.totalBudgetMs + state.timeBudgetMs,
        };
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'passed',
          timeRemainingMs: remaining,
          stats,
        };
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'failed',
        timeRemainingMs: remaining,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalAnswers: state.stats.totalAnswers + 1,
          totalRemainingMs: state.stats.totalRemainingMs + remaining,
          totalBudgetMs: state.stats.totalBudgetMs + state.timeBudgetMs,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const { params, adaptivePosition } = nextRoundParams(state);
      // `state.target` is still the PREVIOUS round's target here; the
      // generator avoids repeating it (near-duplicate avoidance).
      const round = buildRound(state.seed, nextIndex, params, state.target);
      return {
        ...state,
        phase: 'play',
        roundIndex: nextIndex,
        blocks: params.blocks,
        angleMask: params.angleMask,
        timeBudgetMs: params.timeBudgetMs,
        roundStartedElapsedMs: action.roundStartedElapsedMs,
        timeRemainingMs: params.timeBudgetMs,
        target: round.target,
        candidate: round.candidate,
        kind: round.kind,
        candidateDegrees: round.candidateDegrees,
        transform: round.transform,
        roundOutcome: null,
        adaptivePosition,
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
      const params = spatialParamsFromProfile(state.profile);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: params.rounds,
          roundsPassed: params.rounds,
          bestStreak: params.rounds,
          streak: params.rounds,
          totalAnswers: params.rounds,
          correctAnswers: params.rounds,
          timeouts: 0,
          totalRemainingMs: params.rounds * params.timeBudgetMs,
          totalBudgetMs: params.rounds * params.timeBudgetMs,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (play) counts as failed; a round already scored
      // in `roundResult` stays as-is.
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
          totalAnswers:
            currentRoundCounted === 1 ? state.stats.totalAnswers + 1 : state.stats.totalAnswers,
          totalRemainingMs:
            currentRoundCounted === 1
              ? state.stats.totalRemainingMs + Math.max(0, state.timeRemainingMs)
              : state.stats.totalRemainingMs,
          totalBudgetMs:
            currentRoundCounted === 1
              ? state.stats.totalBudgetMs + state.timeBudgetMs
              : state.stats.totalBudgetMs,
        },
      };
    }

    case 'qa/force-timeout': {
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
          timeouts:
            currentRoundCounted === 1 ? state.stats.timeouts + 1 : state.stats.timeouts,
          totalBudgetMs:
            currentRoundCounted === 1
              ? state.stats.totalBudgetMs + state.timeBudgetMs
              : state.stats.totalBudgetMs,
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
