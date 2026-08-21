/**
 * Tap Rush game — shared types.
 *
 * The game is a pure state machine over `TapRushGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 *
 * Timing contract (constitution §20): gameplay timestamps are monotonic clock
 * values supplied by the screen (`spawnedAtMs`, `deadlineMs`, `nowMs`); the
 * reducer never reads the wall clock. Reaction times are
 * `tap.nowMs - spawnedAtMs` for the current target.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'speed-tap-rush';

/** One target position in normalized field coordinates (both axes 0..1). */
export interface TargetPosition {
  /** Horizontal center as a fraction of the field width. */
  readonly x: number;
  /** Vertical center as a fraction of the field height. */
  readonly y: number;
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface TapRushDifficultyParams {
  /** Targets per round. */
  readonly count: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Response window (ms) for round 1. */
  readonly initialWindowMs: number;
  /** Window floor (ms) for fixed levels; adaptive lower bound. */
  readonly minWindowMs: number;
  /** Window shrink/grow step (ms) between rounds. */
  readonly windowStepMs: number;
  /** Target radius as a fraction of the field width (normalized 0..1). */
  readonly targetRadius: number;
  /** Adaptive-only: per-round window upper bound. */
  readonly maxWindowBoundMs?: number;
}

export type TapRushPhase = 'intro' | 'active' | 'roundResult' | 'results';

/** Per-target resolution verdict. */
export type TargetVerdict = 'hit' | 'miss' | 'wrong';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface TapRushStats {
  readonly score: number;
  readonly targetsHit: number;
  /** Targets lost without a valid tap (window expiry or wrong tap). */
  readonly targetsMissed: number;
  /** Taps that landed outside the current target. */
  readonly wrongTaps: number;
  /** Reaction time per hit, in ms (monotonic clock deltas). */
  readonly reactions: readonly number[];
  /** Speed factor per hit (see scoring.ts), in tap order. */
  readonly speedFactors: readonly number[];
  readonly bestStreak: number;
  readonly streak: number;
  readonly roundsPlayed: number;
  /** Rounds completed with every target hit (no miss/wrong). */
  readonly roundsPassed: number;
  readonly perfectRounds: number;
}

export const INITIAL_STATS: Readonly<TapRushStats> = Object.freeze({
  score: 0,
  targetsHit: 0,
  targetsMissed: 0,
  wrongTaps: 0,
  reactions: [],
  speedFactors: [],
  bestStreak: 0,
  streak: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  perfectRounds: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface TapRushRawResult extends GameRawResult {
  readonly score: number;
  readonly totalTargets: number;
  readonly targetsHit: number;
  readonly targetsMissed: number;
  readonly wrongTaps: number;
  readonly accuracy: number;
  /** Reaction time per hit, in ms (monotonic clock deltas), in tap order. */
  readonly reactions: readonly number[];
  /** Speed factor per hit (see scoring.ts), in tap order. */
  readonly speedFactors: readonly number[];
  readonly meanReactionMs: number | null;
  readonly bestReactionMs: number | null;
  readonly meanSpeed: number;
  readonly bestStreak: number;
  readonly perfectRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  /** Response window of the final round (adaptive sessions track it here). */
  readonly finalWindowMs: number;
  readonly initialWindowMs: number;
  readonly count: number;
  readonly targetRadius: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Tap Rush always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Tap Rush game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type TapRushAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      startedAtMs: number;
      /** Monotonic clock value at which the first target becomes live. */
      spawnedAtMs: number;
    }
  | {
      type: 'tap';
      /** Tap position in normalized field coordinates. */
      x: number;
      y: number;
      /** Monotonic clock value at tap time. */
      nowMs: number;
    }
  | {
      type: 'target-expired';
      /** Monotonic clock value when the window closed. */
      nowMs: number;
    }
  | { type: 'next-round'; spawnedAtMs: number }
  | { type: 'pause' }
  | {
      type: 'resume';
      /** Monotonic clock value at resume time. */
      nowMs: number;
      /** Window time (ms) left at pause; the deadline is re-anchored from it. */
      remainingMs: number;
    }
  | { type: 'tutorial-open' }
  | { type: 'tutorial-close' }
  | {
      type: 'session-finalized';
      xp: number;
      normalized: number;
      activeDurationMs: number;
      pausedDurationMs: number;
      completedAtMs: number;
    }
  | { type: 'persistence-started' }
  | { type: 'persistence-succeeded' }
  | { type: 'persistence-failed'; message: string }
  | {
      type: 'completion-outcome-received';
      xp: number;
      currency: number;
      deltas: readonly { domain: string; delta: number; ratingAfter: number }[];
    }
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface TapRushGameState {
  phase: TapRushPhase;
  /** True while the SDK lifecycle is paused (timer frozen, field obscured). */
  paused: boolean;
  /** Selected difficulty (preselected 'normal' in the intro). */
  difficulty: DifficultyLevel | null;
  /** Resolved difficulty profile for the active session. */
  profile: DifficultyProfile | null;
  /** QA-injected seed for the next session; null = random per session. */
  seedOverride: string | null;
  /** Canonical seed of the active session. */
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  /** 0-based index of the current round. */
  roundIndex: number;
  /** Response window (ms) of the current round. */
  windowMs: number;
  /** Spawn positions of the current round's targets, in order. */
  targets: readonly TargetPosition[];
  /** 0-based index of the live target within `targets`. */
  targetIndex: number;
  /** Monotonic clock value when the live target appeared; null when idle. */
  spawnedAtMs: number | null;
  /** Monotonic clock value by which the live target must be tapped. */
  deadlineMs: number | null;
  /** Verdict of the just-resolved target (roundResult rendering). */
  lastVerdict: TargetVerdict | null;
  roundOutcome: 'passed' | 'failed' | null;
  /** Per-round tallies for the round-result card. */
  roundHits: number;
  roundMisses: number;
  roundWrongs: number;
  stats: TapRushStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  /** Authoritative XP from the rating pipeline (null until persistence succeeds). */
  authoritativeXp: number | null;
  /** Authoritative currency from the rating pipeline (null until persistence succeeds). */
  authoritativeCurrency: number | null;
  /** Authoritative rating deltas with resulting ratings (empty until persistence succeeds). */
  authoritativeDeltas: readonly { domain: string; delta: number; ratingAfter: number }[];
  tutorialOpen: boolean;
}

export function createInitialTapRushState(): TapRushGameState {
  return {
    phase: 'intro',
    paused: false,
    difficulty: 'normal',
    profile: null,
    seedOverride: null,
    seed: '',
    sessionId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    roundIndex: 0,
    windowMs: 0,
    targets: [],
    targetIndex: 0,
    spawnedAtMs: null,
    deadlineMs: null,
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
    lastError: null,
    authoritativeXp: null,
    authoritativeCurrency: null,
    authoritativeDeltas: [],
    tutorialOpen: false,
  };
}
