/**
 * Pure game state machine for the Rule Flip (flexibility) game.
 *
 * Core loop (the block-based rule-switching state machine):
 *
 *   trialActive → trialResult → trialActive → … → results
 *
 * Unlike Cue Shift (rule changes every trial) there is an explicit per-BLOCK
 * rule that stays constant across a run of trials; between blocks the rule may
 * "flip". The reducer simply advances through the pre-built `plan` (built by
 * `generateSession`), which encodes, for each trial, whether it is the first
 * trial of a block whose rule differs from the previous block's rule (a SWITCH
 * trial) or a REPEAT trial.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: response-time
 * measurement, the SDK `SessionLifecycle`, tutorial state, the switch-arm
 * gate, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { isDifficultyLevel } from '@/sdk';

import {
  flexibilityRuleFlipParamsFromProfile,
  resolveFlexibilityRuleFlipDifficulty,
} from './difficulty';
import { generateSession } from './generator';
import { perfectPlanScore, roundScore, SWITCH_CORRECT_BONUS } from './scoring';
import { INITIAL_STATS, createInitialFlexibilityRuleFlipState } from './types';
import type {
  FlexibilityRuleFlipAction,
  FlexibilityRuleFlipGameState,
  FlexibilityRuleFlipStats,
  GeneratedRound,
} from './types';

export { createInitialFlexibilityRuleFlipState };

export function flexibilityRuleFlipReducer(
  state: FlexibilityRuleFlipGameState,
  action: FlexibilityRuleFlipAction,
): FlexibilityRuleFlipGameState {
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
      const profile = resolveFlexibilityRuleFlipDifficulty(state.difficulty);
      const params = flexibilityRuleFlipParamsFromProfile(profile);
      // The entire deterministic plan is built up front so the reducer can
      // index into it and QA force paths can count switches accurately.
      const plan = generateSession(action.seed, params);
      const first = plan[0];
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
        rounds: params.rounds,
        rule: first.rule,
        plan,
        round: first,
        roundOutcome: null,
        lastResponseMs: 0,
        lastPickIndex: -1,
        prevTarget: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'pick-card': {
      if (
        state.phase !== 'trialActive' ||
        state.paused ||
        state.round === null ||
        state.profile === null
      ) {
        return state;
      }
      const correct = action.index === state.round.correctIndex;
      const params = flexibilityRuleFlipParamsFromProfile(state.profile);
      const isSwitch = state.round.isSwitch;
      const streak = correct ? state.stats.streak + 1 : 0;
      const stats: FlexibilityRuleFlipStats = {
        score:
          state.stats.score +
          roundScore(correct, action.responseMs, params.speedTargetMs) +
          (isSwitch && correct ? SWITCH_CORRECT_BONUS : 0),
        roundsPlayed: state.stats.roundsPlayed + 1,
        correctPicks: state.stats.correctPicks + (correct ? 1 : 0),
        mistakes: state.stats.mistakes + (correct ? 0 : 1),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        totalResponseMs: state.stats.totalResponseMs + action.responseMs,
        scoredPicks: state.stats.scoredPicks + 1,
        switchPlayed: state.stats.switchPlayed + (isSwitch ? 1 : 0),
        switchCorrect: state.stats.switchCorrect + (isSwitch && correct ? 1 : 0),
        repeatPlayed: state.stats.repeatPlayed + (isSwitch ? 0 : 1),
        repeatCorrect: state.stats.repeatCorrect + (!isSwitch && correct ? 1 : 0),
      };
      return {
        ...state,
        phase: 'trialResult',
        roundOutcome: correct ? 'correct' : 'wrong',
        lastResponseMs: action.responseMs,
        lastPickIndex: action.index,
        stats,
      };
    }

    case 'next-round': {
      if (
        state.phase !== 'trialResult' ||
        state.profile === null ||
        state.difficulty === null ||
        state.round === null
      ) {
        return state;
      }
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null, round: null };
      }
      const nextRound: GeneratedRound = state.plan[nextIndex];
      return {
        ...state,
        phase: 'trialActive',
        roundIndex: nextIndex,
        rule: nextRound.rule,
        round: nextRound,
        roundOutcome: null,
        lastPickIndex: -1,
        prevTarget: state.round.target,
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
      // Perfect run: every round correct and instant; switch trials also earn
      // the switch-correct bonus (exactly what the plan encodes).
      const plan = state.plan;
      const switchPlayed = plan.filter((r) => r.isSwitch).length;
      const switchCorrect = switchPlayed;
      const repeatPlayed = plan.length - switchPlayed;
      const repeatCorrect = repeatPlayed;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        round: null,
        forced: true,
        stats: {
          score: perfectPlanScore(plan),
          roundsPlayed: plan.length,
          correctPicks: plan.length,
          mistakes: 0,
          bestStreak: plan.length,
          streak: plan.length,
          totalResponseMs: 0,
          scoredPicks: plan.length,
          switchPlayed,
          switchCorrect,
          repeatPlayed,
          repeatCorrect,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // An in-flight pickable round (trialActive) counts as wrong with no
      // recorded response time; a round already scored in `trialResult` stays
      // as-is.
      const countsRound = state.phase === 'trialActive' ? 1 : 0;
      const isSwitch = countsRound === 1 && state.round !== null ? state.round.isSwitch : false;
      const switchPlayed = state.stats.switchPlayed + (isSwitch ? 1 : 0);
      const repeatPlayed = state.stats.repeatPlayed + (isSwitch ? 0 : 1);
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        round: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + countsRound,
          mistakes: state.stats.mistakes + countsRound,
          streak: countsRound === 1 ? 0 : state.stats.streak,
          scoredPicks: state.stats.scoredPicks + countsRound,
          switchPlayed,
          switchCorrect: state.stats.switchCorrect,
          repeatPlayed,
          repeatCorrect: state.stats.repeatCorrect,
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
      // Exhaustiveness guard: every action is handled above.
      return state;
    }
  }
}
