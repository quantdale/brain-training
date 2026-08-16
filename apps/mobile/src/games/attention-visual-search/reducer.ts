/**
 * Pure game state machine for the Visual Search game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the countdown
 * tick interval, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing model: the reducer never reads a clock. The screen dispatches
 * `tick`/`tap-tile`/`pause`/`resume` actions carrying `nowMs` from the
 * injected monotonic clock (the SDK `systemClock` in production, a fake clock
 * in tests). All deadlines are absolute monotonic instants, so the same
 * action stream always produces the same state.
 *
 * Pause semantics: pausing records `pausedAtMs`; resuming shifts every
 * deadline by the paused duration, so a paused round/session cannot expire
 * while hidden — the pause exactly freezes the timers (matching the SDK
 * lifecycle's active-time accounting).
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  DISTRACTOR_PENALTY_MS,
  gridSizeFor,
  nextAdaptiveWindow,
  resolveVisualSearchDifficulty,
  visualSearchParamsFromProfile,
  windowMsFor,
} from './difficulty';
import { generateRoundTarget } from './generator';
import { clamp01, perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialVisualSearchState } from './types';
import type { VisualSearchAction, VisualSearchGameState, VisualSearchStats } from './types';

export { createInitialVisualSearchState };

/** Clamp a reported clock reading to stay monotonic (defensive). */
function advanceNow(state: VisualSearchGameState, nowMs: number): number {
  return Math.max(nowMs, state.nowMs);
}

/** Count a failed round (timeout or distractor): played, streak reset. */
function failRoundStats(stats: VisualSearchStats): VisualSearchStats {
  return { ...stats, roundsPlayed: stats.roundsPlayed + 1, streak: 0 };
}

export function visualSearchGameReducer(
  state: VisualSearchGameState,
  action: VisualSearchAction,
): VisualSearchGameState {
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
      const profile = resolveVisualSearchDifficulty(state.difficulty);
      const params = visualSearchParamsFromProfile(profile);
      const gridSize = gridSizeFor(params, 0);
      const windowMs = params.initialWindowMs;
      const targetIndex = generateRoundTarget({
        rng: createRng(action.seed),
        roundIndex: 0,
        gridSize,
        prevTargetIndex: null,
      });
      return {
        ...state,
        phase: 'playing',
        paused: false,
        pausedAtMs: null,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        nowMs: action.nowMs,
        sessionDeadlineMs: action.nowMs + params.sessionDurationMs,
        roundIndex: 0,
        gridSize,
        windowMs,
        targetIndex,
        roundDeadlineMs: action.nowMs + windowMs,
        roundOutcome: null,
        failReason: null,
        lastTapIndex: null,
        lastResponseMs: 0,
        lastRoundPoints: 0,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'tick': {
      if (state.paused) {
        return state;
      }
      const nowMs = advanceNow(state, action.nowMs);
      // The score-attack budget is authoritative: when it runs out, the
      // session ends even mid-round (an unfinished round is not counted).
      if (nowMs >= state.sessionDeadlineMs) {
        if (state.phase === 'playing' || state.phase === 'roundResult') {
          return {
            ...state,
            nowMs,
            phase: 'results',
            paused: false,
            pausedAtMs: null,
            roundOutcome: null,
          };
        }
        return { ...state, nowMs };
      }
      if (state.phase === 'playing' && nowMs >= state.roundDeadlineMs) {
        return {
          ...state,
          nowMs,
          phase: 'roundResult',
          roundOutcome: 'failed',
          failReason: 'timeout',
          lastTapIndex: null,
          stats: failRoundStats(state.stats),
        };
      }
      return { ...state, nowMs };
    }

    case 'tap-tile': {
      if (state.phase !== 'playing' || state.paused) {
        return state;
      }
      const nowMs = advanceNow(state, action.nowMs);
      if (nowMs >= state.sessionDeadlineMs) {
        return {
          ...state,
          nowMs,
          phase: 'results',
          paused: false,
          pausedAtMs: null,
          roundOutcome: null,
        };
      }
      if (nowMs >= state.roundDeadlineMs) {
        // The tap arrived after the window closed: it counts as a timeout,
        // not as a (penalized) distractor tap.
        return {
          ...state,
          nowMs,
          phase: 'roundResult',
          roundOutcome: 'failed',
          failReason: 'timeout',
          lastTapIndex: null,
          stats: failRoundStats(state.stats),
        };
      }

      if (action.index === state.targetIndex) {
        const remainingMs = Math.max(0, state.roundDeadlineMs - nowMs);
        const responseMs = Math.max(0, state.windowMs - remainingMs);
        const ratio = clamp01(state.windowMs > 0 ? remainingMs / state.windowMs : 0);
        const points = roundScore(state.windowMs, remainingMs);
        const streak = state.stats.streak + 1;
        const stats: VisualSearchStats = {
          score: state.stats.score + points,
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          totalTaps: state.stats.totalTaps + 1,
          correctTaps: state.stats.correctTaps + 1,
          sumResponseMs: state.stats.sumResponseMs + responseMs,
          sumResponseRatio: state.stats.sumResponseRatio + ratio,
          fastestResponseMs:
            state.stats.fastestResponseMs === 0
              ? responseMs
              : Math.min(state.stats.fastestResponseMs, responseMs),
        };
        return {
          ...state,
          nowMs,
          phase: 'roundResult',
          roundOutcome: 'passed',
          failReason: null,
          lastTapIndex: action.index,
          lastResponseMs: responseMs,
          lastRoundPoints: points,
          stats,
        };
      }

      // Distractor: the round fails immediately and the session clock is
      // docked (small time cost). The expiry check runs on the next tick.
      return {
        ...state,
        nowMs,
        phase: 'roundResult',
        roundOutcome: 'failed',
        failReason: 'distractor',
        lastTapIndex: action.index,
        sessionDeadlineMs: state.sessionDeadlineMs - DISTRACTOR_PENALTY_MS,
        stats: {
          ...failRoundStats(state.stats),
          totalTaps: state.stats.totalTaps + 1,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      if (state.nowMs >= state.sessionDeadlineMs) {
        return { ...state, phase: 'results', paused: false, pausedAtMs: null, roundOutcome: null };
      }
      const params = visualSearchParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', paused: false, pausedAtMs: null, roundOutcome: null };
      }
      const gridSize = gridSizeFor(params, nextIndex);
      const windowMs =
        state.difficulty === 'adaptive'
          ? nextAdaptiveWindow(state.windowMs, state.roundOutcome === 'passed', params)
          : windowMsFor(params, nextIndex);
      const targetIndex = generateRoundTarget({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        gridSize,
        prevTargetIndex: state.targetIndex,
      });
      return {
        ...state,
        phase: 'playing',
        paused: false,
        pausedAtMs: null,
        roundIndex: nextIndex,
        gridSize,
        windowMs,
        targetIndex,
        roundDeadlineMs: state.nowMs + windowMs,
        roundOutcome: null,
        failReason: null,
        lastTapIndex: null,
        lastResponseMs: 0,
        lastRoundPoints: 0,
      };
    }

    case 'pause': {
      if (state.paused || (state.phase !== 'playing' && state.phase !== 'roundResult')) {
        return state;
      }
      return { ...state, paused: true, pausedAtMs: action.nowMs, nowMs: action.nowMs };
    }

    case 'resume': {
      if (!state.paused || state.pausedAtMs === null) {
        return state;
      }
      // Shift every deadline by the paused duration so the round/session
      // clocks froze while hidden (pause must never extend or shorten play).
      const shift = Math.max(0, action.nowMs - state.pausedAtMs);
      return {
        ...state,
        paused: false,
        pausedAtMs: null,
        nowMs: action.nowMs,
        sessionDeadlineMs: state.sessionDeadlineMs + shift,
        roundDeadlineMs: state.roundDeadlineMs + shift,
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

    case 'qa/force-win': {
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = visualSearchParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        pausedAtMs: null,
        roundOutcome: null,
        failReason: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          totalTaps: rounds,
          correctTaps: rounds,
          sumResponseMs: 0,
          // Instant taps: mean remaining-window ratio 1 → normalized 1.0.
          sumResponseRatio: rounds,
          fastestResponseMs: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round (playing) counts as failed; a round already
      // scored in `roundResult` stays as-is.
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        pausedAtMs: null,
        roundOutcome: null,
        failReason: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
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
