/**
 * Spatial Coordinate Turn — shared types.
 *
 * The game is a pure state machine over `SpatialCoordinateTurnGameState`
 * (see reducer.ts). This module owns the vocabulary the reducer, UI, and
 * persistence layer consume.
 *
 * Mechanic (distinct from Spatial Grid Navigator):
 *   - A marker starts at the origin (0,0) facing a heading on a FREE, unbounded
 *     coordinate plane (no walls → no impossible geometry; integer positions
 *     are always valid).
 *   - A sequence of turn/move commands is shown.
 *   - The player answers either the FINAL FACING HEADING (orientation) among
 *     the active direction set (4 or 8), or — on expert "position" trials —
 *     the FINAL COORDINATE.
 *   - Framing is compass / relative-coordinate based: N is just a label, no
 *     real-world "up" bias is required to solve.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'spatial-coordinate-turn';

// ---------------------------------------------------------------------------
// Direction vocabulary
// ---------------------------------------------------------------------------

/**
 * A compass heading. 4-way base is 'N' | 'E' | 'S' | 'W'; the 8-way set adds
 * the diagonals. The active set for a session is `directions` (4 or 8).
 */
export type Dir = 'N' | 'E' | 'S' | 'W' | 'NE' | 'SE' | 'SW' | 'NW';

/** Coordinate on the free plane. x = east+, y = north+ (no bounds). */
export interface Coord {
  readonly x: number;
  readonly y: number;
}

/** A single command applied during a round. */
export type CommandType = 'left' | 'right' | 'about' | 'forward' | 'back';

/** A command; `steps` is only used by `forward`/`back` (k ∈ [1, moveMax]). */
export interface Command {
  readonly type: CommandType;
  /** Number of cells to move for `forward`/`back`; omitted for turns. */
  readonly steps?: number;
}

// ---------------------------------------------------------------------------
// Difficulty params
// ---------------------------------------------------------------------------

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SpatialCoordinateTurnDifficultyParams {
  /** Active direction count: 4 (cardinal) or 8 (cardinal + diagonal). */
  readonly directions: 4 | 8;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Minimum number of commands in a round. */
  readonly minSteps: number;
  /** Maximum number of commands in a round. */
  readonly maxSteps: number;
  /** Maximum forward/back distance per move command. */
  readonly moveMax: number;
  /** When true, some trials ask for the final coordinate instead of heading. */
  readonly askPosition: boolean;
  /** Target response time that scores full speed bonus (ms). */
  readonly speedTargetMs: number;
  /**
   * Generous per-tier study window for the brief phase; when it expires the
   * game auto-transitions to the answer options so players cannot pre-solve
   * indefinitely for a free speed bonus.
   */
  readonly briefBudgetMs: number;
  /** Adaptive-only: direction-count lower/upper bounds. */
  readonly minDirections?: number;
  /** Adaptive-only: direction-count lower/upper bounds. */
  readonly maxDirections?: number;
  /** Adaptive-only: max-steps lower/upper bounds. */
  readonly minMaxSteps?: number;
  /** Adaptive-only: max-steps lower/upper bounds. */
  readonly maxMaxSteps?: number;
  /** Adaptive-only: moveMax lower/upper bounds. */
  readonly minMoveMax?: number;
  /** Adaptive-only: moveMax lower/upper bounds. */
  readonly maxMoveMax?: number;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export type SpatialCoordinateTurnPhase =
  | 'intro'
  | 'brief'
  | 'choice'
  | 'roundResult'
  | 'results';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpatialCoordinateTurnStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalResponseMs: number;
  readonly scoredPicks: number;
  readonly positionTrials: number;
  readonly positionCorrect: number;
}

export const INITIAL_STATS: Readonly<SpatialCoordinateTurnStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  correctPicks: 0,
  mistakes: 0,
  bestStreak: 0,
  streak: 0,
  totalResponseMs: 0,
  scoredPicks: 0,
  positionTrials: 0,
  positionCorrect: 0,
});

// ---------------------------------------------------------------------------
// Generated round
// ---------------------------------------------------------------------------

/** A heading-answer trial: options are all directions in the active set. */
export interface HeadingRound {
  readonly task: 'heading';
  readonly start: Coord;
  readonly startDir: Dir;
  readonly commands: readonly Command[];
  readonly finalHeading: Dir;
  readonly finalPos: Coord;
  readonly directions: 4 | 8;
  readonly commandCount: number;
  readonly turnCount: number;
  readonly options: readonly Dir[];
  readonly correctIndex: number;
}

/** A position-answer trial: options are coordinates (1 correct + distractors). */
export interface PositionRound {
  readonly task: 'position';
  readonly start: Coord;
  readonly startDir: Dir;
  readonly commands: readonly Command[];
  readonly finalHeading: Dir;
  readonly finalPos: Coord;
  readonly directions: 4 | 8;
  readonly commandCount: number;
  readonly turnCount: number;
  readonly options: readonly Coord[];
  readonly correctIndex: number;
}

/** A fully generated, deterministic round (heading or position task). */
export type SpatialCoordinateTurnRound = HeadingRound | PositionRound;

// ---------------------------------------------------------------------------
// Raw result
// ---------------------------------------------------------------------------

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SpatialCoordinateTurnRawResult extends GameRawResult {
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
  readonly positionTrials: number;
  readonly positionCorrect: number;
  readonly directions: 4 | 8;
  readonly rounds: number;
  readonly minSteps: number;
  readonly maxSteps: number;
  readonly moveMax: number;
  readonly askPosition: boolean;
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
 * QA force-state patch keys supported by the Spatial Coordinate Turn game.
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

export type SpatialCoordinateTurnAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'brief-tick' }
  | { type: 'select-answer'; index: number; answerMs: number }
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
  | { type: 'qa/force-timeout' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/** Complete game state; the screen renders this and dispatches actions. */
export interface SpatialCoordinateTurnGameState {
  phase: SpatialCoordinateTurnPhase;
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
  plan: readonly SpatialCoordinateTurnRound[];
  /** The current round (null before the session starts). */
  round: SpatialCoordinateTurnRound | null;
  /** Index the player selected; null if not yet selected. */
  selectedOptionIndex: number | null;
  /** Outcome of the current round (null while in brief/choice phase). */
  roundOutcome: 'correct' | 'wrong' | null;
  stats: SpatialCoordinateTurnStats;
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

export function createInitialSpatialCoordinateTurnState(): SpatialCoordinateTurnGameState {
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
