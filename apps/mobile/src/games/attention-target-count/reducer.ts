/**
 * Pure game state machine for the Target Count game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the SDK
 * `SessionLifecycle`, tutorial state, the round timer, and persistence.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel, assertExhaustive } from '@/sdk';

import {
  escalatedDistractorClasses,
  resolveTargetCountDifficulty,
  targetCountParamsFromProfile,
} from './difficulty';
import { generateRound } from './generator';
import { roundScore } from './scoring';
import { INITIAL_STATS, createInitialTargetCountState, isCurrentInput } from './types';
import type { TargetCountAction, TargetCountGameState, TargetCountStats } from './types';

export { createInitialTargetCountState };

export function targetCountGameReducer(
  state: TargetCountGameState,
  action: TargetCountAction,
): TargetCountGameState {
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
      const profile = resolveTargetCountDifficulty(state.difficulty);
      const params = targetCountParamsFromProfile(profile);
      const rng = createRng(action.seed);
      // Streak is 0 at session start: round 1 always plays at tier base, even
      // on a restart from results (the previous session's streak must not leak).
      const effectiveParams = {
        ...params,
        distractorClasses: escalatedDistractorClasses(params, INITIAL_STATS.streak),
      };
      const currentRound = generateRound({
        rng,
        roundIndex: 0,
        params: effectiveParams,
        prevRound: null,
      });
      return {
        ...state,
        phase: 'showGrid',
        paused: false,
        profile,
        inputEpoch: state.inputEpoch + 1,
        roundStartedAtMs: action.nowMs,
        deadlineMs: action.nowMs + params.roundTimeMs,
        remainingMs: params.roundTimeMs,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        currentRound,
        prevRound: null,
        selectedCount: null,
        roundCorrect: null,
        roundOutcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
        lastError: null,
        authoritativeXp: null,
        authoritativeCurrency: null,
        authoritativeDeltas: [],
      };
    }

    case 'answer': {
      if (state.phase !== 'showGrid' || state.paused || state.profile === null || state.currentRound === null ||
          !isCurrentInput(state, action.stamp) || !Number.isFinite(action.nowMs) || action.nowMs < state.roundStartedAtMs) {
        return state;
      }
      const params = targetCountParamsFromProfile(state.profile);
      const roundTimeMs = params.roundTimeMs;
      const timedOut = action.nowMs >= state.deadlineMs;
      if (action.selectedCount === null && !timedOut) return state;
      const selectedCount = timedOut ? null : action.selectedCount;
      // A closed window always records its full active budget, including a
      // timeout delivered after a pause that began once the window expired.
      const elapsedMs = timedOut ? roundTimeMs : action.nowMs - state.roundStartedAtMs;
      const correct = selectedCount === state.currentRound.targetCount;
      const roundsPlayed = state.stats.roundsPlayed + 1;
      const roundsCorrect = state.stats.roundsCorrect + (correct ? 1 : 0);
      const score = state.stats.score + roundScore(correct, roundTimeMs, elapsedMs);
      const streak = correct ? state.stats.streak + 1 : 0;
      const bestStreak = Math.max(state.stats.bestStreak, streak);
      const bestRoundTimeMs = correct
        ? Math.min(state.stats.bestRoundTimeMs, elapsedMs)
        : state.stats.bestRoundTimeMs;
      const stats: TargetCountStats = {
        score,
        roundsPlayed,
        roundsCorrect,
        totalElapsedMs: state.stats.totalElapsedMs + elapsedMs,
        totalBudgetMs: state.stats.totalBudgetMs + roundTimeMs,
        bestStreak,
        streak,
        bestRoundTimeMs,
      };
      const roundOutcome: 'correct' | 'wrong' | 'timeout' = correct
        ? 'correct'
        : selectedCount === null
          ? 'timeout'
          : 'wrong';
      return {
        ...state,
        phase: 'roundResult',
        selectedCount,
        roundCorrect: correct,
        roundOutcome,
        stats,
      };
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.paused || state.profile === null || state.difficulty === null ||
          !isCurrentInput(state, action.stamp) || !Number.isFinite(action.nowMs)) {
        return state;
      }
      const params = targetCountParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes.
        return { ...state, phase: 'results', selectedCount: null, roundCorrect: null, roundOutcome: null };
      }
      const rng = createRng(state.seed);
      // Within-session escalation: the streak BEFORE this round decides how
      // much distractor variety the next grid carries (see difficulty.ts).
      const currentRound = generateRound({
        rng,
        roundIndex: nextIndex,
        params: {
          ...params,
          distractorClasses: escalatedDistractorClasses(params, state.stats.streak),
        },
        prevRound: state.currentRound,
      });
      return {
        ...state,
        phase: 'showGrid',
        roundIndex: nextIndex,
        roundStartedAtMs: action.nowMs,
        deadlineMs: action.nowMs + params.roundTimeMs,
        remainingMs: params.roundTimeMs,
        currentRound,
        prevRound: state.currentRound,
        selectedCount: null,
        roundCorrect: null,
        roundOutcome: null,
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'results' || state.phase === 'intro' || !Number.isFinite(action.nowMs)) {
        return state;
      }
      return {
        ...state,
        paused: true,
        inputEpoch: state.inputEpoch + 1,
        remainingMs: state.phase === 'showGrid'
          ? Math.max(0, state.deadlineMs - action.nowMs)
          : state.remainingMs,
      };
    }

    case 'resume': {
      if (!state.paused || !Number.isFinite(action.nowMs)) return state;
      const deadlineMs = state.phase === 'showGrid' ? action.nowMs + state.remainingMs : state.deadlineMs;
      return {
        ...state,
        paused: false,
        deadlineMs,
        roundStartedAtMs: state.roundStartedAtMs + deadlineMs - state.deadlineMs,
      };
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
      const params = targetCountParamsFromProfile(state.profile);
      const rounds = params.rounds;
      return {
        ...state,
        phase: 'results',
        paused: false,
        selectedCount: null,
        roundCorrect: null,
        roundOutcome: null,
        forced: true,
        stats: {
          score: rounds * 200,
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
      const params = targetCountParamsFromProfile(state.profile);
      const currentRoundCounted = state.phase === 'roundResult' ? 0 : 1;
      return {
        ...state,
        phase: 'results',
        paused: false,
        selectedCount: null,
        roundCorrect: null,
        roundOutcome: null,
        forced: true,
        stats: {
          ...state.stats,
          roundsPlayed: state.stats.roundsPlayed + currentRoundCounted,
          streak: currentRoundCounted === 1 ? 0 : state.stats.streak,
          totalBudgetMs: state.stats.totalBudgetMs + (currentRoundCounted === 1 ? params.roundTimeMs : 0),
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
      // 075: the switch above has narrowed `action` to the members with
      // no `case`, so passing it here IS the exhaustiveness ASSERTION —
      // add a case and this stops compiling, naming the member. At
      // runtime the branch is reachable only for a value outside the
      // declared union, and it throws rather than silently returning the
      // current state: a dropped transition with no symptom at all is
      // worse than a loud construction bug.
      return assertExhaustive(action, 'attention-target-count');

    }
  }
}
