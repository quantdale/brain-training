/**
 * Pure game state machine for the Symbol Tracker game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: observe pacing
 * timer, the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * the tutorial, the dev-only QA panel, and result persistence.
 *
 * Mechanic recap: each round shows `tokenCount` distinct symbols and
 * highlights `trackCount` of them; after the observe window the board
 * scrambles (plus distractors) and the player must re-select the tracked
 * symbols by IDENTITY. Selections are symbol ids, not cell indexes, so a
 * symbol means the same thing on both boards.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextTrackCount,
  resolveSymbolTrackerDifficulty,
  symbolTrackerParamsFromProfile,
} from './difficulty';
import { EMPTY, generateRound } from './generator';
import { perfectSessionScore, referenceMaxRecall, roundScore } from './scoring';
import { INITIAL_STATS, createInitialSymbolTrackerState } from './types';
import type {
  SymbolTrackerAction,
  SymbolTrackerGameState,
  SymbolTrackerStats,
} from './types';

export { createInitialSymbolTrackerState };

export function symbolTrackerGameReducer(
  state: SymbolTrackerGameState,
  action: SymbolTrackerAction,
): SymbolTrackerGameState {
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
      const profile = resolveSymbolTrackerDifficulty(state.difficulty);
      const params = symbolTrackerParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const round = generateRound({
        rng,
        roundIndex: 0,
        gridSize: params.gridSize,
        tokenCount: params.tokenCount,
        trackCount: params.initialTrackCount,
        distractors: params.distractors,
        prevTracked: null,
      });
      return {
        ...state,
        phase: 'observe',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        trackCount: params.initialTrackCount,
        observeBoard: round.observeBoard,
        respondBoard: round.respondBoard,
        trackedSymbolIds: round.trackedSymbolIds,
        selections: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundWrongTaps: 0,
        roundOutcome: null,
        prevTracked: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'observe-tick': {
      // The observe window expired: scramble happened already (the respond
      // board was generated up front); reveal it.
      if (state.phase !== 'observe' || state.paused) {
        return state;
      }
      return { ...state, phase: 'respond', selections: [] };
    }

    case 'tap-cell': {
      if (state.phase !== 'respond' || state.paused || state.roundScored) {
        return state;
      }
      // Selections are symbol ids; empty cells are not selectable.
      const symbolId = state.respondBoard[action.index];
      if (symbolId === undefined || symbolId === EMPTY) {
        return state;
      }
      const selected = state.selections.includes(symbolId);
      if (selected) {
        return {
          ...state,
          selections: state.selections.filter((id) => id !== symbolId),
        };
      }
      return { ...state, selections: [...state.selections, symbolId] };
    }

    case 'submit': {
      if (state.phase !== 'respond' || state.paused || state.roundScored) {
        return state;
      }
      const trackedSet = new Set(state.trackedSymbolIds);
      const roundCorrectTargets = state.selections.filter((id) =>
        trackedSet.has(id),
      ).length;
      const roundWrongTaps = state.selections.filter(
        (id) => !trackedSet.has(id),
      ).length;
      const passed =
        roundCorrectTargets === state.trackCount && roundWrongTaps === 0;
      const fraction =
        state.trackCount > 0 ? roundCorrectTargets / state.trackCount : 0;
      const params = symbolTrackerParamsFromProfile(state.profile!);
      const roundPoints = Math.max(
        0,
        Math.round(
          roundScore(state.trackCount, params.initialTrackCount) * fraction,
        ) -
          25 * roundWrongTaps,
      );
      const streak = passed ? state.stats.streak + 1 : 0;
      const stats: SymbolTrackerStats = {
        score: state.stats.score + roundPoints,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsPassed: state.stats.roundsPassed + (passed ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        bestRecall: Math.max(state.stats.bestRecall, roundCorrectTargets),
        totalTargets: state.stats.totalTargets + state.trackCount,
        correctTargets: state.stats.correctTargets + roundCorrectTargets,
        wrongTaps: state.stats.wrongTaps + roundWrongTaps,
      };
      return {
        ...state,
        phase: 'roundResult',
        roundScored: true,
        roundCorrectTargets,
        roundWrongTaps,
        roundOutcome: passed ? 'passed' : 'failed',
        stats,
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
      const params = symbolTrackerParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const passed = state.roundOutcome === 'passed';
      const trackCount = nextTrackCount(
        state.trackCount,
        passed,
        state.difficulty,
        params,
      );
      const rng = createRng(state.seed);
      const round = generateRound({
        rng,
        roundIndex: nextIndex,
        gridSize: params.gridSize,
        tokenCount: params.tokenCount,
        trackCount,
        distractors: params.distractors,
        prevTracked: state.trackedSymbolIds,
      });
      return {
        ...state,
        phase: 'observe',
        roundIndex: nextIndex,
        trackCount,
        observeBoard: round.observeBoard,
        respondBoard: round.respondBoard,
        trackedSymbolIds: round.trackedSymbolIds,
        selections: [],
        roundScored: false,
        roundCorrectTargets: 0,
        roundWrongTaps: 0,
        roundOutcome: null,
        prevTracked: state.trackedSymbolIds,
      };
    }

    case 'pause': {
      if (
        state.paused ||
        state.phase === 'results' ||
        state.phase === 'intro'
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
      if (
        state.phase === 'results' ||
        state.phase === 'intro' ||
        state.profile === null
      ) {
        return state;
      }
      const params = symbolTrackerParamsFromProfile(state.profile);
      const rounds = params.rounds;
      const maxRef = referenceMaxRecall(params);
      let totalTargets = 0;
      for (let round = 0; round < rounds; round += 1) {
        totalTargets += Math.min(
          params.initialTrackCount + round,
          params.maxTrackCount ?? params.tokenCount,
          params.tokenCount,
        );
      }
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        roundScored: true,
        forced: true,
        stats: {
          ...state.stats,
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsPassed: rounds,
          bestStreak: rounds,
          streak: rounds,
          bestRecall: maxRef,
          totalTargets,
          correctTargets: totalTargets,
          wrongTaps: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (
        state.phase === 'results' ||
        state.phase === 'intro' ||
        state.profile === null
      ) {
        return state;
      }
      // The in-flight round (observe/respond) counts as failed; a round already
      // scored in `roundResult` stays as-is.
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
      return state;
    }
  }
}
