/**
 * Pure game state machine for the Number Line Estimation game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-round
 * budget ticker, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing model (mirrors math-fast-math): the reducer never reads a clock.
 * `round-tick` and `estimate` carry `atActiveMs` — the SessionLifecycle's
 * active-only elapsed ms (paused segments are excluded by the lifecycle) —
 * and the reducer derives `roundElapsedMs = atActiveMs − roundStartActiveMs`.
 * Pausing therefore freezes the budget exactly; a player can never gain time,
 * and timeouts are checked in the reducer so they are fully unit-testable.
 *
 * Correctness guards: an estimate is accepted only once per round
 * (`phase === 'estimating'`); estimates past the budget are scored as
 * timeouts (a tick may not have fired yet at tap time — both paths converge
 * on the same outcome), so duplicate taps and timer/dispatch races cannot
 * double-score. Estimates are snapped integers clamped into the line range;
 * out-of-range values are rejected rather than silently clamped.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextTolerancePct,
  numberLineParamsFromProfile,
  resolveNumberLineDifficulty,
} from './difficulty';
import { generateRound } from './generator';
import { closenessOf, isHit, perfectSessionScore, roundScore, toleranceSpan } from './scoring';
import { INITIAL_STATS, createInitialNumberLineState } from './types';
import type {
  NumberLineAction,
  NumberLineGameState,
  NumberLineStats,
} from './types';

export { createInitialNumberLineState };

/** Params of the *current* round, matching the tolerance it was generated at. */
function currentParams(state: NumberLineGameState): ReturnType<typeof numberLineParamsFromProfile> {
  const base = numberLineParamsFromProfile(state.profile as DifficultyProfile);
  if (state.difficulty !== 'adaptive') {
    return base;
  }
  // The live round was generated with the tolerance recorded in state.
  return { ...base, tolerancePct: state.tolerancePct };
}

/** Fold one resolved round into the stats. */
function applyRoundOutcome(
  stats: NumberLineStats,
  outcome: 'hit' | 'miss' | 'timeout',
  absoluteError: number,
  tolSpan: number,
): NumberLineStats {
  const closeness = outcome === 'timeout' ? 0 : closenessOf(absoluteError, tolSpan);
  const hit = outcome === 'hit';
  const streak = hit ? stats.streak + 1 : 0;
  return {
    score: stats.score + (hit ? roundScore(absoluteError, tolSpan) : 0),
    roundsPlayed: stats.roundsPlayed + 1,
    roundsHit: stats.roundsHit + (hit ? 1 : 0),
    bestStreak: Math.max(stats.bestStreak, streak),
    streak,
    totalCloseness: stats.totalCloseness + closeness,
    bestCloseness: Math.max(stats.bestCloseness, closeness),
    totalAbsoluteError: stats.totalAbsoluteError + Math.abs(absoluteError),
    timeouts: stats.timeouts + (outcome === 'timeout' ? 1 : 0),
  };
}

/** Resolve the live round against an estimate (or timeout) and advance. */
function resolveEstimate(
  state: NumberLineGameState,
  estimateValue: number | null,
  elapsedMs: number,
): NumberLineGameState {
  const params = currentParams(state);
  const round = state.round;
  if (round === null) {
    return state;
  }
  const tolSpan = toleranceSpan(params);
  const timedOut = estimateValue === null || elapsedMs >= params.budgetMs;
  const outcome = timedOut ? 'timeout' : isHit(Math.abs(estimateValue - round.target), tolSpan)
    ? 'hit'
    : 'miss';
  // Timeouts contribute no error sample (no estimate was made).
  const absoluteError = timedOut ? 0 : Math.abs(estimateValue - round.target);

  return {
    ...state,
    phase: 'feedback',
    estimateValue: timedOut ? null : estimateValue,
    outcome,
    roundElapsedMs: Math.min(elapsedMs, params.budgetMs),
    stats: applyRoundOutcome(state.stats, outcome, absoluteError, tolSpan),
  };
}

export function numberLineGameReducer(
  state: NumberLineGameState,
  action: NumberLineAction,
): NumberLineGameState {
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
      const profile = resolveNumberLineDifficulty(state.difficulty);
      const params = numberLineParamsFromProfile(profile);
      const round = generateRound(createRng(action.seed), 0, params, null);
      return {
        ...state,
        phase: 'estimating',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        round,
        tolerancePct: params.tolerancePct,
        roundBudgetMs: params.budgetMs,
        roundStartActiveMs: 0,
        roundElapsedMs: 0,
        estimateValue: null,
        outcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'round-tick': {
      if (state.phase !== 'estimating' || state.paused || state.roundBudgetMs <= 0) {
        return state;
      }
      const elapsed = Math.max(0, action.atActiveMs - state.roundStartActiveMs);
      if (elapsed >= state.roundBudgetMs) {
        return resolveEstimate(state, null, elapsed);
      }
      return { ...state, roundElapsedMs: elapsed };
    }

    case 'estimate': {
      if (state.phase !== 'estimating' || state.paused || state.round === null) {
        return state;
      }
      const round = state.round;
      // Reject off-line values outright instead of silently clamping: a tap
      // outside the rendered line is a UI bug, not a player answer.
      if (
        !Number.isFinite(action.value) ||
        !Number.isInteger(action.value) ||
        action.value < round.lineMin ||
        action.value > round.lineMax
      ) {
        return state;
      }
      const elapsed = Math.max(0, action.atActiveMs - state.roundStartActiveMs);
      const params = currentParams(state);
      // Past-budget taps are scored as timeouts (same outcome as the tick
      // path) so a slow frame can never convert into points.
      if (params.budgetMs > 0 && elapsed >= params.budgetMs) {
        return resolveEstimate(state, null, elapsed);
      }
      return resolveEstimate(state, action.value, elapsed);
    }

    case 'next-round': {
      if (state.phase !== 'feedback' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const baseParams = numberLineParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= baseParams.rounds) {
        // Last round resolved: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', round: null, outcome: null };
      }
      const roundHit = state.outcome === 'hit';
      const tolerancePct = nextTolerancePct(state.tolerancePct, roundHit, state.difficulty, baseParams);
      const round = generateRound(createRng(state.seed), nextIndex, baseParams, state.round?.target ?? null);
      return {
        ...state,
        phase: 'estimating',
        roundIndex: nextIndex,
        round,
        tolerancePct,
        roundStartActiveMs: action.startActiveMs,
        roundElapsedMs: 0,
        estimateValue: null,
        outcome: null,
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
      const params = numberLineParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round an exact tap. The fabricated
      // closeness values make the normalizer produce exactly 1.0 and the
      // record stays fully deterministic (and flagged `forced`).
      const stats: NumberLineStats = {
        score: perfectSessionScore(params),
        roundsPlayed: total,
        roundsHit: total,
        bestStreak: total,
        streak: total,
        totalCloseness: total,
        bestCloseness: 1,
        totalAbsoluteError: 0,
        timeouts: 0,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        estimateValue: null,
        outcome: null,
        forced: true,
        stats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = numberLineParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round missed (normalized 0).
      const stats: NumberLineStats = {
        ...INITIAL_STATS,
        roundsPlayed: total,
        totalAbsoluteError: total * (params.lineMax - params.lineMin),
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        estimateValue: null,
        outcome: null,
        forced: true,
        stats,
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
