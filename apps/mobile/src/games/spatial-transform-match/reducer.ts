/**
 * Pure game state machine for the Spatial Transform Match game.
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
import type { DifficultyProfile } from '@/sdk';

import {
  nextFilledCells,
  nextOptionCount,
  paramsFromProfile,
  resolveGameDifficulty,
} from './difficulty';
import { generateRoundData } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, TRANSFORM_LABELS, createInitialState } from './types';
import type {
  SpatialTransformMatchAction,
  SpatialTransformMatchGameState,
  SpatialTransformMatchStats,
} from './types';

export { createInitialState };

/** Compute the grid side length from gridSize. */
function sideFromGridSize(gridSize: number): number {
  return Math.round(Math.sqrt(gridSize));
}

/**
 * Generate data for the given round index using the current state's params.
 * Returns the fields that need to be merged into the state.
 */
function generateForRound(state: SpatialTransformMatchGameState, roundIndex: number) {
  const params = paramsFromProfile(state.profile!);
  const side = sideFromGridSize(params.gridSize);
  const rng = createRng(state.seed);
  const data = generateRoundData({
    rng,
    roundIndex,
    gridSize: params.gridSize,
    side,
    filledCells: params.filledCells,
    allowedTransforms: params.allowedTransforms,
    optionCount: params.optionCount,
    prevSource: state.prevSourcePattern,
    prevTransform: state.prevTransformType,
  });
  return {
    side,
    sourcePattern: data.source,
    transformType: data.transformType,
    transformLabel: TRANSFORM_LABELS[data.transformType],
    options: data.options,
    correctOptionIndex: data.correctOptionIndex,
  };
}

export function gameReducer(
  state: SpatialTransformMatchGameState,
  action: SpatialTransformMatchAction,
): SpatialTransformMatchGameState {
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
      const profile = resolveGameDifficulty(state.difficulty);
      const round = generateForRound({ ...state, profile, seed: action.seed }, 0);
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
        prevTransformType: null,
        prevSourcePattern: null,
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
      const params = paramsFromProfile(state.profile);
      const answerMs = action.answerMs;

      if (correct) {
        const streak = state.stats.streak + 1;
        const stats: SpatialTransformMatchStats = {
          score: state.stats.score + roundScore(),
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
      const params = paramsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;

      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes.
        return { ...state, phase: 'results', roundOutcome: null };
      }

      const passed = state.roundOutcome === 'passed';
      // For adaptive difficulty, re-resolve with updated params.
      let profile = state.profile;
      let resolvedParams = params;
      if (state.difficulty === 'adaptive') {
        const newFilledCells = nextFilledCells(params.filledCells, passed, 'adaptive', params);
        const newOptionCount = nextOptionCount(params.optionCount, passed, 'adaptive', params);
        profile = resolveGameDifficulty('adaptive');
        // Override the resolved params with the adapted values.
        profile = {
          ...profile,
          parameters: {
            ...profile.parameters,
            filledCells: newFilledCells,
            optionCount: newOptionCount,
          },
        };
        resolvedParams = paramsFromProfile(profile);
      }

      const side = sideFromGridSize(resolvedParams.gridSize);
      const rng = createRng(state.seed);
      const data = generateRoundData({
        rng,
        roundIndex: nextIndex,
        gridSize: resolvedParams.gridSize,
        side,
        filledCells: resolvedParams.filledCells,
        allowedTransforms: resolvedParams.allowedTransforms,
        optionCount: resolvedParams.optionCount,
        prevSource: state.sourcePattern,
        prevTransform: state.transformType,
      });

      return {
        ...state,
        phase: 'source',
        profile,
        roundIndex: nextIndex,
        side,
        sourcePattern: data.source,
        transformType: data.transformType,
        transformLabel: TRANSFORM_LABELS[data.transformType],
        options: data.options,
        correctOptionIndex: data.correctOptionIndex,
        selectedOptionIndex: null,
        roundOutcome: null,
        prevTransformType: state.transformType,
        prevSourcePattern: state.sourcePattern,
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = paramsFromProfile(state.profile);
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
