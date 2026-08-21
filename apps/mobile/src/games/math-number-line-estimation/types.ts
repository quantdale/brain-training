/**
 * Number Line Estimation game: shared types.
 *
 * Each round renders a number line `[lineMin, lineMax]` with a flag at a
 * seeded target value. The player taps the line where they think the flag's
 * value sits; the tapped fraction snaps to the nearest integer value and is
 * scored by its bounded absolute error against the target (see scoring.ts).
 * The task is magnitude interpolation — no arithmetic is required to answer,
 * which keeps it mechanically distinct from Fast Math / Missing Operator /
 * Equation Builder.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). */
export const GAME_ID = 'math-number-line-estimation';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface NumberLineDifficultyParams {
  /** Rounds per session. */
  readonly rounds: number;
  /** Per-round time budget in active (non-paused) ms; timeout = miss. */
  readonly budgetMs: number;
  /** Left endpoint of the displayed number line. */
  readonly lineMin: number;
  /** Right endpoint of the displayed number line. */
  readonly lineMax: number;
  /**
   * Hit tolerance as a percent of the line span (e.g. `6` = 6%). An estimate
   * within this band is a hit and earns a closeness bonus; anything further
   * scores 0.
   */
  readonly tolerancePct: number;
  /** Adaptive-only: tolerance lower bound (percent of span). */
  readonly minTolerancePct?: number;
  /** Adaptive-only: tolerance upper bound (percent of span). */
  readonly maxTolerancePct?: number;
  /** Adaptive-only: per-round tolerance step (percent of span). */
  readonly stepTolerancePct?: number;
}

export type NumberLinePhase = 'intro' | 'estimating' | 'feedback' | 'results';

export type RoundOutcome = 'hit' | 'miss' | 'timeout';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface NumberLineStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsHit: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of per-round closeness factors in [0, 1]; mean = total / roundsPlayed. */
  readonly totalCloseness: number;
  readonly bestCloseness: number;
  /** Sum of absolute errors over resolved rounds (for diagnostics). */
  readonly totalAbsoluteError: number;
  readonly timeouts: number;
}

export const INITIAL_STATS: Readonly<NumberLineStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsHit: 0,
  bestStreak: 0,
  streak: 0,
  totalCloseness: 0,
  bestCloseness: 0,
  totalAbsoluteError: 0,
  timeouts: 0,
});

/**
 * One generated round: the displayed range and the flagged target value.
 * The target is guaranteed strictly interior (never on an endpoint label) by
 * the generator; see `validateRound`.
 */
export interface NumberLineRound {
  readonly lineMin: number;
  readonly lineMax: number;
  readonly target: number;
}

/**
 * Raw result persisted with every completed session.
 */
export interface NumberLineRawResult extends GameRawResult {
  readonly score: number;
  readonly roundsTotal: number;
  readonly roundsPlayed: number;
  readonly roundsHit: number;
  readonly meanCloseness: number;
  readonly avgAbsoluteError: number;
  readonly finalTolerancePct: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the game. Applied only in the
 * `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type NumberLineAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'round-tick'; atActiveMs: number }
  | { type: 'estimate'; value: number; atActiveMs: number }
  | { type: 'next-round'; startActiveMs: number }
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
export interface NumberLineGameState {
  phase: NumberLinePhase;
  /** True while the SDK lifecycle is paused (timers frozen). */
  paused: boolean;
  difficulty: DifficultyLevel | null;
  profile: DifficultyProfile | null;
  /** QA-injected seed for the next session; null = random per session. */
  seedOverride: string | null;
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  roundIndex: number;
  /** Live round (null outside estimating/feedback). */
  round: NumberLineRound | null;
  /** Hit tolerance of the live/last round, as a percent of the span. */
  tolerancePct: number;
  /** Per-round budget in active ms (drives the ticker + timeout). */
  roundBudgetMs: number;
  /** Lifecycle active-ms reading when the current round started. */
  roundStartActiveMs: number;
  /** Active-ms elapsed in the current round (updated by ticks). */
  roundElapsedMs: number;
  /** Snapped estimate of the current/last round (null before/never answered). */
  estimateValue: number | null;
  outcome: RoundOutcome | null;
  stats: NumberLineStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  lastError: string | null;
  authoritativeXp: number | null;
  authoritativeCurrency: number | null;
  authoritativeDeltas: readonly { domain: string; delta: number; ratingAfter: number }[];
  tutorialOpen: boolean;
}

export function createInitialNumberLineState(): NumberLineGameState {
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
    round: null,
    tolerancePct: 0,
    roundBudgetMs: 0,
    roundStartActiveMs: 0,
    roundElapsedMs: 0,
    estimateValue: null,
    outcome: null,
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
