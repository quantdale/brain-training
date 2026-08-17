/**
 * Pure game state machine for the Word Match game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths and the
 * per-round deadline math) is unit testable without a UI. The screen owns the
 * side effects: the round-expiry timer, the SDK `SessionLifecycle`, tutorial
 * state, and persistence.
 *
 * Timing model: actions that depend on time carry `nowMs` from the SDK
 * monotonic clock (never `Date.now()`). The reducer stores the current
 * round's deadline (`roundDeadlineMs`) and rebases `roundStartedAtMs` across
 * pauses so answer times never include paused time. An answer arriving after
 * the deadline is ignored — the screen's expiry timer then terminates the
 * round as a timeout.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import { loadContentPack } from './content-validation';
import {
  languageParamsFromProfile,
  nextRoundParams,
  resolveLanguageDifficulty,
  tierOfNumber,
  tiersFromMask,
} from './difficulty';
import { filterByTiers, selectRound } from './generator';
import { clamp01, perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialLanguageState } from './types';
import type {
  LanguageAction,
  LanguageGameState,
  LanguageRound,
  LanguageStats,
  RoundOutcome,
} from './types';

export { createInitialLanguageState };

/** Stats update shared by the wrong-answer and timeout paths. */
function failedRoundStats(
  stats: LanguageStats,
  answerMs: number,
  answerRatio: number,
): LanguageStats {
  return {
    ...stats,
    roundsPlayed: stats.roundsPlayed + 1,
    streak: 0,
    totalAnswerMs: stats.totalAnswerMs + answerMs,
    sumAnswerRatio: stats.sumAnswerRatio + answerRatio,
  };
}

/** Ratio of an answer time to the round's budget, clamped to [0, 1]. */
function answerRatio(answerMs: number, budgetMs: number): number {
  return budgetMs > 0 ? clamp01(answerMs / budgetMs) : 1;
}

export function languageGameReducer(
  state: LanguageGameState,
  action: LanguageAction,
): LanguageGameState {
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
      const profile = resolveLanguageDifficulty(state.difficulty);
      const params = languageParamsFromProfile(profile);
      let currentTier: LanguageGameState['currentTier'] = null;
      let poolTiers: readonly LanguageRound['tier'][] = [];
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
      if (action.nowMs > state.roundDeadlineMs) {
        // Expired — a late tap changes nothing; the screen's timer fires the
        // timeout transition instead.
        return state;
      }
      const correct = action.index === state.round.correctIndex;
      const answerMs = Math.max(0, action.nowMs - state.roundStartedAtMs);
      const ratio = answerRatio(answerMs, state.roundBudgetMs);
      const outcome: RoundOutcome = correct ? 'correct' : 'wrong';
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats: LanguageStats = correct
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
      if (
        state.phase !== 'question' ||
        state.paused ||
        state.round === null ||
        state.roundDeadlineMs === null
      ) {
        return state;
      }
      if (action.nowMs < state.roundDeadlineMs) {
        // Premature (defensive): the round is not expired yet.
        return state;
      }
      // Timeout rounds record exactly the budget as the answer time, so the
      // recorded numbers are deterministic regardless of timer jitter.
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
      if (state.phase !== 'roundResult' || state.params === null || state.difficulty === null) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'correct';
      const tuning = nextRoundParams(
        state.difficulty,
        state.params,
        state.currentTier,
        state.roundBudgetMs,
        passed,
      );
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
      // Freeze both the remaining budget and the active elapsed time so a
      // resume can rebuild the deadline and rebase the answer clock without
      // ever counting paused time.
      return {
        ...state,
        paused: true,
        roundDeadlineMs: null,
        roundRemainingMs: Math.max(0, state.roundDeadlineMs - action.nowMs),
        roundElapsedMs: Math.max(0, action.nowMs - state.roundStartedAtMs),
      };
    }

    case 'resume': {
      if (
        !state.paused ||
        state.roundRemainingMs === null ||
        state.roundElapsedMs === null
      ) {
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
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.params === null) {
        return state;
      }
      const rounds = state.params.rounds;
      const perfect: LanguageStats = {
        score: perfectSessionScore(state.params),
        roundsPlayed: rounds,
        roundsCorrect: rounds,
        bestStreak: rounds,
        streak: rounds,
        // Instant answers: speed is perfect, so normalization reaches 1.0.
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (question) counts as failed; a round already
      // scored in `roundResult` stays as-is.
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        roundOutcomes:
          currentRoundCounted === 1
            ? [...state.roundOutcomes, 'wrong' as const]
            : state.roundOutcomes,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
        },
      };
    }

    case 'qa/force-timeout': {
      // Dev-only: expire the current round as a timeout and keep playing.
      // Deliberately does NOT mark the session as forced — only force-win /
      // force-lose end a session via QA.
      if (state.phase !== 'question' || state.paused || state.round === null) {
        return state;
      }
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
