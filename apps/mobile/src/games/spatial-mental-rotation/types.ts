/**
 * Mental Rotation game — shared types.
 *
 * The game is a pure state machine over `SpatialGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, the generator, and the
 * persistence layer all consume.
 *
 * Geometry vocabulary: shapes are sets of integer block coordinates. A block
 * carries a `colorIndex` into the rendering palette (see
 * components/block-shape.tsx) so colors rotate/mirror with the shape — the
 * puzzle is about the colored arrangement, not the outline alone.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'spatial-mental-rotation';

/** Number of distinct block colors; must match `BLOCK_PALETTE` in block-shape.tsx. */
export const BLOCK_COLOR_COUNT = 4;

/** One block of a shape: integer grid coordinates plus a palette index. */
export interface Block {
  readonly x: number;
  readonly y: number;
  readonly colorIndex: number;
}

/** Position-only view of a block; used for symmetry/equality checks. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

/** Rotation angles the generator can produce (block grids rotate by 90°). */
export type RotationDegrees = 0 | 90 | 180 | 270;

/** What the player must decide each round. */
export type RoundKind = 'same' | 'different';

/**
 * Game-defined per-round difficulty tuning; recorded in the resolved
 * difficulty profile (all numeric per the SDK contract).
 *
 * `angleMask` is a bitmask over candidate rotation degrees: bit 0 = 0°,
 * bit 1 = 90°, bit 2 = 180°, bit 3 = 270° (see difficulty.ts).
 */
export interface SpatialDifficultyParams {
  /** Number of blocks in each shape. */
  readonly blocks: number;
  /** Allowed candidate-rotation angles, as a bitmask (see difficulty.ts). */
  readonly angleMask: number;
  /** Per-round answer time budget in ms. */
  readonly timeBudgetMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
}

/** Difficulty params plus the optional adaptive bounds (persisted with adaptive sessions). */
export type SpatialProfileParams = SpatialDifficultyParams & {
  /** Adaptive-only: per-round block-count lower bound. */
  readonly minBlocks?: number;
  /** Adaptive-only: per-round block-count upper bound. */
  readonly maxBlocks?: number;
  /** Adaptive-only: per-round time-budget lower bound (ms). */
  readonly minTimeBudgetMs?: number;
  /** Adaptive-only: per-round time-budget upper bound (ms). */
  readonly maxTimeBudgetMs?: number;
};

/** Round failure modes: wrong answer vs. expired time budget. */
export type RoundOutcome = 'passed' | 'failed' | 'timeout';

export type SpatialPhase = 'intro' | 'play' | 'roundResult' | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpatialStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalAnswers: number;
  readonly correctAnswers: number;
  readonly timeouts: number;
  /** Sum of remaining budget at round end, for the speed factor (see scoring.ts). */
  readonly totalRemainingMs: number;
  /** Sum of per-round time budgets, for the speed factor (see scoring.ts). */
  readonly totalBudgetMs: number;
}

export const INITIAL_STATS: Readonly<SpatialStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswers: 0,
  correctAnswers: 0,
  timeouts: 0,
  totalRemainingMs: 0,
  totalBudgetMs: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SpatialRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  /** Average remaining-budget share across played rounds, 0..1 (see scoring.ts). */
  readonly speed: number;
  readonly bestStreak: number;
  readonly totalAnswers: number;
  readonly correctAnswers: number;
  readonly timeouts: number;
  /** Sum of remaining budget at round end, for the speed factor (see scoring.ts). */
  readonly totalRemainingMs: number;
  /** Sum of per-round time budgets, for the speed factor (see scoring.ts). */
  readonly totalBudgetMs: number;
  /** Difficulty of the first round (per-round values are in `generatorInfo`). */
  readonly blocks: number;
  readonly angleMask: number;
  readonly timeBudgetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Mental Rotation always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Mental Rotation game. Applied
 * only in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type SpatialAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  /**
   * Periodic round-clock update from the screen. `remainingMs` is the time
   * left in the current round's budget measured against the SDK lifecycle's
   * active (non-paused) elapsed time; `<= 0` ends the round as a timeout.
   */
  | { type: 'clock-tick'; remainingMs: number }
  | { type: 'answer'; answer: RoundKind }
  /**
   * Advance to the next round. `roundStartedElapsedMs` is the lifecycle
   * active-elapsed value at which the new round begins (the screen reads it
   * from the SDK lifecycle, which the reducer cannot reach).
   */
  | { type: 'next-round'; roundStartedElapsedMs: number }
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
export interface SpatialGameState {
  phase: SpatialPhase;
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
  /** Total rounds in this session (from the resolved difficulty). */
  rounds: number;
  /** Block count of the current round's shapes. */
  blocks: number;
  /** Allowed rotation-angle bitmask of the current round (see difficulty.ts). */
  angleMask: number;
  /** Time budget of the current round in ms. */
  timeBudgetMs: number;
  /** Lifecycle active-elapsed ms at the start of the current round. */
  roundStartedElapsedMs: number;
  /** Latest remaining budget (ms) reported by the screen clock. */
  timeRemainingMs: number;
  /** Target shape of the current round (canonical orientation). */
  target: readonly Block[];
  /** Candidate shape of the current round (already rotated/mirrored/altered). */
  candidate: readonly Block[];
  /** The correct answer of the current round. */
  kind: RoundKind | null;
  /** Display rotation applied to the candidate (one of the round's angle set). */
  candidateDegrees: RotationDegrees | null;
  /** How the candidate was produced (diagnostics; 'rotate' implies SAME). */
  transform: 'rotate' | 'mirror' | 'alter' | null;
  roundOutcome: RoundOutcome | null;
  /** Adaptive-only: continuous difficulty position within [0, 1]. */
  adaptivePosition: number;
  stats: SpatialStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialSpatialState(): SpatialGameState {
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
    rounds: 0,
    blocks: 0,
    angleMask: 0,
    timeBudgetMs: 0,
    roundStartedElapsedMs: 0,
    timeRemainingMs: 0,
    target: [],
    candidate: [],
    kind: null,
    candidateDegrees: null,
    transform: null,
    roundOutcome: null,
    adaptivePosition: 0.5,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
