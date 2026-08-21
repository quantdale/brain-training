/**
 * Pure game state machine for the Value Order game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-round
 * budget ticker, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing model (mirrors math-number-line-estimation): the reducer never reads
 * a clock. `round-tick` and `tap-tile` carry `atActiveMs` — the
 * SessionLifecycle's active-only elapsed ms (paused segments are excluded by
 * the lifecycle) — and the reducer derives
 * `roundElapsedMs = atActiveMs − roundStartActiveMs`. Pausing therefore
 * freezes the budget exactly; a player can never gain time, and timeouts are
 * checked in the reducer so they are fully unit-testable.
 *
 * Correctness guards: a tile can be tapped only once per round (tapped tiles
 * are ignored); taps past the budget are scored as timeouts (a tick may not
 * have fired yet at tap time — both paths converge on the same outcome), so
 * duplicate taps and timer/dispatch races cannot double-score. A wrong tap
 * (not the minimum remaining value) resolves the round immediately as a
 * mistake; values are pairwise distinct by construction, so "the minimum" is
 * always unambiguous.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextTileCount,
  valueOrderingParamsFromProfile,
  resolveValueOrderingDifficulty,
} from './difficulty';
import { generateRound, sortedValuesOf } from './generator';
import { perfectSessionScore, roundScore, speedFactorOf } from './scoring';
import { INITIAL_STATS, createInitialValueOrderingState } from './types';
import type {
  RoundOutcome,
  ValueOrderingAction,
  ValueOrderingGameState,
  ValueOrderingStats,
} from './types';

export { createInitialValueOrderingState };

/** Params of the *current* round, matching the tile count it was generated at. */
function currentParams(state: ValueOrderingGameState): ReturnType<typeof valueOrderingParamsFromProfile> {
  const base = valueOrderingParamsFromProfile(state.profile as DifficultyProfile);
  if (state.difficulty !== 'adaptive') {
    return base;
  }
  // The live round was generated with the tile count recorded in state.
  return { ...base, tiles: state.tiles };
}

/** Fold one resolved round into the stats. */
function applyRoundOutcome(
  stats: ValueOrderingStats,
  outcome: RoundOutcome,
  speedFactor: number,
  progress: number,
): ValueOrderingStats {
  const perfect = outcome === 'perfect';
  const streak = perfect ? stats.streak + 1 : 0;
  return {
    score: stats.score + (perfect ? roundScore(speedFactor) : 0),
    roundsPlayed: stats.roundsPlayed + 1,
    roundsHit: stats.roundsHit + (perfect ? 1 : 0),
    bestStreak: Math.max(stats.bestStreak, streak),
    streak,
    totalSpeedFactor: stats.totalSpeedFactor + (perfect ? speedFactor : 0),
    bestSpeedFactor: Math.max(stats.bestSpeedFactor, perfect ? speedFactor : 0),
    totalProgress: stats.totalProgress + progress,
    mistakes: stats.mistakes + (outcome === 'mistake' ? 1 : 0),
    timeouts: stats.timeouts + (outcome === 'timeout' ? 1 : 0),
  };
}

/** Resolve the live round against an outcome and advance to feedback. */
function resolveRound(
  state: ValueOrderingGameState,
  outcome: RoundOutcome,
  elapsedMs: number,
  mistakeTileId: string | null,
): ValueOrderingGameState {
  const params = currentParams(state);
  const round = state.round;
  if (round === null) {
    return state;
  }
  // Convergence guard: a "perfect" resolution at/past the budget is a
  // timeout (the guarded tap/tick paths normally prevent this).
  const resolvedOutcome: RoundOutcome =
    outcome === 'perfect' && params.budgetMs > 0 && elapsedMs >= params.budgetMs
      ? 'timeout'
      : outcome;
  const speedFactor =
    resolvedOutcome === 'perfect'
      ? speedFactorOf(Math.min(elapsedMs, params.budgetMs), params.budgetMs)
      : 0;
  const progress = state.tappedIds.length / round.tiles.length;

  return {
    ...state,
    phase: 'feedback',
    outcome: resolvedOutcome,
    mistakeTileId,
    roundElapsedMs: Math.min(elapsedMs, params.budgetMs),
    stats: applyRoundOutcome(state.stats, resolvedOutcome, speedFactor, progress),
  };
}

/** The untapped tile with the smallest comparison value (values distinct). */
function minimumRemainingTile(
  state: ValueOrderingGameState,
): { id: string; value: number } | null {
  const round = state.round;
  if (round === null) {
    return null;
  }
  const tapped = new Set(state.tappedIds);
  let best: { id: string; value: number } | null = null;
  for (const tile of round.tiles) {
    if (tapped.has(tile.id)) {
      continue;
    }
    if (best === null || tile.value < best.value) {
      best = { id: tile.id, value: tile.value };
    }
  }
  return best;
}

export function valueOrderingGameReducer(
  state: ValueOrderingGameState,
  action: ValueOrderingAction,
): ValueOrderingGameState {
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
      const profile = resolveValueOrderingDifficulty(state.difficulty);
      const params = valueOrderingParamsFromProfile(profile);
      const round = generateRound(createRng(action.seed), 0, params, params.tiles, null);
      return {
        ...state,
        phase: 'ordering',
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
        tiles: params.tiles,
        roundBudgetMs: params.budgetMs,
        roundStartActiveMs: 0,
        roundElapsedMs: 0,
        tappedIds: [],
        outcome: null,
        mistakeTileId: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
        // A previous session's server-authoritative outcome must not bleed
        // into the new one: the results row prefers `authoritativeXp`, so
        // stale values would show old numbers until (or unless) the new
        // persistence round completes.
        authoritativeXp: null,
        authoritativeCurrency: null,
        authoritativeDeltas: [],
      };
    }

    case 'round-tick': {
      if (state.phase !== 'ordering' || state.paused || state.roundBudgetMs <= 0) {
        return state;
      }
      const elapsed = Math.max(0, action.atActiveMs - state.roundStartActiveMs);
      if (elapsed >= state.roundBudgetMs) {
        return resolveRound(state, 'timeout', elapsed, null);
      }
      return { ...state, roundElapsedMs: elapsed };
    }

    case 'tap-tile': {
      if (state.phase !== 'ordering' || state.paused || state.round === null) {
        return state;
      }
      const round = state.round;
      const tile = round.tiles.find((candidate) => candidate.id === action.tileId);
      // Unknown ids and already-tapped tiles are ignored (double-tap guard).
      if (tile === undefined || state.tappedIds.includes(tile.id)) {
        return state;
      }
      const elapsed = Math.max(0, action.atActiveMs - state.roundStartActiveMs);
      const params = currentParams(state);
      // Past-budget taps are scored as timeouts (same outcome as the tick
      // path) so a slow frame can never convert into points.
      if (params.budgetMs > 0 && elapsed >= params.budgetMs) {
        return resolveRound(state, 'timeout', elapsed, null);
      }
      const minimum = minimumRemainingTile(state);
      if (minimum === null) {
        return state;
      }
      if (tile.id !== minimum.id) {
        // Wrong tap: the round ends immediately; feedback reveals the order.
        return resolveRound(state, 'mistake', elapsed, tile.id);
      }
      const tappedIds = [...state.tappedIds, tile.id];
      if (tappedIds.length === round.tiles.length) {
        // Last (largest) tile tapped in order: perfect round.
        return resolveRound({ ...state, tappedIds }, 'perfect', elapsed, null);
      }
      return { ...state, tappedIds, roundElapsedMs: elapsed };
    }

    case 'next-round': {
      if (state.phase !== 'feedback' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const baseParams = valueOrderingParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= baseParams.rounds) {
        // Last round resolved: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', round: null, outcome: null };
      }
      const roundPerfect = state.outcome === 'perfect';
      const tiles = nextTileCount(state.tiles, roundPerfect, state.difficulty, baseParams);
      const round = generateRound(
        createRng(state.seed),
        nextIndex,
        baseParams,
        tiles,
        sortedValuesOf(state.round ?? { tiles: [] }),
      );
      return {
        ...state,
        phase: 'ordering',
        roundIndex: nextIndex,
        round,
        tiles,
        roundStartActiveMs: action.startActiveMs,
        roundElapsedMs: 0,
        tappedIds: [],
        outcome: null,
        mistakeTileId: null,
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
      const params = valueOrderingParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round an instant perfect ranking. The
      // fabricated speed factors make the normalizer produce exactly 1.0 and
      // the record stays fully deterministic (and flagged `forced`).
      const stats: ValueOrderingStats = {
        score: perfectSessionScore(params),
        roundsPlayed: total,
        roundsHit: total,
        bestStreak: total,
        streak: total,
        totalSpeedFactor: total,
        bestSpeedFactor: 1,
        totalProgress: total,
        mistakes: 0,
        timeouts: 0,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        tappedIds: [],
        outcome: null,
        mistakeTileId: null,
        forced: true,
        stats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = valueOrderingParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round a first-tap mistake (normalized 0).
      const stats: ValueOrderingStats = {
        ...INITIAL_STATS,
        roundsPlayed: total,
        mistakes: total,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        tappedIds: [],
        outcome: null,
        mistakeTileId: null,
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
