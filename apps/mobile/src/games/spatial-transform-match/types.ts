/**
 * Spatial Transform Match — shared types.
 *
 * The game is a pure state machine over `SpatialTransformMatchGameState`
 * (see reducer.ts); this module owns the vocabulary the reducer, the UI, and
 * the persistence layer all consume.
 *
 * Mechanic: a 2D grid pattern is transformed (rotate/mirror); the player picks
 * the correct transformed version among distractors.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'spatial-transform-match';

// ---------------------------------------------------------------------------
// Transform types
// ---------------------------------------------------------------------------

/** The set of supported 2D grid transformations. */
export type TransformType = 'rotate90' | 'rotate180' | 'rotate270' | 'mirrorH' | 'mirrorV';

/** Human-readable labels for each transform (shown to the player). */
export const TRANSFORM_LABELS: Readonly<Record<TransformType, string>> = {
  rotate90: 'Rotate 90° clockwise',
  rotate180: 'Rotate 180°',
  rotate270: 'Rotate 270° clockwise',
  mirrorH: 'Mirror horizontally',
  mirrorV: 'Mirror vertically',
};

/** Every transform in the system (used as the full pool for distractors). */
export const ALL_TRANSFORMS: readonly TransformType[] = [
  'rotate90',
  'rotate180',
  'rotate270',
  'mirrorH',
  'mirrorV',
];

// ---------------------------------------------------------------------------
// Difficulty params
// ---------------------------------------------------------------------------

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SpatialTransformMatchDifficultyParams {
  /** Total cells in the grid (9 → 3×3, 16 → 4×4). */
  readonly gridSize: number;
  /** Number of filled cells in each source pattern. */
  readonly filledCells: number;
  /** Transforms the correct answer may use for this difficulty. */
  readonly allowedTransforms: readonly TransformType[];
  /** Total number of options (1 correct + distractors). */
  readonly optionCount: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** How long the source pattern is shown before options appear (ms). */
  readonly sourceRevealMs: number;
  /** Adaptive-only: per-round filled-cells lower bound. */
  readonly minFilledCells?: number;
  /** Adaptive-only: per-round filled-cells upper bound. */
  readonly maxFilledCells?: number;
  /** Adaptive-only: per-round option-count lower bound. */
  readonly minOptionCount?: number;
  /** Adaptive-only: per-round option-count upper bound. */
  readonly maxOptionCount?: number;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export type SpatialTransformMatchPhase =
  | 'intro'
  | 'source'
  | 'choice'
  | 'roundResult'
  | 'results';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpatialTransformMatchStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalAnswerMs: number;
}

export const INITIAL_STATS: Readonly<SpatialTransformMatchStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswerMs: 0,
});

// ---------------------------------------------------------------------------
// Raw result
// ---------------------------------------------------------------------------

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SpatialTransformMatchRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly averageAnswerMs: number;
  readonly bestStreak: number;
  readonly gridSize: number;
  readonly filledCells: number;
  readonly sourceRevealMs: number;
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
 * QA force-state patch keys supported by the Spatial Transform Match game.
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

export type SpatialTransformMatchAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'source-tick' }
  | { type: 'select-option'; index: number; answerMs: number }
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
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/** Complete game state; the screen renders this and dispatches actions. */
export interface SpatialTransformMatchGameState {
  phase: SpatialTransformMatchPhase;
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
  /** Grid side length (sqrt of gridSize). */
  side: number;
  /** Source pattern for the current round (cell indices). */
  sourcePattern: readonly number[];
  /** The transform applied to the source for the correct answer. */
  transformType: import('./types').TransformType;
  /** Human-readable label for the current transform. */
  transformLabel: string;
  /** All option patterns (1 correct + distractors), shuffled. */
  options: readonly (readonly number[])[];
  /** Index of the correct option in the options array. */
  correctOptionIndex: number;
  /** Index the player selected; null if not yet selected. */
  selectedOptionIndex: number | null;
  /** Outcome of the current round (null while in source/choice phase). */
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's transform type (near-duplicate avoidance). */
  prevTransformType: TransformType | null;
  /** Previous round's source pattern (near-duplicate avoidance). */
  prevSourcePattern: readonly number[] | null;
  stats: SpatialTransformMatchStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialState(): SpatialTransformMatchGameState {
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
    side: 3,
    sourcePattern: [],
    transformType: 'rotate90',
    transformLabel: '',
    options: [],
    correctOptionIndex: 0,
    selectedOptionIndex: null,
    roundOutcome: null,
    prevTransformType: null,
    prevSourcePattern: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
