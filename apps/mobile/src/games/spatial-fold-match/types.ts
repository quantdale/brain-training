/**
 * Spatial Fold Match — shared types.
 *
 * The game is a pure state machine over `SpatialFoldMatchGameState`
 * (see reducer.ts); this module owns the vocabulary the reducer, the UI, and
 * the persistence layer all consume.
 *
 * Mechanic: a 2D grid pattern is folded along an axis (or both axes for the
 * expert "double fold"); the two halves MERGE by OR, so a folded cell is
 * filled when either the kept half OR the folded-over half is filled. The
 * player picks the correctly folded result among distractors.
 *
 * Unlike the rotation/mirror-transform game, this is a plain paper fold with
 * no 3D; it is rendered with plain `View`s (no Skia).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'spatial-fold-match';

// ---------------------------------------------------------------------------
// Fold types
// ---------------------------------------------------------------------------

/** The set of supported paper folds. */
export type FoldType = 'foldV' | 'foldH' | 'foldVH';

/** Human-readable labels for each fold (shown to the player). */
export const FOLD_LABELS: Readonly<Record<FoldType, string>> = {
  foldV: 'Fold the left half onto the right',
  foldH: 'Fold the top half onto the bottom',
  foldVH: 'Fold both halves (vertical then horizontal)',
};

/** Every fold in the system (used as the full pool for distractors). */
export const ALL_FOLDS: readonly FoldType[] = ['foldV', 'foldH', 'foldVH'];

// ---------------------------------------------------------------------------
// Difficulty params
// ---------------------------------------------------------------------------

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SpatialFoldMatchDifficultyParams {
  /** Number of grid rows. */
  readonly gridRows: number;
  /** Number of grid columns. */
  readonly gridCols: number;
  /** Number of filled cells in each source pattern. */
  readonly filledCells: number;
  /** Folds the correct answer may use for this difficulty. */
  readonly foldsAllowed: readonly FoldType[];
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

export type SpatialFoldMatchPhase =
  | 'intro'
  | 'source'
  | 'choice'
  | 'roundResult'
  | 'results';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpatialFoldMatchStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalAnswerMs: number;
}

export const INITIAL_STATS: Readonly<SpatialFoldMatchStats> = Object.freeze({
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
export interface SpatialFoldMatchRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly averageAnswerMs: number;
  readonly bestStreak: number;
  readonly gridRows: number;
  readonly gridCols: number;
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
 * QA force-state patch keys supported by the Spatial Fold Match game.
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

export type SpatialFoldMatchAction =
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
export interface SpatialFoldMatchGameState {
  phase: SpatialFoldMatchPhase;
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
  /** Source pattern for the current round (filled-cell matrix). */
  sourceGrid: readonly (readonly boolean[])[];
  /** The fold applied to the source for the correct answer. */
  foldType: FoldType;
  /** Human-readable label for the current fold. */
  foldLabel: string;
  /** Result grid dimensions (post-fold). */
  resultRows: number;
  resultCols: number;
  /** All option patterns (1 correct + distractors), shuffled. */
  options: readonly (readonly (readonly boolean[])[])[];
  /** Index of the correct option in the options array. */
  correctOptionIndex: number;
  /** Index the player selected; null if not yet selected. */
  selectedOptionIndex: number | null;
  /** Outcome of the current round (null while in source/choice phase). */
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's fold type (near-duplicate avoidance). */
  prevFoldType: FoldType | null;
  /** Previous round's source pattern (near-duplicate avoidance). */
  prevSourceGrid: readonly (readonly boolean[])[] | null;
  stats: SpatialFoldMatchStats;
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

export function createInitialSpatialFoldMatchState(): SpatialFoldMatchGameState {
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
    sourceGrid: [],
    foldType: 'foldV',
    foldLabel: '',
    resultRows: 0,
    resultCols: 0,
    options: [],
    correctOptionIndex: 0,
    selectedOptionIndex: null,
    roundOutcome: null,
    prevFoldType: null,
    prevSourceGrid: null,
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
