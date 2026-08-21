/**
 * Order Sweep game — shared types.
 *
 * The game is a pure state machine over `OrderSweepGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 *
 * Mechanic: every round deals `count` unique number tokens onto a grid, all
 * visible at once. The player sweeps them in ascending value order against a
 * draining round window; values are sampled from a range much wider than the
 * token count, so finding each next minimum is a real visual-scan/compare
 * task, not counting up from 1.
 *
 * Timing contract (constitution §20): gameplay timestamps are monotonic clock
 * values supplied by the screen (`roundStartedAtMs`, `nowMs`); the reducer
 * never reads the wall clock. A token's speed gap is
 * `clear.nowMs - lastClearAtMs` (round start for the first token).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'speed-order-sweep';

/** One number token on the board. `id` is the grid cell index (row-major). */
export interface Token {
  /** Grid cell index, 0-based row-major; also the stable QA/test id part. */
  readonly id: number;
  /** The token's number; unique within a round. */
  readonly value: number;
}

/**
 * One generated round (validated at generation; see generator.ts). `order`
 * lists the values ascending — the sweep sequence. The board always shows
 * every token; nothing is hidden, so there is no memory load by construction.
 */
export interface OrderSweepRound {
  /** Tokens placed on the grid (holes where `count` < rows × columns). */
  readonly tokens: readonly Token[];
  /** Ascending values — the required tap order. */
  readonly order: readonly number[];
  /** Grid layout. */
  readonly columns: number;
  readonly rows: number;
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface OrderSweepDifficultyParams {
  /** Rounds in a session. */
  readonly rounds: number;
  /** Tokens per round. */
  readonly count: number;
  /** Grid columns (rows are derived as ceil(count / columns)). */
  readonly columns: number;
  /** Tokens are sampled uniquely from 1..maxValue. */
  readonly maxValue: number;
  /** Round time budget (ms) for round 1. */
  readonly initialWindowMs: number;
  /** Window floor (ms) for fixed levels; adaptive lower bound. */
  readonly minWindowMs: number;
  /** Window shrink/grow step (ms) between rounds. */
  readonly windowStepMs: number;
  /** Adaptive-only: per-round window upper bound. */
  readonly maxWindowBoundMs?: number;
}

export type OrderSweepPhase = 'intro' | 'active' | 'roundResult' | 'results';

/** Per-tap verdict (drives immediate feedback). */
export type SweepVerdict = 'correct' | 'wrong';

/** How a finished round ended. */
export type RoundOutcome = 'perfect' | 'cleared' | 'expired';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface OrderSweepStats {
  readonly score: number;
  /** Tokens swept in correct order. */
  readonly tokensCleared: number;
  /** Tokens left on the board when a round's window expired. */
  readonly tokensExpired: number;
  /** Taps on a token that was not the current minimum. */
  readonly wrongTaps: number;
  /** Inter-clear gaps per cleared token, in ms (monotonic clock deltas). */
  readonly gaps: readonly number[];
  /** Speed factor per cleared token (see scoring.ts), in sweep order. */
  readonly speedFactors: readonly number[];
  readonly bestStreak: number;
  readonly streak: number;
  readonly roundsPlayed: number;
  /** Rounds fully swept before the window closed. */
  readonly roundsCleared: number;
  /** Rounds swept with zero wrong taps (window-shrinking rounds). */
  readonly perfectRounds: number;
}

export const INITIAL_STATS: Readonly<OrderSweepStats> = Object.freeze({
  score: 0,
  tokensCleared: 0,
  tokensExpired: 0,
  wrongTaps: 0,
  gaps: [],
  speedFactors: [],
  bestStreak: 0,
  streak: 0,
  roundsPlayed: 0,
  roundsCleared: 0,
  perfectRounds: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface OrderSweepRawResult extends GameRawResult {
  readonly score: number;
  readonly totalTokens: number;
  readonly tokensCleared: number;
  readonly tokensExpired: number;
  readonly wrongTaps: number;
  /** Share of tokens swept in order across the whole session (0..1). */
  readonly clearRatio: number;
  /** Inter-clear gaps per cleared token, in ms (monotonic clock deltas). */
  readonly gaps: readonly number[];
  readonly meanGapMs: number | null;
  readonly bestGapMs: number | null;
  readonly meanSpeed: number;
  readonly bestStreak: number;
  readonly perfectRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCleared: number;
  /** Time budget of the final round (adaptive sessions track it here). */
  readonly finalWindowMs: number;
  readonly initialWindowMs: number;
  readonly count: number;
  readonly columns: number;
  readonly maxValue: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Order Sweep always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Order Sweep game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type OrderSweepAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      startedAtMs: number;
      /** Monotonic clock value at which round 1's window opens. */
      roundStartedAtMs: number;
    }
  | {
      type: 'tap';
      /** Grid cell id of the tapped token. */
      tokenId: number;
      /** Monotonic clock value at tap time. */
      nowMs: number;
    }
  | {
      type: 'round-expired';
      /** Monotonic clock value when the window closed. */
      nowMs: number;
    }
  | { type: 'next-round'; roundStartedAtMs: number }
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
export interface OrderSweepGameState {
  phase: OrderSweepPhase;
  /** True while the SDK lifecycle is paused (timer frozen, board obscured). */
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
  /** Time budget (ms) of the current round. */
  windowMs: number;
  /** The current round's board; null outside an active/round-result round. */
  round: OrderSweepRound | null;
  /** How many of the round's tokens have been swept (always the smallest values). */
  clearedCount: number;
  /** Monotonic clock value the round's window opened at; null when idle. */
  roundStartedAtMs: number | null;
  /** Monotonic clock value by which the round must be swept. */
  deadlineMs: number | null;
  /** Anchor for inter-clear gaps: last clear (or round start), in clock ms. */
  lastClearAtMs: number | null;
  /** Verdict of the most recent tap (immediate feedback rendering). */
  lastVerdict: SweepVerdict | null;
  roundOutcome: RoundOutcome | null;
  /** Wrong taps committed within the current round. */
  roundWrongTaps: number;
  stats: OrderSweepStats;
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

export function createInitialOrderSweepState(): OrderSweepGameState {
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
    round: null,
    clearedCount: 0,
    roundStartedAtMs: null,
    deadlineMs: null,
    lastClearAtMs: null,
    lastVerdict: null,
    roundOutcome: null,
    roundWrongTaps: 0,
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
