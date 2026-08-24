/**
 * Pure game state machine for the Order Path game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths and the
 * round-deadline math) is unit testable without a UI. The screen owns the
 * side effects: the round-expiry timer, the SDK `SessionLifecycle`,
 * tutorial state, and persistence.
 *
 * Timing model: the active phase is `round`. A single per-round deadline
 * (`roundDeadlineMs`) is stored; pause freezes the remaining budget
 * (`roundRemainingMs`) and rebases `roundStartedAtMs` on resume so answer
 * times never count paused time. A late/incorrect tap before expiry is
 * handled by `select-item`; an expiry fires `expire-round`.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()`.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  orderPathParamsFromProfile,
  resolveOrderPathDifficulty,
} from './difficulty';
import { generateRound } from './generator';
import { availableNext } from './solver';
import { roundScore } from './scoring';
import { INITIAL_STATS, createInitialOrderPathState } from './types';
import type {
  OrderPathAction,
  OrderPathGameState,
  OrderPathStats,
} from './types';

export { createInitialOrderPathState };

/** Stats update shared by the wrong-answer and timeout paths. */
function failedRoundStats(
  stats: OrderPathStats,
  elapsedMs: number,
  budgetMs: number,
): OrderPathStats {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    streak: 0,
    totalElapsedMs: stats.totalElapsedMs + elapsedMs,
    totalBudgetMs: stats.totalBudgetMs + budgetMs,
  };
}

export function orderPathGameReducer(
  state: OrderPathGameState,
  action: OrderPathAction,
): OrderPathGameState {
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
      const profile = resolveOrderPathDifficulty(state.difficulty);
      const params = orderPathParamsFromProfile(profile);
      const round = generateRound({
        rng: createRng(action.seed),
        roundIndex: 0,
        itemCount: params.itemCount,
        edgeDensityTarget: params.edgeDensityTarget,
        prevSolution: null,
      });
      return {
        ...state,
        phase: 'round',
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
        placedItems: [],
        selectedItem: null,
        roundCorrect: null,
        roundOutcome: null,
        roundStartedAtMs: action.startedAtMs,
        roundDeadlineMs: action.startedAtMs + params.roundTimeMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'select-item': {
      if (
        state.phase !== 'round' ||
        state.paused ||
        state.currentRound === null ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null
      ) {
        return state;
      }
      if (action.nowMs > state.roundDeadlineMs) {
        // Expired: let the screen's expiry timer fire the timeout transition.
        return state;
      }
      const round = state.currentRound;
      const available = availableNext(round.items, round.edges, state.placedItems);
      const elapsed = Math.max(0, action.nowMs - state.roundStartedAtMs);
      const budget = state.profile ? orderPathParamsFromProfile(state.profile).roundTimeMs : elapsed;

      const correct = available.length === 1 && action.item === available[0];
      if (!correct) {
        // Wrong item: reveal the correct next and end the round as wrong.
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'wrong',
          roundCorrect: false,
          selectedItem: action.item,
          roundStartedAtMs: null,
          roundDeadlineMs: null,
          roundRemainingMs: null,
          roundElapsedMs: null,
          stats: failedRoundStats(state.stats, elapsed, budget),
        };
      }

      const placedItems = [...state.placedItems, action.item];
      const isLast = placedItems.length === round.stepCount;
      if (!isLast) {
        return {
          ...state,
          placedItems,
          selectedItem: action.item,
          roundCorrect: true,
          roundOutcome: null,
        };
      }

      // Final correct item: round solved.
      const streak = state.stats.streak + 1;
      const score = state.stats.score + roundScore(elapsed, budget);
      const bestRoundTimeMs = Math.min(state.stats.bestRoundTimeMs, elapsed);
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'correct',
        roundCorrect: true,
        selectedItem: action.item,
        roundStartedAtMs: null,
        roundDeadlineMs: null,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stats: {
          ...state.stats,
          score,
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsCorrect: state.stats.roundsCorrect + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          bestRoundTimeMs,
          totalElapsedMs: state.stats.totalElapsedMs + elapsed,
          totalBudgetMs: state.stats.totalBudgetMs + budget,
        },
      };
    }

    case 'expire-round': {
      if (
        state.phase !== 'round' ||
        state.paused ||
        state.currentRound === null ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null
      ) {
        return state;
      }
      if (action.nowMs < state.roundDeadlineMs) {
        return state;
      }
      const budget = state.profile ? orderPathParamsFromProfile(state.profile).roundTimeMs : 0;
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        roundCorrect: false,
        selectedItem: null,
        roundStartedAtMs: null,
        roundDeadlineMs: null,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stats: failedRoundStats(state.stats, budget, budget),
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = orderPathParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const round = generateRound({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        itemCount: params.itemCount,
        edgeDensityTarget: params.edgeDensityTarget,
        prevSolution: state.currentRound?.solution ?? null,
      });
      return {
        ...state,
        phase: 'round',
        roundIndex: nextIndex,
        currentRound: round,
        placedItems: [],
        selectedItem: null,
        roundCorrect: null,
        roundOutcome: null,
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + params.roundTimeMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
      };
    }

    case 'pause': {
      if (
        state.paused ||
        state.phase !== 'round' ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null
      ) {
        return state;
      }
      return {
        ...state,
        paused: true,
        roundDeadlineMs: null,
        roundRemainingMs: Math.max(0, state.roundDeadlineMs - action.nowMs),
        roundElapsedMs: Math.max(0, action.nowMs - state.roundStartedAtMs),
      };
    }

    case 'resume': {
      if (state.roundRemainingMs === null || state.roundElapsedMs === null) {
        return state;
      }
      return {
        ...state,
        paused: false,
        roundDeadlineMs: action.nowMs + state.roundRemainingMs,
        roundStartedAtMs: action.nowMs - state.roundElapsedMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
      };
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = orderPathParamsFromProfile(state.profile);
      const perfect: OrderPathStats = {
        score: params.rounds * 150,
        roundsPlayed: params.rounds,
        roundsCorrect: params.rounds,
        bestStreak: params.rounds,
        streak: params.rounds,
        totalElapsedMs: 0,
        totalBudgetMs: params.rounds * params.roundTimeMs,
        bestRoundTimeMs: 0,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: perfect,
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

    case 'qa/force-timeout': {
      if (state.phase !== 'round' || state.paused || state.currentRound === null || state.profile === null) {
        return state;
      }
      const budget = orderPathParamsFromProfile(state.profile).roundTimeMs;
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        roundCorrect: false,
        selectedItem: null,
        roundStartedAtMs: null,
        roundDeadlineMs: null,
        roundRemainingMs: null,
        roundElapsedMs: null,
        stats: failedRoundStats(state.stats, budget, budget),
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
