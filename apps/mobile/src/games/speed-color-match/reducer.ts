/**
 * Pure game state machine for the Speed Color Match game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: stimulus timeout
 * timers, the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextIncongruentRatio,
  resolveSpeedColorMatchDifficulty,
  sessionChallengeRating,
  speedColorMatchParamsFromProfile,
} from './difficulty';
import { generateTrials } from './generator';
import { trialScore, streakBonus } from './scoring';
import {
  GAME_ID,
  INITIAL_STATS,
  createInitialSpeedColorMatchState,
} from './types';
import type {
  ColorName,
  SpeedColorMatchAction,
  SpeedColorMatchGameState,
  SpeedColorMatchStats,
} from './types';

export { createInitialSpeedColorMatchState };

export function speedColorMatchReducer(
  state: SpeedColorMatchGameState,
  action: SpeedColorMatchAction,
): SpeedColorMatchGameState {
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
      const profile = resolveSpeedColorMatchDifficulty(state.difficulty);
      const params = speedColorMatchParamsFromProfile(profile);
      const rng = createRng(action.seed);
      const incongruentCount = Math.round(params.trials * params.incongruentRatio);
      const trials = generateTrials({
        rng,
        totalTrials: params.trials,
        incongruentCount,
      });
      return {
        ...state,
        phase: 'trial',
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
        trialShownAtMs: null,
        currentTrialOutcome: null,
        currentReactionMs: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'trial-shown': {
      if (state.phase !== 'trial' || state.paused) {
        return state;
      }
      return {
        ...state,
        trialShownAtMs: action.shownAtMs,
        currentTrialOutcome: null,
        currentReactionMs: null,
      };
    }

    case 'tap-color': {
      if (state.phase !== 'trial' || state.paused || state.profile === null || state.trialShownAtMs === null) {
        return state;
      }
      const trial = state.trials[state.trialIndex];
      if (!trial) return state;

      const correct = action.color === trial.swatchColor;
      const reactionMs = action.tappedAtMs - state.trialShownAtMs;

      if (correct) {
        const params = speedColorMatchParamsFromProfile(state.profile);
        const scoreGain = trialScore(reactionMs, params.stimulusTimeoutMs);
        const streakGain = streakBonus(state.stats.streak + 1);
        const totalScore = state.stats.score + scoreGain + streakGain;
        const newStreak = state.stats.streak + 1;
        const trialsPlayed = state.stats.trialsPlayed + 1;
        const trialsCorrect = state.stats.trialsCorrect + 1;
        const totalReactionMs =
          state.stats.avgReactionMs * state.stats.trialsPlayed + reactionMs;
        const avgReactionMs = totalReactionMs / trialsPlayed;

        const stats: SpeedColorMatchStats = {
          score: totalScore,
          trialsPlayed,
          trialsCorrect,
          bestStreak: Math.max(state.stats.bestStreak, newStreak),
          streak: newStreak,
          avgReactionMs,
          fastestReactionMs: Math.min(state.stats.fastestReactionMs, reactionMs),
          slowestReactionMs: Math.max(state.stats.slowestReactionMs, reactionMs),
        };

        return {
          ...state,
          phase: 'roundResult',
          currentTrialOutcome: 'correct',
          currentReactionMs: reactionMs,
          stats,
        };
      }

      // Wrong color: the trial fails.
      const trialsPlayed = state.stats.trialsPlayed + 1;
      return {
        ...state,
        phase: 'roundResult',
        currentTrialOutcome: 'timeout',
        currentReactionMs: reactionMs,
        stats: {
          ...state.stats,
          trialsPlayed,
          streak: 0,
        },
      };
    }

    case 'trial-timeout': {
      if (state.phase !== 'trial' || state.paused || state.profile === null) {
        return state;
      }
      const trialsPlayed = state.stats.trialsPlayed + 1;
      return {
        ...state,
        phase: 'roundResult',
        currentTrialOutcome: 'timeout',
        currentReactionMs: null,
        stats: {
          ...state.stats,
          trialsPlayed,
          streak: 0,
        },
      };
    }

    case 'next-trial': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = speedColorMatchParamsFromProfile(state.profile);
      const nextIndex = state.trialIndex + 1;
      if (nextIndex >= params.trials) {
        return { ...state, phase: 'results', currentTrialOutcome: null };
      }

      // For adaptive difficulty, update the incongruent ratio.
      let incongruentRatio = params.incongruentRatio;
      if (state.difficulty === 'adaptive') {
        const lastCorrect = state.currentTrialOutcome === 'correct';
        incongruentRatio = nextIncongruentRatio(
          params.incongruentRatio,
          lastCorrect,
          params,
        );
      }

      // Regenerate remaining trials if adaptive.
      let trials = state.trials;
      if (state.difficulty === 'adaptive' && incongruentRatio !== params.incongruentRatio) {
        const rng = createRng(state.seed);
        const incongruentCount = Math.round(params.trials * incongruentRatio);
        trials = generateTrials({
          rng,
          totalTrials: params.trials,
          incongruentCount,
        });
      }

      return {
        ...state,
        phase: 'trial',
        trialIndex: nextIndex,
        trials,
        trialShownAtMs: null,
        currentTrialOutcome: null,
        currentReactionMs: null,
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
      const params = speedColorMatchParamsFromProfile(state.profile);
      const forcedStats: SpeedColorMatchStats = {
        score: 100 * params.trials + 50 * params.trials + 10 * params.trials * (params.trials - 1),
        trialsPlayed: params.trials,
        trialsCorrect: params.trials,
        bestStreak: params.trials,
        streak: params.trials,
        avgReactionMs: 1,
        fastestReactionMs: 1,
        slowestReactionMs: 1,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        currentTrialOutcome: null,
        forced: true,
        stats: forcedStats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const currentTrialCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        currentTrialOutcome: null,
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
