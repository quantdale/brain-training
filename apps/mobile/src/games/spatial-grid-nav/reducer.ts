/**
 * Pure game state machine for the Spatial Grid Navigator game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { isDifficultyLevel } from '@/sdk';

import {
  paramsFromProfile,
  resolveSpatialGridNavDifficulty,
} from './difficulty';
import { generateSession } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialState } from './types';
import type {
  GeneratedRound,
  SpatialGridNavAction,
  SpatialGridNavGameState,
  SpatialGridNavStats,
} from './types';

export { createInitialState };

/** Whether a round counts as "hard" for normalization (commandCount-based). */
function isHardRound(round: GeneratedRound, longThreshold: number): boolean {
  return round.commandCount >= longThreshold;
}

export function gameReducer(
  state: SpatialGridNavGameState,
  action: SpatialGridNavAction,
): SpatialGridNavGameState {
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
      const profile = resolveSpatialGridNavDifficulty(state.difficulty);
      const params = paramsFromProfile(profile);
      const plan = generateSession(action.seed, params);
      return {
        ...state,
        phase: 'trialActive',
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

    case 'pick-cell': {
      if (state.phase !== 'trialActive' || state.paused || state.profile === null || state.round === null) {
        return state;
      }
      const params = paramsFromProfile(state.profile);
      const round = state.round;
      const correct = action.index === round.correctIndex;
      const hard = isHardRound(round, params.longThreshold);
      const responseMs = action.responseMs;

      const baseStats: SpatialGridNavStats = {
        ...state.stats,
        roundsPlayed: state.stats.roundsPlayed + 1,
        scoredPicks: state.stats.scoredPicks + 1,
        totalResponseMs: state.stats.totalResponseMs + responseMs,
        hardPlayed: state.stats.hardPlayed + (hard ? 1 : 0),
      };

      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: SpatialGridNavStats = {
          ...baseStats,
          score: state.stats.score + roundScore(true, responseMs, params.speedTargetMs),
          correctPicks: state.stats.correctPicks + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          hardCorrect: state.stats.hardCorrect + (hard ? 1 : 0),
        };
        return {
          ...state,
          phase: 'trialResult',
          roundOutcome: 'correct',
          selectedOptionIndex: action.index,
          stats,
        };
      }

      return {
        ...state,
        phase: 'trialResult',
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
      if (state.phase !== 'trialResult' || state.profile === null) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const round = state.plan[nextIndex];
      return {
        ...state,
        phase: 'trialActive',
        roundIndex: nextIndex,
        round,
        selectedOptionIndex: null,
        roundOutcome: null,
      };
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
      const params = paramsFromProfile(state.profile);
      const plan = generateSession(state.seed, params);
      const hardPlayed = plan.filter((r) => isHardRound(r, params.longThreshold)).length;
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
          hardPlayed,
          hardCorrect: hardPlayed,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'trialResult' ? 0 : 1;
      const countedRound = currentRoundCounted === 1 && state.round !== null
        ? state.round
        : null;
      const params = paramsFromProfile(state.profile);
      const hardIncrement =
        countedRound !== null && isHardRound(countedRound, params.longThreshold) ? 1 : 0;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          mistakes: state.stats.mistakes + (currentRoundCounted === 1 ? 1 : 0),
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
          hardPlayed: state.stats.hardPlayed + hardIncrement,
        },
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
