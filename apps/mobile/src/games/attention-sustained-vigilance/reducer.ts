/**
 * Pure game state machine for the Sustained Vigilance game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the stream ticker,
 * the SDK `SessionLifecycle`, tutorial state, and persistence.
 *
 * Timing model (mirrors math-number-line-estimation / math-fast-math): the
 * reducer never reads a clock. `trial-tick` and `respond` carry `atActiveMs`
 * — the SessionLifecycle's active-only elapsed ms (paused segments are
 * excluded by the lifecycle) — and the reducer derives
 * `trialElapsedMs = atActiveMs − trialStartActiveMs`. Pausing therefore
 * freezes the stream exactly; a player can never gain time, and window/slot
 * boundaries are checked in the reducer so they are fully unit-testable.
 *
 * Trial lifecycle inside one slot of `stimulusOnMs + isiMs` active ms:
 * - A GO tap while `outcome === null` and elapsed < responseWindowMs resolves
 *   the trial immediately (`hit` on go trials, `commission` on targets) with
 *   `rtMs = elapsed`.
 * - If no tap arrives by the response window, the tick resolves the trial as
 *   `omission` (go) or `correct-hold` (target).
 * - After resolution the trial's remaining slot plays out as inline feedback;
 *   at slot end the next trial starts at its scheduled onset
 *   (`prevStart + slot`, clamped to now so heavy lag catches up), which keeps
 *   the stream cadence drift-free under timer jitter.
 *
 * Correctness guards: one response per trial (`outcome === null`); taps at or
 * past the response window are ignored (the window has already decided);
 * ticks are ignored while paused. QA force actions (`qa/*`) only reshape
 * state; the screen gates their entry points behind `isDevBuild()` and the
 * hooks call `assertDevOnly()` (see hooks.ts).
 */
import { createRng, isDifficultyLevel } from '@/sdk';
import type { DifficultyProfile } from '@/sdk';

import {
  nextResponseWindowMs,
  vigilanceParamsFromProfile,
  resolveVigilanceDifficulty,
} from './difficulty';
import { generateStream } from './generator';
import {
  COMMISSION_PENALTY,
  HOLD_SCORE,
  applyScoreDelta,
  hitScore,
  perfectSessionScore,
  speedFactorOf,
} from './scoring';
import {
  INITIAL_STATS,
  createInitialVigilanceState,
} from './types';
import type {
  TrialVerdict,
  VigilanceAction,
  VigilanceGameState,
  VigilanceStats,
} from './types';

export { createInitialVigilanceState };

/** Total active-ms occupied by one trial slot (stimulus + blank ISI). */
export function trialSlotMs(stimulusOnMs: number, isiMs: number): number {
  return stimulusOnMs + isiMs;
}

/** True when the verdict kept the streak alive (a correct trial). */
function isCleanVerdict(verdict: TrialVerdict): boolean {
  return verdict === 'hit' || verdict === 'correct-hold';
}

/** Fold one resolved trial into the stats (counting only; score handled by caller). */
function applyTrialOutcome(
  stats: VigilanceStats,
  verdict: TrialVerdict,
  rtMs: number | null,
  speedFactor: number,
): VigilanceStats {
  const clean = isCleanVerdict(verdict);
  const streak = clean ? stats.streak + 1 : 0;
  const reactions =
    verdict === 'hit' && rtMs !== null ? [...stats.reactions, rtMs] : stats.reactions;
  return {
    score: stats.score,
    trialsPlayed: stats.trialsPlayed + 1,
    hits: stats.hits + (verdict === 'hit' ? 1 : 0),
    commissions: stats.commissions + (verdict === 'commission' ? 1 : 0),
    omissions: stats.omissions + (verdict === 'omission' ? 1 : 0),
    correctHolds: stats.correctHolds + (verdict === 'correct-hold' ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    reactions,
    totalSpeed:
      stats.totalSpeed + (verdict === 'hit' && rtMs !== null ? speedFactor : 0),
    bestReactionMs:
      verdict === 'hit' && rtMs !== null
        ? stats.bestReactionMs === null
          ? rtMs
          : Math.min(stats.bestReactionMs, rtMs)
        : stats.bestReactionMs,
  };
}

/** Resolve the live trial against a GO tap (or its absence at window end). */
function resolveTrial(
  state: VigilanceGameState,
  tapRtMs: number | null,
  elapsedMs: number,
  slotMsValue: number,
): VigilanceGameState {
  const trial = state.stream[state.trialIndex];
  if (trial === undefined) {
    return state;
  }
  const params = vigilanceParamsFromProfile(state.profile as DifficultyProfile);
  const timedOut = tapRtMs === null;
  const verdict: TrialVerdict = timedOut
    ? trial.isTarget
      ? 'correct-hold'
      : 'omission'
    : trial.isTarget
      ? 'commission'
      : 'hit';

  let scoreDelta = 0;
  let speedFactor = 0;
  if (verdict === 'hit') {
    speedFactor = speedFactorOf(tapRtMs as number, params);
    scoreDelta = hitScore(tapRtMs as number, params);
  } else if (verdict === 'correct-hold') {
    scoreDelta = HOLD_SCORE;
  } else if (verdict === 'commission') {
    scoreDelta = -COMMISSION_PENALTY;
  }

  return {
    ...state,
    responded: !timedOut,
    responseRtMs: timedOut ? null : (tapRtMs as number),
    outcome: verdict,
    trialElapsedMs: Math.min(elapsedMs, slotMsValue),
    stats: {
      ...applyTrialOutcome(state.stats, verdict, timedOut ? null : (tapRtMs as number), speedFactor),
      score: applyScoreDelta(state.stats.score, scoreDelta),
    },
  };
}

export function vigilanceGameReducer(
  state: VigilanceGameState,
  action: VigilanceAction,
): VigilanceGameState {
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
      const profile = resolveVigilanceDifficulty(state.difficulty);
      const params = vigilanceParamsFromProfile(profile);
      const generated = generateStream(createRng(action.seed), params);
      return {
        ...state,
        phase: 'stream',
        paused: false,
        profile,
        seed: action.seed,
        sessionId: action.sessionId,
        startedAtMs: action.startedAtMs,
        completedAtMs: null,
        activeDurationMs: 0,
        pausedDurationMs: 0,
        stream: generated.trials,
        stopDigit: generated.stopDigit,
        trialIndex: 0,
        responseWindowMs: params.responseWindowMs,
        trialStartActiveMs: 0,
        trialElapsedMs: 0,
        responded: false,
        responseRtMs: null,
        outcome: null,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'trial-tick': {
      if (state.phase !== 'stream' || state.paused || state.profile === null) {
        return state;
      }
      const params = vigilanceParamsFromProfile(state.profile);
      const slotMsValue = trialSlotMs(params.stimulusOnMs, params.isiMs);
      const elapsed = Math.max(0, action.atActiveMs - state.trialStartActiveMs);

      // 1. Window end without a response resolves the trial.
      if (state.outcome === null && elapsed >= state.responseWindowMs) {
        return resolveTrial(state, null, elapsed, slotMsValue);
      }

      // 2. Slot end after resolution advances to the next trial (or results).
      if (state.outcome !== null && elapsed >= slotMsValue) {
        const nextIndex = state.trialIndex + 1;
        if (nextIndex >= state.stream.length) {
          return { ...state, phase: 'results', trialElapsedMs: slotMsValue };
        }
        const trialClean = isCleanVerdict(state.outcome);
        const responseWindowMs = nextResponseWindowMs(
          state.responseWindowMs,
          trialClean,
          state.difficulty ?? 'normal',
          params,
        );
        return {
          ...state,
          trialIndex: nextIndex,
          // Scheduled onset keeps cadence drift-free; clamp to now so a long
          // stall (e.g. debugger pause with timers suspended) catches up.
          trialStartActiveMs: Math.min(action.atActiveMs, state.trialStartActiveMs + slotMsValue),
          responseWindowMs,
          trialElapsedMs: 0,
          responded: false,
          responseRtMs: null,
          outcome: null,
        };
      }

      return { ...state, trialElapsedMs: elapsed };
    }

    case 'respond': {
      if (
        state.phase !== 'stream' ||
        state.paused ||
        state.profile === null ||
        state.outcome !== null
      ) {
        return state;
      }
      const params = vigilanceParamsFromProfile(state.profile);
      const slotMsValue = trialSlotMs(params.stimulusOnMs, params.isiMs);
      const elapsed = Math.max(0, action.atActiveMs - state.trialStartActiveMs);
      // At/after the window the trial has already been decided; late taps are
      // ignored rather than stolen from the next trial.
      if (elapsed >= state.responseWindowMs) {
        return state;
      }
      return resolveTrial(state, elapsed, elapsed, slotMsValue);
    }

    case 'pause': {
      if (state.paused || state.phase !== 'stream') {
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
      const params = vigilanceParamsFromProfile(state.profile);
      const targetCount = state.stream.filter((trial) => trial.isTarget).length;
      const goTrials = state.stream.length - targetCount;
      // Synthetic QA session: every go trial hit at exactly rtTargetMs (speed
      // factor 1 → 150 points each) and every target held. The normalizer
      // produces exactly 1.0 and the record stays fully deterministic (and
      // flagged `forced`).
      const stats: VigilanceStats = {
        score: perfectSessionScore(params, targetCount),
        trialsPlayed: state.stream.length,
        hits: goTrials,
        commissions: 0,
        omissions: 0,
        correctHolds: targetCount,
        streak: state.stream.length,
        bestStreak: state.stream.length,
        reactions: Array.from({ length: goTrials }, () => params.rtTargetMs),
        totalSpeed: goTrials,
        bestReactionMs: goTrials > 0 ? params.rtTargetMs : null,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        responded: false,
        responseRtMs: null,
        outcome: null,
        forced: true,
        stats,
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const targetCount = state.stream.filter((trial) => trial.isTarget).length;
      const goTrials = state.stream.length - targetCount;
      // Synthetic QA session: every go trial omitted, every target commissioned
      // (normalized 0).
      const stats: VigilanceStats = {
        ...INITIAL_STATS,
        trialsPlayed: state.stream.length,
        commissions: targetCount,
        omissions: goTrials,
      };
      return {
        ...state,
        phase: 'results',
        paused: false,
        responded: false,
        responseRtMs: null,
        outcome: null,
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
