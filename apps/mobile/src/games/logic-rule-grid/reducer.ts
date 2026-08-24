/**
 * Pure game state machine for the Rule Grid game.
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
import { createRng, isDifficultyLevel } from '@/sdk';

import { ruleGridParamsFromProfile, resolveRuleGridDifficulty } from './difficulty';
import { generateRound } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { INITIAL_STATS, createInitialRuleGridState } from './types';
import type { RuleGridAction, RuleGridGameState, RuleGridStats } from './types';

export { createInitialRuleGridState };

export function ruleGridGameReducer(
  state: RuleGridGameState,
  action: RuleGridAction,
): RuleGridGameState {
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
      const profile = resolveRuleGridDifficulty(state.difficulty);
      const params = ruleGridParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const currentRound = generateRound({
        rng,
        roundIndex: 0,
        params,
        prevRound: null,
      });
      return {
        ...state,
        phase: 'showGrid',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        currentRound,
        prevRound: null,
        selectedValue: null,
        roundCorrect: null,
        roundOutcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'answer': {
      if (state.phase !== 'showGrid' || state.paused || state.profile === null || state.currentRound === null) {
        return state;
      }
      const params = ruleGridParamsFromProfile(state.profile);
      const currentRound = state.currentRound;
      const selectedValue = action.selectedValue;
      const correct = selectedValue === currentRound.answer;
      const score = state.stats.score + roundScore(correct, currentRound.size);
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats: RuleGridStats = {
        score,
        roundsPlayed: state.stats.roundsPlayed + 1,
        roundsCorrect: state.stats.roundsCorrect + (correct ? 1 : 0),
        totalElapsedMs: state.stats.totalElapsedMs + action.elapsedMs,
        totalBudgetMs: state.stats.totalBudgetMs + params.roundTimeMs,
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        bestRoundTimeMs: correct
          ? Math.min(state.stats.bestRoundTimeMs, action.elapsedMs)
          : state.stats.bestRoundTimeMs,
      };
      const roundOutcome: 'correct' | 'wrong' | 'timeout' = correct
        ? 'correct'
        : selectedValue === null
          ? 'timeout'
          : 'wrong';
      return {
        ...state,
        phase: 'roundResult',
        selectedValue,
        roundCorrect: correct,
        roundOutcome,
        stats,
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = ruleGridParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        return { ...state, phase: 'results', roundOutcome: null };
      }
      const rng = createRng(state.seed);
      const currentRound = generateRound({
        rng,
        roundIndex: nextIndex,
        params,
        prevRound: state.currentRound,
      });
      return {
        ...state,
        phase: 'showGrid',
        roundIndex: nextIndex,
        currentRound,
        prevRound: state.currentRound,
        selectedValue: null,
        roundCorrect: null,
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
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = ruleGridParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          roundsCorrect: rounds,
          totalElapsedMs: 0,
          totalBudgetMs: rounds * params.roundTimeMs,
          bestStreak: rounds,
          streak: rounds,
          bestRoundTimeMs: 0,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      const params = ruleGridParamsFromProfile(state.profile);
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
          totalBudgetMs:
            state.stats.totalBudgetMs + (currentRoundCounted === 1 ? params.roundTimeMs : 0),
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
      const seedOverride = patch.seed !== undefined ? String(patch.seed) : state.seedOverride;
      return { ...state, difficulty, seedOverride };
    }

    default: {
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
