/**
 * Reaction Time game — shared types (precision-reaction variant).
 *
 * The game is a pure state machine over `SpeedGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 *
 * Timing contract (constitution §20): every gameplay timestamp is read from
 * the SDK monotonic clock (`Clock`); `goAtMs` is captured when the GO signal
 * is actually displayed and reaction times are `clock.now() - goAtMs`, so a
 * late-arriving GO timer can never inflate or deflate a measured reaction.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'speed-reaction-time';

/**
 * Game-defined difficulty tuning; recorded in the resolved difficulty profile.
 *
 * Timings are all in milliseconds. `targetMs`/`passMs`/`failMs` anchor the
 * scoring thresholds (see scoring.ts): a median reaction at or below
 * `targetMs` scores full marks, at or above `failMs` scores zero.
 */
export interface SpeedDifficultyParams {
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Minimum wait before the GO signal, in ms. */
  readonly minDelayMs: number;
  /** Maximum wait before the GO signal, in ms. */
  readonly maxDelayMs: number;
  /** False starts allowed before the session ends (exceeding it aborts). */
  readonly falseStartBudget: number;
  /** Median reaction time that scores full marks, in ms. */
  readonly targetMs: number;
  /** Reaction time at/below which a round counts as passed, in ms. */
  readonly passMs: number;
  /** Median reaction time at/above which the reaction component scores 0, in ms. */
  readonly failMs: number;
  /** Time after GO without a tap after which the round times out, in ms. */
  readonly timeoutMs: number;
  /** Adaptive-only: per-round minimum-delay lower bound. */
  readonly minDelayBoundMs?: number;
  /** Adaptive-only: per-round minimum-delay upper bound. */
  readonly maxDelayBoundMs?: number;
  /** Adaptive-only: per-round minimum-delay step size. */
  readonly delayStepMs?: number;
}

export type SpeedPhase = 'intro' | 'wait' | 'go' | 'roundResult' | 'results';

/** Per-round verdict shown on the round-result card. */
export type RoundOutcome = 'passed' | 'failed' | 'false-start' | 'timeout';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpeedStats {
  /** Recorded reaction times (valid taps after GO), in ms, in order. */
  readonly reactions: readonly number[];
  /** Rounds attempted (valid, false-start, or timeout). */
  readonly roundsPlayed: number;
  /** Rounds with a valid reaction at or below `passMs`. */
  readonly roundsPassed: number;
  /** Rounds failed by tapping before the GO signal. */
  readonly falseStarts: number;
  /** Rounds failed by not tapping within `timeoutMs` of GO. */
  readonly timeouts: number;
  /** Fastest valid reaction, in ms; null before any valid reaction. */
  readonly bestReactionMs: number | null;
  /** Median valid reaction, in ms; null before any valid reaction. */
  readonly medianReactionMs: number | null;
  /** Mean valid reaction, in ms; null before any valid reaction. */
  readonly meanReactionMs: number | null;
  /** True when the session ended early because the false-start budget ran out. */
  readonly falseStartAborted: boolean;
  readonly score: number;
}

export const INITIAL_STATS: Readonly<SpeedStats> = Object.freeze({
  reactions: [],
  roundsPlayed: 0,
  roundsPassed: 0,
  falseStarts: 0,
  timeouts: 0,
  bestReactionMs: null,
  medianReactionMs: null,
  meanReactionMs: null,
  falseStartAborted: false,
  score: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SpeedRawResult extends GameRawResult {
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly falseStarts: number;
  readonly timeouts: number;
  readonly falseStartAborted: boolean;
  readonly bestReactionMs: number | null;
  readonly medianReactionMs: number | null;
  readonly meanReactionMs: number | null;
  readonly reactions: readonly number[];
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  readonly falseStartBudget: number;
  readonly targetMs: number;
  readonly passMs: number;
  readonly failMs: number;
  readonly timeoutMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Reaction Time always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Reaction Time game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type SpeedAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  /** GO signal displayed; `goAtMs` is the monotonic clock reading at display time. */
  | { type: 'go'; goAtMs: number }
  /** Valid reaction: `rtMs` was measured with the monotonic clock. */
  | { type: 'tap'; rtMs: number }
  /** Tap before the GO signal. */
  | { type: 'false-start' }
  /** No tap within `timeoutMs` of the GO signal. */
  | { type: 'round-timeout' }
  | { type: 'next-round' }
  | { type: 'pause' }
  | { type: 'resume' }
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
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-timeout' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface SpeedGameState {
  phase: SpeedPhase;
  /** True while the SDK lifecycle is paused (timers frozen, UI obscured). */
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
  /** Minimum delay bound used to draw the current round's delay (adaptive adjusts it). */
  delayMinMs: number;
  /** Generated wait before the GO signal for the current round, in ms. */
  delayMs: number;
  /** Monotonic clock reading when GO was displayed; null before GO. */
  goAtMs: number | null;
  roundOutcome: RoundOutcome | null;
  stats: SpeedStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialSpeedState(): SpeedGameState {
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
    delayMinMs: 0,
    delayMs: 0,
    goAtMs: null,
    roundOutcome: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
