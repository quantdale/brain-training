/**
 * Value Order game: shared types.
 *
 * Each round renders a set of tiles in a seeded (non-sorted) display order.
 * Every tile carries an integer comparison value; some tiles disguise theirs
 * behind a small arithmetic expression (`6 × 4`). The player taps the tiles
 * from smallest to largest value under a per-round time budget. A wrong tap
 * ends the round immediately as a mistake; running out of budget is a
 * timeout; tapping every tile in ascending order is a perfect round.
 *
 * The task is ordinal ranking of a SET — relational magnitude comparison —
 * not producing an answer (Fast Math), identifying an operator (Missing
 * Operator), constructing an expression (Equation Builder), or interpolating
 * one position on a continuous line (Number Line). Values are pairwise
 * distinct by construction, so the correct order is always unambiguous.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'math-value-ordering';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface ValueOrderingDifficultyParams {
  /** Rounds per session. */
  readonly rounds: number;
  /** Per-round time budget in active (non-paused) ms; timeout = miss. */
  readonly budgetMs: number;
  /** Tiles per round at the base difficulty (adaptive moves this). */
  readonly tiles: number;
  /** Inclusive low end of the plain-value range. */
  readonly minValue: number;
  /** Inclusive high end of the plain-value range. */
  readonly maxValue: number;
  /** Exact number of expression-disguised tiles per round (≤ tiles). */
  readonly expressionTiles: number;
  /** Inclusive low end of expression operands. */
  readonly exprOperandMin: number;
  /** Inclusive high end of expression operands. */
  readonly exprOperandMax: number;
  /** Adaptive-only: tile-count lower bound. */
  readonly minTiles?: number;
  /** Adaptive-only: tile-count upper bound. */
  readonly maxTiles?: number;
  /** Adaptive-only: per-round tile-count step. */
  readonly stepTiles?: number;
}

export type ValueOrderingPhase = 'intro' | 'ordering' | 'feedback' | 'results';

/** Round resolution: all tiles tapped in order, a wrong tap, or budget out. */
export type RoundOutcome = 'perfect' | 'mistake' | 'timeout';

/**
 * One playfield tile. `value` is the comparison value (pairwise distinct
 * within a round); `display` is the player-facing text (`'42'` or `'6 × 4'`).
 */
export interface ValueTile {
  /** Stable within-round id (`t<displayIndex>`), unique per round. */
  readonly id: string;
  readonly kind: 'plain' | 'expression';
  readonly display: string;
  readonly value: number;
}

/** One generated round: tiles in seeded display order (NOT sorted by value). */
export interface ValueOrderingRound {
  readonly tiles: readonly ValueTile[];
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface ValueOrderingStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsHit: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of per-round speed factors over perfect rounds; mean = total / roundsPlayed. */
  readonly totalSpeedFactor: number;
  readonly bestSpeedFactor: number;
  /** Sum of progress fractions (correct taps / tiles) over resolved rounds. */
  readonly totalProgress: number;
  readonly mistakes: number;
  readonly timeouts: number;
}

export const INITIAL_STATS: Readonly<ValueOrderingStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsHit: 0,
  bestStreak: 0,
  streak: 0,
  totalSpeedFactor: 0,
  bestSpeedFactor: 0,
  totalProgress: 0,
  mistakes: 0,
  timeouts: 0,
});

/** Raw result persisted with every completed session. */
export interface ValueOrderingRawResult extends GameRawResult {
  readonly score: number;
  readonly roundsTotal: number;
  readonly roundsPlayed: number;
  readonly roundsHit: number;
  readonly meanSpeedFactor: number;
  readonly avgProgress: number;
  /** Tile count of the final round (records where adaptive landed). */
  readonly finalTiles: number;
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

export type ValueOrderingAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'round-tick'; atActiveMs: number }
  | { type: 'tap-tile'; tileId: string; atActiveMs: number }
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
export interface ValueOrderingGameState {
  phase: ValueOrderingPhase;
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
  /** Live round (null outside ordering/feedback). */
  round: ValueOrderingRound | null;
  /** Tile count of the live/last round (adaptive moves this between rounds). */
  tiles: number;
  /** Per-round budget in active ms (drives the ticker + timeout). */
  roundBudgetMs: number;
  /** Lifecycle active-ms reading when the current round started. */
  roundStartActiveMs: number;
  /** Active-ms elapsed in the current round (updated by ticks + taps). */
  roundElapsedMs: number;
  /** Ids of correctly tapped tiles, in tap (= ascending) order. */
  tappedIds: readonly string[];
  outcome: RoundOutcome | null;
  /** The wrong tile on a mistake round (feedback reveal); else null. */
  mistakeTileId: string | null;
  stats: ValueOrderingStats;
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

export function createInitialValueOrderingState(): ValueOrderingGameState {
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
    tiles: 0,
    roundBudgetMs: 0,
    roundStartActiveMs: 0,
    roundElapsedMs: 0,
    tappedIds: [],
    outcome: null,
    mistakeTileId: null,
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
