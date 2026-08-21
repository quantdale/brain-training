/**
 * Pure game state machine for the Spatial Fold Match game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: source reveal
 * pacing timers, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  nextFilledCells,
  nextOptionCount,
  spatialFoldMatchParamsFromProfile,
  resolveSpatialFoldMatchDifficulty,
} from './difficulty';
import { generateRoundData } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { FOLD_LABELS, INITIAL_STATS, createInitialSpatialFoldMatchState } from './types';
import type {
  SpatialFoldMatchAction,
  SpatialFoldMatchGameState,
  SpatialFoldMatchStats,
} from './types';

export { createInitialSpatialFoldMatchState };

/** Generate the round data fields for the given round index from current state. */
function generateForRound(state: SpatialFoldMatchGameState, roundIndex: number) {
  const params = spatialFoldMatchParamsFromProfile(state.profile!);
  const rng = createRng(state.seed);
  const data = generateRoundData({
    rng,
    roundIndex,
    gridRows: params.gridRows,
    gridCols: params.gridCols,
    filledCells: params.filledCells,
    foldsAllowed: params.foldsAllowed,
    optionCount: params.optionCount,
    prevSource: state.prevSourceGrid,
    prevFold: state.prevFoldType,
  });
  return {
    sourceGrid: data.source,
    foldType: data.foldType,
    foldLabel: FOLD_LABELS[data.foldType],
    resultRows: data.resultRows,
    resultCols: data.resultCols,
    options: data.options,
    correctOptionIndex: data.correctOptionIndex,
  };
}

export function gameReducer(
  state: SpatialFoldMatchGameState,
  action: SpatialFoldMatchAction,
): SpatialFoldMatchGameState {
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
      const profile = resolveSpatialFoldMatchDifficulty(state.difficulty);
      // Round 0 never has a predecessor: drop any stale anchor from a
      // previous session so the same seed always regenerates the same round.
      const round = generateForRound(
        { ...state, profile, seed: action.seed, prevSourceGrid: null, prevFoldType: null },
        0,
      );
      return {
        ...state,
        phase: 'source',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        ...round,
        selectedOptionIndex: null,
        roundOutcome: null,
        prevFoldType: null,
        prevSourceGrid: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'source-tick': {
      if (state.phase !== 'source' || state.paused) {
        return state;
      }
      // Source reveal complete: transition to choice phase.
      return { ...state, phase: 'choice' };
    }

    case 'select-option': {
      if (state.phase !== 'choice' || state.paused || state.profile === null) {
        return state;
      }
      const correct = action.index === state.correctOptionIndex;
      const params = spatialFoldMatchParamsFromProfile(state.profile);
      const answerMs = action.answerMs;

      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: SpatialFoldMatchStats = {
          score: state.stats.score + roundScore(true, answerMs, params.sourceRevealMs),
          roundsPlayed: state.stats.roundsPlayed + 1,
          roundsPassed: state.stats.roundsPassed + 1,
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
          totalAnswerMs: state.stats.totalAnswerMs + answerMs,
        };
        return {
          ...state,
          phase: 'roundResult',
          roundOutcome: 'passed',
          selectedOptionIndex: action.index,
          stats,
        };
      }

      // Wrong option: the round fails immediately.
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: 'failed',
        selectedOptionIndex: action.index,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + 1,
          streak: 0,
          totalAnswerMs: state.stats.totalAnswerMs + answerMs,
        },
      };
    }

    case 'next-round': {
      if (
        state.phase !== 'roundResult' ||
        state.profile === null ||
        state.difficulty === null
      ) {
        return state;
      }
      const params = spatialFoldMatchParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;

      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes.
        return { ...state, phase: 'results', roundOutcome: null };
      }

      const passed = state.roundOutcome === 'passed';
      // For adaptive difficulty, re-resolve with updated params.
      let profile = state.profile;
      if (state.difficulty === 'adaptive') {
        const newFilledCells = nextFilledCells(params.filledCells, passed, 'adaptive', params);
        const newOptionCount = nextOptionCount(params.optionCount, passed, 'adaptive', params);
        profile = resolveSpatialFoldMatchDifficulty('adaptive');
        // Override the resolved params with the adapted values.
        profile = {
          ...profile,
          parameters: {
            ...profile.parameters,
            filledCells: newFilledCells,
            optionCount: newOptionCount,
          },
        };
      }

      const round = generateForRound(
        { ...state, profile, seed: state.seed, prevSourceGrid: state.sourceGrid, prevFoldType: state.foldType },
        nextIndex,
      );

      return {
        ...state,
        phase: 'source',
        profile,
        roundIndex: nextIndex,
        ...round,
        selectedOptionIndex: null,
        roundOutcome: null,
        prevFoldType: state.foldType,
        prevSourceGrid: state.sourceGrid,
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = spatialFoldMatchParamsFromProfile(state.profile);
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
          roundsPassed: params.rounds,
          bestStreak: params.rounds,
          streak: params.rounds,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
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
