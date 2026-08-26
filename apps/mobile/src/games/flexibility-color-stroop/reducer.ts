/**
 * Pure game state machine for the Color Stroop game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop is unit testable without a UI.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  colorStroopParamsFromProfile,
  resolveColorStroopDifficulty,
} from './difficulty';
import { generateTrials } from './generator';
import { perfectSessionScore, trialScore } from './scoring';
import { INITIAL_STATS, createInitialColorStroopState } from './types';
import type { ColorStroopAction, ColorStroopGameState, ColorStroopStats } from './types';

export { createInitialColorStroopState };

export function colorStroopGameReducer(
  state: ColorStroopGameState,
  action: ColorStroopAction,
): ColorStroopGameState {
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
      const profile = resolveColorStroopDifficulty(state.difficulty);
      const params = colorStroopParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const trials = generateTrials({ rng, params });

      return {
        ...state,
        phase: 'stimulus',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        trialIndex: 0,
        trials,
        currentRule: 'ink',
        trialsSinceFlip: 0,
        showingFlipCue: false,
        currentAnswer: null,
        currentResponseTimeMs: null,
        currentCorrect: null,
        previousCorrect: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'show-stimulus': {
      if (state.phase !== 'flipCue' && state.phase !== 'feedback' && state.phase !== 'roundResult') {
        return state;
      }
      return {
        ...state,
        phase: 'stimulus',
        showingFlipCue: false,
        currentAnswer: null,
        currentResponseTimeMs: null,
        currentCorrect: null,
      };
    }

    case 'submit-answer': {
      if (state.phase !== 'stimulus' || state.paused || state.profile === null) {
        return state;
      }

      const trial = state.trials[state.trialIndex];
      if (!trial) {
        return state;
      }

      const correct = action.answer === trial.correctAnswer;
      const isPostFlip = trial.isFlipPoint && state.trialsSinceFlip <= 1;
      // Speed bonus is normalized against THIS level's stimulus window
      // (campaign 014) so scoring stays comparable across difficulties.
      const params = colorStroopParamsFromProfile(state.profile);
      const points = correct
        ? trialScore(action.responseTimeMs, params.stimulusMs, isPostFlip)
        : 0;

      const totalTries = state.stats.trialsPlayed + 1;
      const newCorrectStreak = correct ? state.stats.streak + 1 : 0;
      const newPostFlipCorrect = state.stats.postFlipCorrect + (correct && isPostFlip ? 1 : 0);

      const stats: ColorStroopStats = {
        score: state.stats.score + points,
        trialsPlayed: totalTries,
        correctTrials: state.stats.correctTrials + (correct ? 1 : 0),
        bestStreak: Math.max(state.stats.bestStreak, newCorrectStreak),
        streak: newCorrectStreak,
        postFlipCorrect: newPostFlipCorrect,
        totalResponseTimeMs: state.stats.totalResponseTimeMs + action.responseTimeMs,
        fastestResponseMs: Math.min(state.stats.fastestResponseMs, action.responseTimeMs),
      };

      return {
        ...state,
        phase: 'feedback',
        currentAnswer: action.answer,
        currentResponseTimeMs: action.responseTimeMs,
        currentCorrect: correct,
        previousCorrect: correct,
        stats,
      };
    }

    case 'show-flip-cue': {
      return {
        ...state,
        phase: 'flipCue',
        showingFlipCue: true,
        currentRule: state.currentRule === 'ink' ? 'word' : 'ink',
        trialsSinceFlip: 0,
      };
    }

    case 'dismiss-flip-cue': {
      if (state.phase !== 'flipCue') {
        return state;
      }
      return {
        ...state,
        phase: 'stimulus',
        showingFlipCue: false,
      };
    }

    case 'next-trial': {
      if (state.phase !== 'feedback' || state.profile === null) {
        return state;
      }
      const params = colorStroopParamsFromProfile(state.profile);
      const nextIndex = state.trialIndex + 1;
      const newTrialsSinceFlip = state.trialsSinceFlip + 1;

      if (nextIndex >= params.trials) {
        // Session complete.
        return { ...state, phase: 'results' };
      }

      // Check if we need a rule flip (only when not at the end).
      const needsFlip = newTrialsSinceFlip >= params.flipFrequency;

      if (needsFlip) {
        return {
          ...state,
          trialIndex: nextIndex,
          trialsSinceFlip: 0,
          showingFlipCue: true,
          phase: 'flipCue',
          currentRule: state.currentRule === 'ink' ? 'word' : 'ink',
        };
      }

      return {
        ...state,
        phase: 'stimulus',
        trialIndex: nextIndex,
        trialsSinceFlip: newTrialsSinceFlip,
        currentAnswer: null,
        currentResponseTimeMs: null,
        currentCorrect: null,
      };
    }

    case 'trial-timeout': {
      // Stimulus timeout: the unanswered trial counts as wrong (full-window
      // response time) but the session continues with the next trial.
      if (state.phase !== 'stimulus' || state.paused || state.profile === null) {
        return state;
      }
      const trial = state.trials[state.trialIndex];
      if (!trial) {
        return state;
      }
      const stats: ColorStroopStats = {
        ...state.stats,
        trialsPlayed: state.stats.trialsPlayed + 1,
        streak: 0,
        totalResponseTimeMs: state.stats.totalResponseTimeMs + action.responseTimeMs,
      };
      return {
        ...state,
        phase: 'feedback',
        currentAnswer: null,
        currentResponseTimeMs: action.responseTimeMs,
        currentCorrect: false,
        previousCorrect: false,
        stats,
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
      const params = colorStroopParamsFromProfile(state.profile);
      // Perfect run: every trial correct and instant, including every
      // rule-flip trial (counted from the actual generated sequence).
      const totalFlips = state.trials.filter((t) => t.isFlipPoint).length;
      const forcedStats: ColorStroopStats = {
        ...state.stats,
        score: perfectSessionScore(params, totalFlips),
        trialsPlayed: params.trials,
        correctTrials: params.trials,
        bestStreak: params.trials,
        streak: params.trials,
        postFlipCorrect: totalFlips,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        forced: true,
        stats: forcedStats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentTrialCounted = state.phase === 'feedback' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        forced: true,
        stats: {
          ...state.stats,
          trialsPlayed: state.stats.trialsPlayed + currentTrialCounted,
          streak: currentTrialCounted === 1 ? 0 : state.stats.streak,
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