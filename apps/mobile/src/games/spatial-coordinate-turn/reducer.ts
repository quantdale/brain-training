/**
 * Pure game state machine for the Spatial Coordinate Turn game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, tutorial state, and persistence.
 *
 * Round flow: `intro` → start-session → `brief` (read the command list +
 * compass; time-boxed per tier, auto-advances when study time expires) →
 * `brief-tick`/`next-round` → `choice` (options revealed) → `select-answer` →
 * `roundResult` → `next-round` → next `brief` … → `results`. This two-step
 * per round keeps the answer hidden until the player has studied the brief.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { isDifficultyLevel } from '@/sdk';

import {
  resolveSpatialCoordinateTurnDifficulty,
  spatialCoordinateTurnParamsFromProfile,
} from './difficulty';
import { generateSession } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialSpatialCoordinateTurnState } from './types';
import type {
  SpatialCoordinateTurnAction,
  SpatialCoordinateTurnGameState,
  SpatialCoordinateTurnRound,
  SpatialCoordinateTurnStats,
} from './types';

export { createInitialSpatialCoordinateTurnState };

export function gameReducer(
  state: SpatialCoordinateTurnGameState,
  action: SpatialCoordinateTurnAction,
): SpatialCoordinateTurnGameState {
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
      const profile = resolveSpatialCoordinateTurnDifficulty(state.difficulty);
      const params = spatialCoordinateTurnParamsFromProfile(profile);
      const plan = generateSession(action.seed, params);
      return {
        ...state,
        phase: 'brief',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        rounds: plan.length,
        plan,
        round: plan.length > 0 ? plan[0] : null,
        selectedOptionIndex: null,
        roundOutcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'brief-tick': {
      // The screen paces active (non-paused) study ticks and dispatches this
      // when the per-tier brief budget is spent: auto-transition to answering
      // so players cannot pre-solve indefinitely for a free speed bonus.
      if (state.phase !== 'brief' || state.paused) {
        return state;
      }
      return { ...state, phase: 'choice' };
    }

    case 'select-answer': {
      if (
        state.phase !== 'choice' ||
        state.paused ||
        state.profile === null ||
        state.round === null
      ) {
        return state;
      }
      const params = spatialCoordinateTurnParamsFromProfile(state.profile);
      const round = state.round;
      const correct = action.index === round.correctIndex;
      const responseMs = action.answerMs;
      const isPosition = round.task === 'position';

      const baseStats: SpatialCoordinateTurnStats = {
        ...state.stats,
        roundsPlayed: state.stats.roundsPlayed + 1,
        scoredPicks: state.stats.scoredPicks + 1,
        totalResponseMs: state.stats.totalResponseMs + responseMs,
        positionTrials: state.stats.positionTrials + (isPosition ? 1 : 0),
      };

      if (correct) {
        const streak = state.stats.streak + 1;
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'correct',
          selectedOptionIndex: action.index,
          stats: {
            ...baseStats,
            score: state.stats.score + roundScore(true, responseMs, params.speedTargetMs),
            correctPicks: state.stats.correctPicks + 1,
            bestStreak: Math.max(state.stats.bestStreak, streak),
            streak,
            positionCorrect: state.stats.positionCorrect + (isPosition ? 1 : 0),
          },
        };
      }

      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'wrong',
        selectedOptionIndex: action.index,
        stats: {
          ...baseStats,
          mistakes: state.stats.mistakes + 1,
          streak: 0,
        },
      };
    }

    case 'next-round': {
      if (state.phase === 'brief') {
        // Reveal the answer options for the current round.
        return { ...state, phase: 'choice' };
      }
      if (state.phase === 'roundResult') {
        const nextIndex = state.roundIndex + 1;
        if (nextIndex >= state.rounds || state.profile === null) {
          return { ...state, phase: 'results', roundOutcome: null };
        }
        const round: SpatialCoordinateTurnRound = state.plan[nextIndex];
        return {
          ...state,
          phase: 'brief',
          roundIndex: nextIndex,
          round,
          selectedOptionIndex: null,
          roundOutcome: null,
        };
      }
      return state;
    }

    case 'pause': {
      if (
        state.paused ||
        state.phase === 'results' ||
        state.phase === 'intro' ||
        state.round === null
      ) {
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = spatialCoordinateTurnParamsFromProfile(state.profile);
      const plan = generateSession(state.seed, params);
      const positionCount = plan.filter((r) => r.task === 'position').length;
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
          correctPicks: params.rounds,
          mistakes: 0,
          bestStreak: params.rounds,
          streak: params.rounds,
          scoredPicks: params.rounds,
          positionTrials: positionCount,
          positionCorrect: positionCount,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const inFlight = state.phase === 'brief' || state.phase === 'choice';
      const stats: SpatialCoordinateTurnStats = inFlight
        ? {
            ...state.stats,
            roundsPlayed: state.stats.roundsPlayed + 1,
            mistakes: state.stats.mistakes + 1,
            streak: 0,
          }
        : state.stats;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats,
      };
    }

    case 'qa/force-timeout': {
      // Dev-only entry point (screen gates it behind isDevBuild). Ends the
      // session with whatever was achieved so far — the clock "expired" mid-run
      // so the in-flight round is NOT scored and no penalty is added. Unplayed
      // remaining rounds are simply omitted, mirroring a real timeout.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        selectedOptionIndex: null,
        round: null,
        forced: true,
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
      return state;
    }
  }
}
