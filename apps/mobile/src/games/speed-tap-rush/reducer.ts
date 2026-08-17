/**
 * Pure game state machine for the Tap Rush game.
 *
 * Every transition is a pure function of `(state, action)` — no timers, no
 * side effects — so the whole loop (including the QA force paths) is unit
 * testable without a UI. The screen owns the side effects: the per-target
 * window-expiry timer, the SDK `SessionLifecycle`, tutorial state, and
 * persistence.
 *
 * Timing contract: the reducer never reads a clock. The screen stamps each
 * action with monotonic clock values (`spawnedAtMs`, `nowMs`); the reducer
 * derives deadlines (`deadlineMs = spawnedAtMs + windowMs`) and reaction
 * times (`nowMs - spawnedAtMs`). Pause freezes play by removing the expiry
 * timer from the UI; on resume the screen re-schedules with the remaining
 * time computed from the unchanged `deadlineMs`.
 *
 * QA force actions (`qa/*`) only reshape state; the screen gates their entry
 * points behind `isDevBuild()` and the hooks call `assertDevOnly()` (see
 * hooks.ts), so production builds never expose them.
 */
import { createRng, isDifficultyLevel } from '@/sdk';

import {
  nextWindowMs,
  resolveTapRushDifficulty,
  tapRushParamsFromProfile,
} from './difficulty';
import { generateRoundTargets } from './generator';
import { hitPoints, perfectRoundBonus, perfectSessionScore, speedFactor } from './scoring';
import { INITIAL_STATS, createInitialTapRushState } from './types';
import type {
  TapRushAction,
  TapRushDifficultyParams,
  TapRushGameState,
  TapRushStats,
  TargetPosition,
} from './types';

export { createInitialTapRushState };

/** True when the tap position is inside the current target's circle. */
function tapHitsTarget(
  tapX: number,
  tapY: number,
  target: TargetPosition,
  radius: number,
): boolean {
  const dx = tapX - target.x;
  const dy = tapY - target.y;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Resolve the live target and either open the next target or finish the
 * round. Shared by `tap` (hit/wrong) and `target-expired` (miss): the next
 * target spawns at `nowMs` with a fresh `windowMs` deadline, and the last
 * resolution of a round moves the state machine to `roundResult`.
 */
function resolveAndAdvance(
  state: TapRushGameState,
  verdict: 'hit' | 'miss' | 'wrong',
  nowMs: number,
  params: TapRushDifficultyParams,
  stats: TapRushStats,
  roundHits: number,
  roundMisses: number,
  roundWrongs: number,
): TapRushGameState {
  const nextIndex = state.targetIndex + 1;
  if (nextIndex < state.targets.length) {
    return {
      ...state,
      targetIndex: nextIndex,
      spawnedAtMs: nowMs,
      deadlineMs: nowMs + state.windowMs,
      lastVerdict: verdict,
      roundHits,
      roundMisses,
      roundWrongs,
      stats,
    };
  }

  // Last target of the round resolved: score the round. A round is passed
  // only when every target was hit (no miss, no wrong tap).
  const passed = roundMisses === 0;
  const roundFinished: TapRushStats = {
    ...stats,
    score: stats.score + (passed ? perfectRoundBonus(params.count) : 0),
    roundsPlayed: stats.roundsPlayed + 1,
    roundsPassed: stats.roundsPassed + (passed ? 1 : 0),
    perfectRounds: stats.perfectRounds + (passed ? 1 : 0),
    streak: passed ? stats.streak : 0,
  };
  return {
    ...state,
    phase: 'roundResult',
    targetIndex: nextIndex,
    spawnedAtMs: null,
    deadlineMs: null,
    lastVerdict: verdict,
    roundOutcome: passed ? 'passed' : 'failed',
    roundHits,
    roundMisses,
    roundWrongs,
    stats: roundFinished,
  };
}

export function tapRushGameReducer(
  state: TapRushGameState,
  action: TapRushAction,
): TapRushGameState {
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
      const profile = resolveTapRushDifficulty(state.difficulty);
      const params = tapRushParamsFromProfile(profile);
      const targets = generateRoundTargets({
        rng: createRng(action.seed),
        roundIndex: 0,
        count: params.count,
        radius: params.targetRadius,
      });
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
        windowMs: params.initialWindowMs,
        targets,
        targetIndex: 0,
        spawnedAtMs: action.spawnedAtMs,
        deadlineMs: action.spawnedAtMs + params.initialWindowMs,
        lastVerdict: null,
        roundOutcome: null,
        roundHits: 0,
        roundMisses: 0,
        roundWrongs: 0,
        stats: { ...INITIAL_STATS },
        forced: false,
        xp: 0,
        normalized: null,
        persistState: 'idle',
      };
    }

    case 'tap': {
      if (state.phase !== 'active' || state.paused || state.profile === null) {
        return state;
      }
      // Post-deadline taps are ignored — the window already closed and the
      // expiry timer owns the resolution. Guards against timer/dispatch races.
      if (state.deadlineMs !== null && action.nowMs > state.deadlineMs) {
        return state;
      }
      const target = state.targets[state.targetIndex];
      if (target === undefined || state.spawnedAtMs === null) {
        return state;
      }
      const params = tapRushParamsFromProfile(state.profile);
      const reactionMs = Math.max(0, action.nowMs - state.spawnedAtMs);
      const hit = tapHitsTarget(action.x, action.y, target, params.targetRadius);

      if (hit) {
        const factor = speedFactor(state.windowMs, reactionMs);
        const streak = state.stats.streak + 1;
        const stats: TapRushStats = {
          ...state.stats,
          score: state.stats.score + hitPoints(state.windowMs, reactionMs),
          targetsHit: state.stats.targetsHit + 1,
          reactions: [...state.stats.reactions, reactionMs],
          speedFactors: [...state.stats.speedFactors, factor],
          bestStreak: Math.max(state.stats.bestStreak, streak),
          streak,
        };
        return resolveAndAdvance(
          state,
          'hit',
          action.nowMs,
          params,
          stats,
          state.roundHits + 1,
          state.roundMisses,
          state.roundWrongs,
        );
      }

      // Wrong tap: the target is lost immediately and the streak breaks.
      const stats: TapRushStats = {
        ...state.stats,
        targetsMissed: state.stats.targetsMissed + 1,
        wrongTaps: state.stats.wrongTaps + 1,
        streak: 0,
      };
      return resolveAndAdvance(
        state,
        'wrong',
        action.nowMs,
        params,
        stats,
        state.roundHits,
        state.roundMisses + 1,
        state.roundWrongs + 1,
      );
    }

    case 'target-expired': {
      if (state.phase !== 'active' || state.paused || state.profile === null) {
        return state;
      }
      const params = tapRushParamsFromProfile(state.profile);
      const stats: TapRushStats = {
        ...state.stats,
        targetsMissed: state.stats.targetsMissed + 1,
        streak: 0,
      };
      return resolveAndAdvance(
        state,
        'miss',
        action.nowMs,
        params,
        stats,
        state.roundHits,
        state.roundMisses + 1,
        state.roundWrongs,
      );
    }

    case 'next-round': {
      if (state.phase !== 'roundResult' || state.profile === null || state.difficulty === null) {
        return state;
      }
      const params = tapRushParamsFromProfile(state.profile);
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= params.rounds) {
        // Last round played: the session finishes; the screen completes the
        // lifecycle and persists in an effect watching the `results` phase.
        return { ...state, phase: 'results', roundOutcome: null, lastVerdict: null };
      }
      const passed = state.roundOutcome === 'passed';
      const windowMs = nextWindowMs(state.windowMs, passed, state.difficulty, params);
      const targets = generateRoundTargets({
        rng: createRng(state.seed),
        roundIndex: nextIndex,
        count: params.count,
        radius: params.targetRadius,
      });
      return {
        ...state,
        phase: 'active',
        roundIndex: nextIndex,
        windowMs,
        targets,
        targetIndex: 0,
        spawnedAtMs: action.spawnedAtMs,
        deadlineMs: action.spawnedAtMs + windowMs,
        lastVerdict: null,
        roundOutcome: null,
        roundHits: 0,
        roundMisses: 0,
        roundWrongs: 0,
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
      if (state.spawnedAtMs === null) {
        // Paused on the round-result card: nothing to re-anchor.
        return { ...state, paused: false };
      }
      // Re-anchor the live target's timeline so pause time is excluded from
      // both the remaining window and the measured reaction time.
      const remaining = Math.max(0, Math.min(action.remainingMs, state.windowMs));
      return {
        ...state,
        paused: false,
        spawnedAtMs: action.nowMs - (state.windowMs - remaining),
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

    case 'qa/force-win': {
      // Dev-only entry point (screen gates it); the reducer only shapes state.
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      const params = tapRushParamsFromProfile(state.profile);
      const totalTargets = params.count * params.rounds;
      // Synthetic QA session: every target hit instantly. The fabricated
      // reactions/speed factors make the normalizer produce exactly 1.0 and
      // the record stays fully deterministic (and flagged `forced`).
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        lastVerdict: null,
        forced: true,
        stats: {
          score: perfectSessionScore(params),
          targetsHit: totalTargets,
          targetsMissed: 0,
          wrongTaps: 0,
          reactions: Array.from({ length: totalTargets }, () => 0),
          speedFactors: Array.from({ length: totalTargets }, () => 1),
          bestStreak: params.count,
          streak: params.count,
          roundsPlayed: params.rounds,
          roundsPassed: params.rounds,
          perfectRounds: params.rounds,
        },
      };
    }

    case 'qa/force-lose': {
      if (state.phase === 'results' || state.phase === 'intro' || state.profile === null) {
        return state;
      }
      // The in-flight round's unresolved targets count as missed; a round
      // already scored in `roundResult` stays as-is.
      const unresolved = state.targets.length - (state.roundHits + state.roundMisses);
      const currentRoundUnscored = state.phase === 'active' ? 1 : 0;
      return {
        ...state,
        phase: 'results',
        paused: false,
        roundOutcome: null,
        lastVerdict: null,
        forced: true,
        stats: {
          ...state.stats,
          targetsMissed: state.stats.targetsMissed + unresolved,
          streak: 0,
          roundsPlayed: state.stats.roundsPlayed + currentRoundUnscored,
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
