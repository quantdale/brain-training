/**
 * Pure game state machine for the Card Sort (flexibility) game.
 *
 * Core loop (the rule-switching state machine):
 *
 *   roundActive → roundResult → (block boundary? → ruleSwitchNotice →)
 *                 roundActive → … → results
 *
 * A "rule block" is `switchEvery` consecutive rounds under one rule; when a
 * block completes the state machine passes through the explicit
 * `ruleSwitchNotice` phase (with the NEW rule already set), and the next
 * round's content is only generated once the notice expires (timer-driven,
 * SDK monotonic clock) or the player taps continue.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the notice timer,
 * response-time measurement, the SDK `SessionLifecycle`, tutorial state, and
 * persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  flexibilityParamsFromProfile,
  nextSwitchEvery,
  resolveFlexibilityDifficulty,
} from './difficulty';
import { generateRound, pickInitialRule } from './generator';
import { perfectSessionScore, roundScore } from './scoring';
import { GAME_ID, INITIAL_STATS, createInitialFlexibilityState, otherRule } from './types';
import type {
  Card,
  FlexibilityAction,
  FlexibilityGameState,
  FlexibilityStats,
  GeneratedRound,
} from './types';

export { createInitialFlexibilityState };

/** True when the round being played is the first of its rule block (post-switch). */
function isPostSwitchRound(blockIndex: number, roundsInBlock: number): boolean {
  return blockIndex > 0 && roundsInBlock === 0;
}

/** Generate the content of `roundIndex` under `rule` with the seed's stream. */
function generateForRound(
  seed: string,
  roundIndex: number,
  rule: GeneratedRound['rule'],
  params: ReturnType<typeof flexibilityParamsFromProfile>,
  prevTarget: Card | null,
): GeneratedRound {
  const rng = createRng(seed);
  return generateRound({
    rng,
    roundIndex,
    rule,
    numShapes: params.numShapes,
    numColors: params.numColors,
    prevTarget,
  });
}

export function flexibilityGameReducer(
  state: FlexibilityGameState,
  action: FlexibilityAction,
): FlexibilityGameState {
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
      const profile = resolveFlexibilityDifficulty(state.difficulty);
      const params = flexibilityParamsFromProfile(profile);
      const rule = pickInitialRule(createRng(action.seed));
      const round = generateForRound(action.seed, 0, rule, params, null);
      return {
        ...state,
        phase: 'roundActive',
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
        rule,
        blockIndex: 0,
        roundsInBlock: 0,
        switchEvery: params.switchEvery,
        blockPlayed: 0,
        blockCorrect: 0,
        round,
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
      if (state.phase !== 'roundActive' || state.paused || state.round === null || state.profile === null) {
        return state;
      }
      const correct = action.index === state.round.correctIndex;
      const params = flexibilityParamsFromProfile(state.profile);
      const streak = correct ? state.stats.streak + 1 : 0;
      const postSwitch = isPostSwitchRound(state.blockIndex, state.roundsInBlock);
      const stats: FlexibilityStats = {
        score: state.stats.score + roundScore(correct, action.responseMs, params.speedTargetMs),
        roundsPlayed: state.stats.roundsPlayed + 1,
        correctPicks: state.stats.correctPicks + (correct ? 1 : 0),
        mistakes: state.stats.mistakes + (correct ? 0 : 1),
        bestStreak: Math.max(state.stats.bestStreak, streak),
        streak,
        totalResponseMs: state.stats.totalResponseMs + action.responseMs,
        scoredPicks: state.stats.scoredPicks + 1,
        postSwitchPlayed: state.stats.postSwitchPlayed + (postSwitch ? 1 : 0),
        postSwitchCorrect: state.stats.postSwitchCorrect + (postSwitch && correct ? 1 : 0),
      };
      return {
        ...state,
        phase: 'roundResult',
        roundOutcome: correct ? 'correct' : 'wrong',
        lastResponseMs: action.responseMs,
        lastPickIndex: action.index,
        stats,
        blockPlayed: state.blockPlayed + 1,
        blockCorrect: state.blockCorrect + (correct ? 1 : 0),
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null || state.round === null) {
        return state;
      }
      const params = flexibilityParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null, round: null };
      }

      const nextRoundsInBlock = state.roundsInBlock + 1;
      if (nextRoundsInBlock >= state.switchEvery) {
        // Block complete → explicit rule-switch notice. The new rule is set
        // immediately; the round content is generated on notice expiry so the
        // notice phase is a true transition, not a reveal of the new layout.
        const newRule = otherRule(state.rule);
        const blockAccuracy = state.blockPlayed > 0 ? state.blockCorrect / state.blockPlayed : 0;
        const switchEvery = nextSwitchEvery(state.difficulty, state.switchEvery, blockAccuracy, params);
        return {
          ...state,
          phase: 'ruleSwitchNotice',
          roundIndex: nextIndex,
          rule: newRule,
          blockIndex: state.blockIndex + 1,
          roundsInBlock: 0,
          blockPlayed: 0,
          blockCorrect: 0,
          switchEvery,
          roundOutcome: null,
          round: null,
          prevTarget: state.round.target,
        };
      }

      // Same rule continues: the next round is generated immediately.
      const round = generateForRound(
        state.seed,
        nextIndex,
        state.rule,
        params,
        state.round.target,
      );
      return {
        ...state,
        phase: 'roundActive',
        roundIndex: nextIndex,
        roundsInBlock: nextRoundsInBlock,
        round,
        roundOutcome: null,
        lastPickIndex: -1,
        prevTarget: state.round.target,
      };
    }

    case 'notice-expired': {
      if (state.phase !== 'ruleSwitchNotice' || state.paused || state.profile === null) {
        return state;
      }
      const params = flexibilityParamsFromProfile(state.profile);
      const round = generateForRound(state.seed, state.roundIndex, state.rule, params, state.prevTarget);
      return { ...state, phase: 'roundActive', round, roundOutcome: null, lastPickIndex: -1 };
    }

    case 'notice-continue': {
      // Tap-to-continue: identical semantics to the timer expiry.
      return flexibilityGameReducer(state, { type: 'notice-expired' });
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
      const params = flexibilityParamsFromProfile(state.profile);
      const rounds = params.rounds;
      // Perfect run: every round correct and instant, including all post-switch
      // rounds (blocks beyond the first contribute exactly one post-switch
      // round each). For adaptive the current `switchEvery` is used as the
      // block size (an approximation of the played session).
      const blocks = Math.ceil(rounds / state.switchEvery);
      const postSwitchPlayed = blocks - 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        round: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          roundsPlayed: rounds,
          correctPicks: rounds,
          mistakes: 0,
          bestStreak: rounds,
          streak: rounds,
          totalResponseMs: 0,
          scoredPicks: rounds,
          postSwitchPlayed,
          postSwitchCorrect: postSwitchPlayed,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // An in-flight pickable round (roundActive) counts as wrong with no
      // recorded response time; a round already scored in `roundResult` stays
      // as-is; the notice phase has no round in flight.
      const countsRound = state.phase === 'roundActive' ? 1 : 0;
      const postSwitch = countsRound === 1 && isPostSwitchRound(state.blockIndex, state.roundsInBlock);
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
          postSwitchPlayed: state.stats.postSwitchPlayed + (postSwitch ? 1 : 0),
          postSwitchCorrect: state.stats.postSwitchCorrect,
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
