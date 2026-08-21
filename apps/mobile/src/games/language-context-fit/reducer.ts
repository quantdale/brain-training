/**
 * Pure game state machine for the Context Fit game.
 *
 * Every transition is a pure function of (state, action) — no timers, no side
 * effects. The screen owns timers, the SDK SessionLifecycle, tutorial, and
 * persistence. Timing uses the SDK monotonic clock (never Date.now()); pause
 * freezes and rebases the round deadline so answer times never include paused
 * time. QA force actions only reshape state; the screen gates their entry.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import { loadContentPack } from './content-validation';
import {
  contextFitParamsFromProfile,
  nextRoundParams,
  resolveContextFitDifficulty,
  tierOfNumber,
  tiersFromMask,
} from './difficulty';
import { filterByTiers, selectRound } from './generator';
import { clamp01, perfectSessionScore, roundScore } from './scoring';
import { createInitialContextFitState, INITIAL_STATS } from './types';
import type {
  ContextFitAction,
  ContextFitGameState,
  ContextFitRound,
  ContextFitStats,
  RoundOutcome,
} from './types';

export { createInitialContextFitState };

function failedRoundStats(stats: ContextFitStats, answerMs: number, answerRatio: number): ContextFitStats {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    streak: 0,
    totalAnswerMs: stats.totalAnswerMs + answerMs,
    sumAnswerRatio: stats.sumAnswerRatio + answerRatio,
  };
}

function answerRatio(answerMs: number, budgetMs: number): number {
  return budgetMs > 0 ? clamp01(answerMs / budgetMs) : 1;
}

export function contextFitGameReducer(
  state: ContextFitGameState,
  action: ContextFitAction,
): ContextFitGameState {
  switch (action.type) {
    case 'select-difficulty': {
      if (state.phase !== 'intro') return state;
      return { ...state, difficulty: action.level };
    }

    case 'start-session': {
      if (state.difficulty === null) return state;
      const profile = resolveContextFitDifficulty(state.difficulty);
      const params = contextFitParamsFromProfile(profile);
      let currentTier: ContextFitGameState['currentTier'] = null;
      let poolTiers: readonly ContextFitRound['tier'][] = [];
      if (state.difficulty === 'adaptive') {
        currentTier = tierOfNumber(params.initialTier ?? 1);
        poolTiers = [currentTier];
      } else {
        poolTiers = tiersFromMask(params.tierMask);
      }
      const selection = selectRound({
        rng: createRng(action.seed),
        roundIndex: 0,
        pool: filterByTiers(loadContentPack().items, poolTiers),
        usedItemIds: new Set(),
        previousRound: null,
      });
      return {
        ...state,
        phase: 'question',
        paused: false,
        profile,
        params,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        poolTiers,
        currentTier,
        roundBudgetMs: params.timePerRoundMs,
        round: selection,
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + params.timePerRoundMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
        roundOutcomes: [],
        usedItemIds: [selection.itemId],
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'answer-option': {
      if (
        state.phase !== 'question' ||
        state.paused ||
        state.round === null ||
        state.roundDeadlineMs === null ||
        state.roundStartedAtMs === null ||
        state.params === null
      ) {
        return state;
      }
      if (action.nowMs > state.roundDeadlineMs) return state;
      const correct = action.index === state.round.correctIndex;
      const answerMs = Math.max(0, action.nowMs - state.roundStartedAtMs);
      const ratio = answerRatio(answerMs, state.roundBudgetMs);
      const outcome: RoundOutcome = correct ? 'correct' : 'wrong';
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats: ContextFitStats = correct
        ? {
            ...state.stats,
            score: state.stats.score + roundScore(answerMs, state.roundBudgetMs),
            roundsPlayed: state.stats.roundsPlayed + 1,
            roundsCorrect: state.stats.roundsCorrect + 1,
            bestStreak: Math.max(state.stats.bestStreak, streak),
            streak,
            totalAnswerMs: state.stats.totalAnswerMs + answerMs,
            sumAnswerRatio: state.stats.sumAnswerRatio + ratio,
          }
        : failedRoundStats(state.stats, answerMs, ratio);
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: outcome,
        lastAnswerIndex: action.index,
        lastAnswerMs: answerMs,
        roundOutcomes: [...state.roundOutcomes, outcome],
        stats,
      };
    }

    case 'expire-round': {
      if (state.phase !== 'question' || state.paused || state.round === null || state.roundDeadlineMs === null) {
        return state;
      }
      if (action.nowMs < state.roundDeadlineMs) return state;
      const budget = state.roundBudgetMs;
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, 'timeout'],
        stats: failedRoundStats(state.stats, budget, 1),
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.params === null || state.difficulty === null) return state;
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.params.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'correct';
      const tuning = nextRoundParams(state.difficulty, state.params, state.currentTier, state.roundBudgetMs, passed);
      const selection = selectRound({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        pool: filterByTiers(loadContentPack().items, tuning.tiers),
        usedItemIds: new Set(state.usedItemIds),
        previousRound: state.round,
      });
      return {
        ...state,
        phase: 'question',
        roundIndex: nextIndex,
        poolTiers: tuning.tiers,
        currentTier: tuning.currentTier,
        roundBudgetMs: tuning.timePerRoundMs,
        round: selection,
        roundStartedAtMs: action.nowMs,
        roundDeadlineMs: action.nowMs + tuning.timePerRoundMs,
        roundRemainingMs: null,
        roundElapsedMs: null,
        roundOutcome: null,
        lastAnswerIndex: null,
        lastAnswerMs: null,
        usedItemIds: [...state.usedItemIds, selection.itemId],
      };
    }

    case 'pause': {
      if (
        state.paused ||
        state.phase !== 'question' ||
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
      if (state.paused === false || state.roundRemainingMs === null || state.roundElapsedMs === null) {
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
      if (state.phase === 'results' || state.phase === 'intro' || state.params === null) return state;
      const rounds = state.params.rounds;
      const perfect: ContextFitStats = {
        score: perfectSessionScore(state.params),
        roundsPlayed: rounds,
        roundsCorrect: rounds,
        bestStreak: rounds,
        streak: rounds,
        totalAnswerMs: 0,
        sumAnswerRatio: 0,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes: Array.from({ length: rounds }, () => 'correct' as const),
        stats: perfect,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) return state;
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes:
          currentRoundCounted === 1 ? [...state.roundOutcomes, 'wrong' as const] : state.roundOutcomes,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case 'qa/force-timeout': {
      if (state.phase !== 'question' || state.paused || state.round === null) return state;
      const budget = state.roundBudgetMs;
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        lastAnswerIndex: null,
        lastAnswerMs: budget,
        roundOutcomes: [...state.roundOutcomes, 'timeout'],
        stats: failedRoundStats(state.stats, budget, 1),
      };
    }

    case 'qa/force-state': {
      if (state.phase !== 'intro') return state;
      const patch = action.patch;
      const difficulty =
        patch.difficulty !== undefined && isDifficultyLevel(patch.difficulty)
          ? patch.difficulty
          : state.difficulty;
      const seedOverride = patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default: {
      return state;
    }
  }
}
