/**
 * Pure game state machine for the Order Sweep game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-round
 * window-expiry timer, the SDK `SessionLifecycle`, tutorial state, and
 * persistence.
 *
 * Timing contract: the reducer never reads a clock. The screen stamps each
 * action with monotonic clock values (`roundStartedAtMs`, `nowMs`); the
 * reducer derives the deadline (`deadlineMs = roundStartedAtMs + windowMs`)
 * and per-token speed gaps (`nowMs - lastClearAtMs`). Pause freezes play by
 * removing the expiry timer from the UI; on resume the screen re-schedules
 * with the remaining time computed from the unchanged `deadlineMs`, and the
 * reducer shifts every open anchor (`roundStartedAtMs`, `lastClearAtMs`) by
 * the same delta as the deadline so measured gaps never include pause time.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  nextWindowMs,
  resolveOrderSweepDifficulty,
  orderSweepParamsFromProfile,
} from './difficulty';
import { generateRound } from './generator';
import { correctPoints, paceMs, perfectRoundBonus, perfectSessionScore } from './scoring';
import { INITIAL_STATS, createInitialOrderSweepState } from './types';
import type {
  OrderSweepAction,
  OrderSweepDifficultyParams,
  OrderSweepGameState,
  OrderSweepRound,
  OrderSweepStats,
} from './types';

export { createInitialOrderSweepState };

/** The value that must be tapped next, or null when the board is swept. */
function requiredValue(round: OrderSweepRound, clearedCount: number): number | null {
  return clearedCount < round.order.length ? round.order[clearedCount] : null;
}

/**
 * Score a fully swept round and move to `roundResult`. A round is perfect
 * when it was swept with zero wrong taps (that is also the window-shrinking
 * condition); a round completed despite wrong taps still counts as cleared.
 */
function finishRound(
  state: OrderSweepGameState,
  params: OrderSweepDifficultyParams,
  stats: OrderSweepStats,
): OrderSweepGameState {
  const perfect = state.roundWrongTaps === 0;
  return {
    ...state,
    phase: 'roundResult',
    roundStartedAtMs: null,
    deadlineMs: null,
    lastClearAtMs: null,
    roundOutcome: perfect ? 'perfect' : 'cleared',
    stats: {
      ...stats,
      score: stats.score + (perfect ? perfectRoundBonus(params.count) : 0),
      roundsPlayed: stats.roundsPlayed + 1,
      roundsCleared: stats.roundsCleared + 1,
      perfectRounds: stats.perfectRounds + (perfect ? 1 : 0),
    },
  };
}

export function orderSweepGameReducer(
  state: OrderSweepGameState,
  action: OrderSweepAction,
): OrderSweepGameState {
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
      const profile = resolveOrderSweepDifficulty(state.difficulty);
      const params = orderSweepParamsFromProfile(profile);
      const round = generateRound({
        rng: createRng(action.seed),
        roundIndex: 0,
        count: params.count,
        columns: params.columns,
        maxValue: params.maxValue,
      });
      return {
        ...state,
        phase: 'active',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        windowMs: params.initialWindowMs,
        round,
        clearedCount: 0,
        roundStartedAtMs: action.roundStartedAtMs,
        deadlineMs: action.roundStartedAtMs + params.initialWindowMs,
        lastClearAtMs: action.roundStartedAtMs,
        lastVerdict: null,
        roundOutcome: null,
        roundWrongTaps: 0,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'tap': {
      if (state.phase !== 'active' || state.paused || state.profile === null) {
        return state;
      }
      // Post-deadline taps are ignored — the window already closed and the
      // expiry timer owns the resolution. Guards against timer/dispatch races.
      if (state.deadlineMs !== null && action.nowMs > state.deadlineMs) {
        return state;
      }
      const round = state.round;
      if (round === null || state.lastClearAtMs === null) {
        return state;
      }
      const token = round.tokens.find((candidate) => candidate.id === action.tokenId);
      if (token === undefined) {
        return state; // empty grid cell
      }
      const required = requiredValue(round, state.clearedCount);
      if (required === null) {
        return state; // board already swept; expiry timer owns the transition
      }
      const params = orderSweepParamsFromProfile(state.profile);

      if (token.value === required) {
        // Correct clear: measure the gap since the previous clear (or round
        // start), award speed-scaled points, and advance the sweep.
        const gapMs = Math.max(0, action.nowMs - state.lastClearAtMs);
        const referencePace = paceMs(state.windowMs, params.count);
        const factor = speedFactorOf(referencePace, gapMs);
        const streak = state.stats.streak + 1;
        const clearedCount = state.clearedCount + 1;
        const stats: OrderSweepStats = {
          ...state.stats,
          score: state.stats.score + correctPoints(referencePace, gapMs),
          tokensCleared: state.stats.tokensCleared + 1,
          gaps: [...state.stats.gaps, gapMs],
          speedFactors: [...state.stats.speedFactors, factor],
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
        };
        const advanced: OrderSweepGameState = {
          ...state,
          clearedCount,
          lastClearAtMs: action.nowMs,
          lastVerdict: 'correct',
          stats,
        };
        if (clearedCount >= round.order.length) {
          return finishRound(advanced, params, stats);
        }
        return advanced;
      }

      // Wrong token: the mistake is counted and the streak breaks, but the
      // board is unchanged — the player keeps sweeping.
      const stats: OrderSweepStats = {
        ...state.stats,
        wrongTaps: state.stats.wrongTaps + 1,
        streak: 0,
      };
      return {
        ...state,
        lastVerdict: 'wrong',
        roundWrongTaps: state.roundWrongTaps + 1,
        stats,
      };
    }

    case 'round-expired': {
      if (state.phase !== 'active' || state.paused || state.profile === null) {
        return state;
      }
      const expired = state.round !== null ? state.round.order.length - state.clearedCount : 0;
      return {
        ...state,
        phase: 'roundResult',
        roundStartedAtMs: null,
        deadlineMs: null,
        lastClearAtMs: null,
        roundOutcome: 'expired',
        stats: {
          ...state.stats,
          tokensExpired: state.stats.tokensExpired + expired,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = orderSweepParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null, lastVerdict: null };
      }
      const perfect = state.roundOutcome === 'perfect';
      const windowMs = nextWindowMs(state.windowMs, perfect, state.difficulty, params);
      const round = generateRound({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        count: params.count,
        columns: params.columns,
        maxValue: params.maxValue,
      });
      return {
        ...state,
        phase: 'active',
        roundIndex: nextIndex,
        windowMs,
        round,
        clearedCount: 0,
        roundStartedAtMs: action.roundStartedAtMs,
        deadlineMs: action.roundStartedAtMs + windowMs,
        lastClearAtMs: action.roundStartedAtMs,
        lastVerdict: null,
        roundOutcome: null,
        roundWrongTaps: 0,
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'results' || state.phase === 'intro') {
        return state;
      }
      return { ...state, paused: true };
    }

    case 'resume': {
      if (!state.paused) {
        return state;
      }
      if (state.roundStartedAtMs === null || state.deadlineMs === null) {
        // Paused on the round-result card: nothing to re-anchor.
        return { ...state, paused: false };
      }
      // Re-anchor the round's timeline so pause time is excluded from both
      // the remaining window and the measured inter-clear gaps: every open
      // anchor shifts by the same delta the deadline shifts by.
      const remaining = Math.max(0, Math.min(action.remainingMs, state.windowMs));
      const newDeadline = action.nowMs + remaining;
      const shift = newDeadline - state.deadlineMs;
      return {
        ...state,
        paused: false,
        roundStartedAtMs: state.roundStartedAtMs + shift,
        deadlineMs: newDeadline,
        lastClearAtMs: state.lastClearAtMs !== null ? state.lastClearAtMs + shift : null,
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = orderSweepParamsFromProfile(state.profile);
      const totalTokens = params.count * params.rounds;
      // Synthetic QA session: every token cleared instantly with zero wrong
      // taps. The fabricated gaps/factors make the normalizer produce exactly
      // 1.0 and the record stays fully deterministic (and flagged `forced`).
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        lastVerdict: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          tokensCleared: totalTokens,
          tokensExpired: 0,
          wrongTaps: 0,
          gaps: Array.from({ length: totalTokens }, () => 0),
          speedFactors: Array.from({ length: totalTokens }, () => 1),
          bestStreak: totalTokens,
          streak: totalTokens,
          roundsPlayed: params.rounds,
          roundsCleared: params.rounds,
          perfectRounds: params.rounds,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round's unswept tokens count as expired; a round already
      // scored in `roundResult` stays as-is.
      const unswept =
        state.round !== null ? state.round.order.length - state.clearedCount : 0;
      const currentRoundUnscored = state.phase === 'active' ? 1 : 0;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        lastVerdict: null,
        forced: true,
        stats: {
          ...state.stats,
          tokensExpired: state.stats.tokensExpired + unswept,
          streak: 0,
          roundsPlayed: state.stats.roundsPlayed + currentRoundUnscored,
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
      const seedOverride = patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default: {
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}

/** Local alias so the hot path reads cleanly; identical semantics to scoring.speedFactor. */
function speedFactorOf(referencePaceMs: number, gapMs: number): number {
  return Math.min(1, Math.max(0, (referencePaceMs - gapMs) / referencePaceMs));
}
