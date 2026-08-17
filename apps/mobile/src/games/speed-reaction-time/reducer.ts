/**
 * Pure game state machine for the Reaction Time game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the GO-signal and
 * timeout timers, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing invariants:
 * - `delayMs` (wait before GO) is generated deterministically per round.
 * - `goAtMs` is the monotonic clock reading at the moment GO is displayed; the
 *   screen captures it when the GO timer fires. Reaction time is
 *   `clock.now() - goAtMs` at tap time, so timer jitter never distorts a
 *   measured reaction.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextDelayMinMs,
  resolveSpeedDifficulty,
  speedParamsFromProfile,
} from './difficulty';
import { generateRoundDelay } from './generator';
import { bestOf, meanOf, medianOf, perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialSpeedState } from './types';
import type { SpeedAction, SpeedGameState, SpeedStats } from './types';

export { createInitialSpeedState };

export function speedGameReducer(
  state: SpeedGameState,
  action: SpeedAction,
): SpeedGameState {
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
      const profile = resolveSpeedDifficulty(state.difficulty);
      const params = speedParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const delayMinMs = params.minDelayMs;
      const delayMs = generateRoundDelay({
        rng,
        roundIndex: 0,
        minDelayMs: delayMinMs,
        maxDelayMs: params.maxDelayMs,
      });
      return {
        ...state,
        phase: 'wait',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        delayMinMs,
        delayMs,
        goAtMs: null,
        roundOutcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'go': {
      // Normal path: wait → go. Resume path: go → go (the screen refreshes
      // `goAtMs` after a pause so the measured reaction window restarts at the
      // moment the GO signal is displayed again).
      if (state.phase !== 'wait' && state.phase !== 'go') {
        return state;
      }
      return { ...state, phase: 'go', goAtMs: action.goAtMs };
    }

    case 'tap': {
      if (state.phase !== 'go' || state.profile === null || state.goAtMs === null) {
        return state;
      }
      // Monotonic-clock invariant: a reaction can never be negative in
      // practice; reject such readings instead of corrupting the stats.
      if (action.rtMs < 0) {
        return state;
      }
      const params = speedParamsFromProfile(state.profile);
      const reactions = [...state.stats.reactions, action.rtMs];
      const passed = action.rtMs <= params.passMs;
      const stats: SpeedStats = {
        reactions,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (passed ? 1 : 0),
        falseStarts: state.stats.falseStarts,
        timeouts: state.stats.timeouts,
        bestReactionMs: bestOf(reactions),
        medianReactionMs: medianOf(reactions),
        meanReactionMs: meanOf(reactions),
        falseStartAborted: state.stats.falseStartAborted,
        score: state.stats.score + roundScore(action.rtMs, params.targetMs, params.passMs),
      };
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: passed ? 'passed' : 'failed',
        stats,
      };
    }

    case 'false-start': {
      if (state.phase !== 'wait' || state.profile === null) {
        return state;
      }
      const params = speedParamsFromProfile(state.profile);
      const falseStarts = state.stats.falseStarts + 1;
      if (falseStarts > params.falseStartBudget) {
        // Budget exhausted: the session ends immediately (early abort).
        return {
          ...state,
          phase: 'results',
          paused: false,
          roundOutcome: null,
          stats: {
            ...state.stats,
            roundsPlayed: state.stats.roundsPlayed + 1,
            falseStarts,
            falseStartAborted: true,
          },
        };
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'false-start',
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          falseStarts,
        },
      };
    }

    case 'round-timeout': {
      if (state.phase !== 'go') {
        return state;
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          timeouts: state.stats.timeouts + 1,
        },
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = speedParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'passed';
      const delayMinMs = nextDelayMinMs(state.delayMinMs, passed, state.difficulty, params);
      const delayMs = generateRoundDelay({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        minDelayMs: delayMinMs,
        maxDelayMs: params.maxDelayMs,
      });
      return {
        ...state,
        phase: 'wait',
        roundIndex: nextIndex,
        delayMinMs,
        delayMs,
        goAtMs: null,
        roundOutcome: null,
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
      const params = speedParamsFromProfile(state.profile);
      // "All perfect reactions": every round reacted at target speed.
      const reactions = Array.from({ length: params.rounds }, () => params.targetMs);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          reactions,
          roundsPlayed: params.rounds,
          roundsPassed: params.rounds,
          falseStarts: 0,
          timeouts: 0,
          bestReactionMs: params.targetMs,
          medianReactionMs: params.targetMs,
          meanReactionMs: params.targetMs,
          falseStartAborted: false,
          score: perfectSessionScore(params),
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // False-start storm: the session ends aborted with no valid reactions.
      const params = speedParamsFromProfile(state.profile);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          reactions: [],
          roundsPlayed: params.rounds,
          roundsPassed: 0,
          falseStarts: params.falseStartBudget + 1,
          timeouts: 0,
          bestReactionMs: null,
          medianReactionMs: null,
          meanReactionMs: null,
          falseStartAborted: true,
          score: 0,
        },
      };
    }

    case 'qa/force-timeout': {
      // Dev-only per-round shortcut: the current wait/go round fails as a
      // timeout. Does not end the session, so `forced` stays untouched.
      if (state.phase !== 'wait' && state.phase !== 'go') {
        return state;
      }
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'timeout',
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          timeouts: state.stats.timeouts + 1,
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
