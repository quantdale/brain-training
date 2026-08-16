/**
 * Pure game state machine for the Next in Sequence game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: response-time
 * measurement (SDK monotonic clock), the `SessionLifecycle`, tutorial state,
 * and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  logicParamsFromProfile,
  nextAdaptiveTier,
  referenceMsForTier,
  resolveLogicDifficulty,
} from './difficulty';
import { generatePuzzle } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialLogicState } from './types';
import type { LogicAction, LogicGameState, LogicStats } from './types';

export { createInitialLogicState };

export function logicGameReducer(
  state: LogicGameState,
  action: LogicAction,
): LogicGameState {
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
      const profile = resolveLogicDifficulty(state.difficulty);
      const params = logicParamsFromProfile(profile);
      const tier = params.recipeTier;
      const puzzle = generatePuzzle({
        rng: createRng(action.seed),
        roundIndex: 0,
        tier,
        params,
        prevPuzzle: null,
      });
      return {
        ...state,
        phase: 'question',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        tier,
        puzzle,
        selection: null,
        roundOutcome: null,
        prevPuzzle: null,
        stats: { ...INITIAL_STATS, targetMs: referenceMsForTier(tier) },
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
        state.puzzle === null ||
        state.profile === null ||
        state.difficulty === null ||
        state.selection !== null
      ) {
        return state;
      }
      const correct = action.index === state.puzzle.answerIndex;
      const responseMs = Math.max(0, action.responseMs);
      const referenceMs = referenceMsForTier(state.tier);
      const baseStats: LogicStats = {
        ...state.stats,
        roundsPlayed: state.stats.roundsPlayed + 1,
        totalMs: state.stats.totalMs + responseMs,
        fastestMs:
          state.stats.fastestMs === null
            ? responseMs
            : Math.min(state.stats.fastestMs, responseMs),
      };

      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: LogicStats = {
          ...baseStats,
          score: state.stats.score + roundScore(responseMs, referenceMs, true),
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
        };
        return {
          ...state,
          phase: 'roundResult',
          selection: action.index,
          roundOutcome: 'passed',
          stats,
        };
      }

      return {
        ...state,
        phase: 'roundResult',
        selection: action.index,
        roundOutcome: 'failed',
        stats: { ...baseStats, streak: 0 },
      };
    }

    case 'next-round': {
      if (
        state.phase !== 'roundResult' ||
        state.profile === null ||
        state.difficulty === null ||
        state.puzzle === null
      ) {
        return state;
      }
      const params = logicParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null, selection: null };
      }
      const passed = state.roundOutcome === 'passed';
      const tier =
        state.difficulty === 'adaptive'
          ? nextAdaptiveTier(state.tier, passed, params)
          : state.tier;
      const puzzle = generatePuzzle({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        tier,
        params,
        prevPuzzle: state.puzzle,
      });
      return {
        ...state,
        phase: 'question',
        roundIndex: nextIndex,
        tier,
        puzzle,
        selection: null,
        roundOutcome: null,
        prevPuzzle: state.puzzle,
        stats: { ...state.stats, targetMs: state.stats.targetMs + referenceMsForTier(tier) },
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

    case 'qa/force-win': {
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = logicParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        selection: null,
        forced: true,
        // Perfect run at perfect speed: resets timing so the normalized
        // performance is exactly 1 regardless of how far the session got.
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          totalMs: 0,
          targetMs: 0,
          fastestMs: null,
        },
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
        selection: null,
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
