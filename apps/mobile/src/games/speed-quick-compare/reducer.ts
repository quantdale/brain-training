/**
 * Pure game state machine for the Quick Compare game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-round
 * window-expiry timer, the SDK `SessionLifecycle`, tutorial state, and
 * persistence.
 *
 * Timing contract: the reducer never reads a clock. The screen stamps each
 * action with monotonic clock values (`roundStartedAtMs`, `nowMs`); the
 * reducer derives `deadlineMs = roundStartedAtMs + windowMs` and reaction
 * times (`nowMs - roundStartedAtMs`). Render latency is never measured.
 *
 * Correctness guards: an answer is accepted only once per round
 * (`selectedIndex === null` and `phase === 'active'`); post-deadline answers
 * are ignored because the expiry timer already moved the state to `feedback`.
 * Duplicate taps and double completion are therefore impossible. Pause
 * freezes the round timer and re-anchors it on resume so pausing never buys
 * time.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  nextWindowMs,
  resolveQuickCompareDifficulty,
  quickCompareParamsFromProfile,
} from './difficulty';
import { generateRound } from './generator';
import { applyRoundOutcome, perfectSessionScore } from './scoring';
import { INITIAL_STATS, createInitialQuickCompareState } from './types';
import type { CompareVerdict, QuickCompareAction, QuickCompareDifficultyParams, QuickCompareGameState, QuickCompareStats } from './types';

export { createInitialQuickCompareState };

export function quickCompareGameReducer(
  state: QuickCompareGameState,
  action: QuickCompareAction,
): QuickCompareGameState {
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
      const profile = resolveQuickCompareDifficulty(state.difficulty);
      const params = quickCompareParamsFromProfile(profile);
      const round = generateRound(createRng(action.seed), 0, params);
      return {
        ...state,
        phase: 'active',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        roundIndex: 0,
        windowMs: params.windowMs,
        roundStartedAtMs: action.spawnedAtMs,
        deadlineMs: action.spawnedAtMs + params.windowMs,
        round,
        selectedIndex: null,
        lastVerdict: null,
        stats: { ...INITIAL_STATS, roundsTotal: params.rounds },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'answer': {
      if (state.phase !== 'active' || state.paused || state.selectedIndex !== null || state.profile === null || state.round === null) {
        return state;
      }
      // Post-deadline answers are ignored — the window already closed and the
      // expiry timer owns the resolution. Guards against timer/dispatch races.
      if (state.deadlineMs !== null && action.nowMs > state.deadlineMs) {
        return state;
      }
      const params = quickCompareParamsFromProfile(state.profile);
      const reactionMs = Math.max(0, action.nowMs - (state.roundStartedAtMs ?? action.nowMs));
      const correct = action.index === state.round.correctIndex;
      const verdict: CompareVerdict = correct ? 'correct' : 'incorrect';
      const stats = applyRoundOutcome(state.stats, verdict, state.windowMs, reactionMs);
      return {
        ...state,
        phase: 'feedback',
        selectedIndex: action.index,
        lastVerdict: verdict,
        stats,
      };
    }

    case 'answer-timeout': {
      if (state.phase !== 'active' || state.paused || state.selectedIndex !== null || state.profile === null) {
        return state;
      }
      const stats = applyRoundOutcome(state.stats, 'miss', state.windowMs, state.windowMs);
      return {
        ...state,
        phase: 'feedback',
        lastVerdict: 'miss',
        stats,
      };
    }

    case 'next-round': {
      if (state.phase !== 'feedback' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = quickCompareParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round resolved: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', round: null, selectedIndex: null, lastVerdict: null };
      }
      const roundCorrect = state.lastVerdict === 'correct';
      const windowMs = nextWindowMs(state.windowMs, roundCorrect, state.difficulty, params);
      const round = generateRound(createRng(state.seed), nextIndex, params);
      return {
        ...state,
        phase: 'active',
        roundIndex: nextIndex,
        windowMs,
        roundStartedAtMs: action.spawnedAtMs,
        deadlineMs: action.spawnedAtMs + windowMs,
        round,
        selectedIndex: null,
        lastVerdict: null,
      };
    }

    case 'pause': {
      if (state.paused || state.phase === 'results' || state.phase === 'intro') {
        return state;
      }
      return { ...state, paused: true };
    }

    case 'resume': {
      if (!state.paused) {
        return state;
      }
      if (state.roundStartedAtMs === null) {
        return { ...state, paused: false };
      }
      // Re-anchor the live round's timeline so pause time is excluded from
      // both the remaining window and the measured reaction time.
      const remaining = Math.max(0, Math.min(action.remainingMs, state.windowMs));
      return {
        ...state,
        paused: false,
        roundStartedAtMs: action.nowMs - (state.windowMs - remaining),
        deadlineMs: action.nowMs + remaining,
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
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = quickCompareParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round correct instantly. The fabricated
      // reactions/speed factors make the normalizer produce exactly 1.0 and
      // the record stays fully deterministic (and flagged `forced`).
      const stats: QuickCompareStats = {
        score: perfectSessionScore(params),
        roundsTotal: total,
        roundsCorrect: total,
        roundsWrong: 0,
        roundsMissed: 0,
        reactions: Array.from({ length: total }, () => 0),
        speedFactors: Array.from({ length: total }, () => 1),
        bestStreak: total,
        streak: total,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        selectedIndex: null,
        lastVerdict: null,
        forced: true,
        stats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = quickCompareParamsFromProfile(state.profile);
      const total = params.rounds;
      // Synthetic QA session: every round missed (normalized 0).
      const stats: QuickCompareStats = {
        ...INITIAL_STATS,
        roundsTotal: total,
        roundsMissed: total,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        round: null,
        selectedIndex: null,
        lastVerdict: null,
        forced: true,
        stats,
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
