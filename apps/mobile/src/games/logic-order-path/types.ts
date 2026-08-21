/**
 * Order Path game — shared types (topological-ordering puzzle).
 *
 * The game is a pure state machine over `OrderPathGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'logic-order-path';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface OrderPathDifficultyParams {
  /** Number of items in each puzzle (M). */
  readonly itemCount: number;
  /** Target fraction of all forward edges to keep (1.0 = every pair). */
  readonly edgeDensityTarget: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-round time budget in milliseconds (answer auto-times-out at 0). */
  readonly roundTimeMs: number;
  /** Adaptive-only bounds. */
  readonly minItemCount?: number;
  readonly maxItemCount?: number;
  readonly minEdgeDensity?: number;
  readonly maxEdgeDensity?: number;
}

export type OrderPathPhase =
  | 'intro'
  | 'round'
  | 'roundResult'
  | 'results';

/** A generated round: a unique-topological-order puzzle. */
export interface OrderPathRound {
  /** Item labels (ids), length M. */
  readonly items: readonly string[];
  /** Precedence edges [from, to]: `from` must come before `to`. */
  readonly edges: readonly (readonly [string, string])[];
  /** Human-readable constraint strings derived from `edges`. */
  readonly constraints: readonly string[];
  /** The unique full solution order (item labels). */
  readonly solution: readonly string[];
  /** Number of steps (= items.length). */
  readonly stepCount: number;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface OrderPathStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly totalElapsedMs: number;
  readonly totalBudgetMs: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Fastest correct solve time in ms (Infinity until a correct solve). */
  readonly bestRoundTimeMs: number;
}

export const INITIAL_STATS: Readonly<OrderPathStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  totalElapsedMs: 0,
  totalBudgetMs: 0,
  bestStreak: 0,
  streak: 0,
  bestRoundTimeMs: Number.POSITIVE_INFINITY,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface OrderPathRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly bestRoundTimeMs: number;
  readonly totalElapsedMs: number;
  readonly totalBudgetMs: number;
  readonly itemCount: number;
  readonly roundTimeMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Order Path always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Order Path game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type OrderPathAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'select-item'; item: string; nowMs: number }
  | { type: 'expire-round'; nowMs: number }
  | { type: 'next-round'; nowMs: number }
  | { type: 'pause'; nowMs: number }
  | { type: 'resume'; nowMs: number }
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
  | { type: 'persistence-succeeded'; message?: string }
  | { type: 'persistence-failed'; message: string }
  | {
      type: 'completion-outcome-received';
      xp: number;
      currency: number;
      deltas: readonly { domain: string; delta: number; ratingAfter: number }[];
    }
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-timeout' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface OrderPathGameState {
  phase: OrderPathPhase;
  /** True while the SDK lifecycle is paused (timers frozen, board obscured). */
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
  /** The current round's puzzle (null in intro/results). */
  currentRound: OrderPathRound | null;
  /** Items placed so far this round, in order. */
  placedItems: readonly string[];
  /** The item the player most recently selected this round (for feedback). */
  selectedItem: string | null;
  /** Whether the current round's answer was correct. */
  roundCorrect: boolean | null;
  /** Outcome after the player answers (or times out). */
  roundOutcome: 'correct' | 'wrong' | 'timeout' | null;
  /** Monotonic-clock segment start of the current round (active time only). */
  roundStartedAtMs: number | null;
  /** Monotonic-clock deadline of the current round; null while paused. */
  roundDeadlineMs: number | null;
  /** Frozen remaining budget while paused (resume recomputes the deadline). */
  roundRemainingMs: number | null;
  /** Frozen active elapsed while paused (answer timing excludes pause). */
  roundElapsedMs: number | null;
  stats: OrderPathStats;
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

export function createInitialOrderPathState(): OrderPathGameState {
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
    currentRound: null,
    placedItems: [],
    selectedItem: null,
    roundCorrect: null,
    roundOutcome: null,
    roundStartedAtMs: null,
    roundDeadlineMs: null,
    roundRemainingMs: null,
    roundElapsedMs: null,
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
