/**
 * Spatial Grid Navigator — shared types.
 *
 * The game is a pure state machine over `SpatialGridNavGameState` (see
 * reducer.ts). This module owns the vocabulary the reducer, UI, and
 * persistence layer all consume.
 *
 * Mechanic: a marker sits on an N×N grid at a start cell facing a direction.
 * A sequence of movement/rotation commands is shown. The player must identify
 * the FINAL CELL (answered by tapping a cell among options). This tests
 * mentally executing moves/orientation — distinct from shape-rotation matching.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'spatial-grid-nav';

// ---------------------------------------------------------------------------
// Grid vocabulary
// ---------------------------------------------------------------------------

/** A cell on the grid, 0-indexed from the top-left. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

/** Facing direction. */
export type Dir = 'N' | 'E' | 'S' | 'W';

/** A single movement/rotation command. */
export type CommandType = 'forward' | 'back' | 'left' | 'right';

/** A command applied during a round. */
export interface Command {
  readonly type: CommandType;
}

// ---------------------------------------------------------------------------
// Difficulty params
// ---------------------------------------------------------------------------

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SpatialGridNavDifficultyParams {
  /** Grid side length (grid has `gridSide` × `gridSide` cells). */
  readonly gridSide: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Minimum number of commands in a round. */
  readonly minCommandCount: number;
  /** Maximum number of commands in a round. */
  readonly maxCommandCount: number;
  /** Whether `back` (reverse) moves are allowed. */
  readonly allowBack: boolean;
  /** Number of answer options (1 correct + distractors). */
  readonly options: number;
  /** Target response time that scores full speed bonus (ms). */
  readonly speedTargetMs: number;
  /** A round is "hard" when its commandCount >= this threshold. */
  readonly longThreshold: number;
  /** Adaptive-only: grid side lower/upper bounds. */
  readonly minGridSide?: number;
  /** Adaptive-only: grid side lower/upper bounds. */
  readonly maxGridSide?: number;
  /** Adaptive-only: max-command-count lower/upper bounds. */
  readonly minMaxCommand?: number;
  /** Adaptive-only: max-command-count lower/upper bounds. */
  readonly maxMaxCommand?: number;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export type SpatialGridNavPhase = 'intro' | 'trialActive' | 'trialResult' | 'results';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpatialGridNavStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalResponseMs: number;
  readonly scoredPicks: number;
  readonly hardPlayed: number;
  readonly hardCorrect: number;
}

export const INITIAL_STATS: Readonly<SpatialGridNavStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  correctPicks: 0,
  mistakes: 0,
  bestStreak: 0,
  streak: 0,
  totalResponseMs: 0,
  scoredPicks: 0,
  hardPlayed: 0,
  hardCorrect: 0,
});

// ---------------------------------------------------------------------------
// Generated round
// ---------------------------------------------------------------------------

/** A fully generated, deterministic round. */
export interface GeneratedRound {
  /** Start cell of the marker. */
  readonly start: Cell;
  /** Facing direction at the start. */
  readonly startDir: Dir;
  /** The full command sequence. */
  readonly commands: readonly Command[];
  /** The correct final cell (result of simulating the commands). */
  readonly finalCell: Cell;
  /** All answer options (distinct, in-bounds); exactly one equals finalCell. */
  readonly options: readonly Cell[];
  /** Index of the correct option within `options`. */
  readonly correctIndex: number;
  /** Total number of commands. */
  readonly commandCount: number;
  /** Number of turn (left/right) commands. */
  readonly turnCount: number;
}

// ---------------------------------------------------------------------------
// Raw result
// ---------------------------------------------------------------------------

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SpatialGridNavRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalResponseMs: number;
  readonly scoredPicks: number;
  readonly averageResponseMs: number;
  readonly speedScore: number;
  readonly hardPlayed: number;
  readonly hardCorrect: number;
  readonly hardAccuracy: number;
  readonly gridSide: number;
  readonly minCommandCount: number;
  readonly maxCommandCount: number;
  readonly allowBack: boolean;
  readonly options: number;
  readonly speedTargetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; this game always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

// ---------------------------------------------------------------------------
// QA force-state
// ---------------------------------------------------------------------------

/**
 * QA force-state patch keys supported by the Spatial Grid Navigator game.
 * Applied only in the `intro` phase; unknown keys are ignored. Dev-only
 * (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type SpatialGridNavAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'pick-cell'; index: number; responseMs: number }
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
  | {
      type: 'completion-outcome-received';
      xp: number;
      currency: number;
      deltas: readonly { domain: string; delta: number; ratingAfter: number }[];
    }
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/** Complete game state; the screen renders this and dispatches actions. */
export interface SpatialGridNavGameState {
  phase: SpatialGridNavPhase;
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
  /** Total number of rounds in the session (plan length). */
  rounds: number;
  /** The generated plan for the whole session. */
  plan: readonly GeneratedRound[];
  /** The current round (null before the session starts). */
  round: GeneratedRound | null;
  /** Index the player selected; null if not yet selected. */
  selectedOptionIndex: number | null;
  /** Outcome of the current round (null while in trialActive phase). */
  roundOutcome: 'correct' | 'wrong' | null;
  stats: SpatialGridNavStats;
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

export function createInitialState(): SpatialGridNavGameState {
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
    plan: [],
    round: null,
    selectedOptionIndex: null,
    roundOutcome: null,
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

/** True when two cells are identical. */
export function cellsEqual(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}
