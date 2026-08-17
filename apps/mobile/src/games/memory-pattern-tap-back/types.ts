/**
 * Memory Pattern Tap Back — shared types.
 *
 * A grid of tiles lights up in a sequence (observe phase).
 * The sequence fades. The player must tap the tiles in the same order
 * (recall phase). Each round adds one more step to the sequence.
 * The game ends when the player makes a mistake or completes all rounds.
 *
 * This is a pure state machine over `PatternTapBackState` (see reducer.ts).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'memory-pattern-tap-back';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface PatternTapBackDifficultyParams {
  /** Total tiles in the grid (9 → 3×3, 16 → 4×4). */
  readonly gridSize: number;
  /** Sequence length of round 1. */
  readonly initialSequenceLength: number;
  /** Max sequence length achievable. */
  readonly maxSequenceLength: number;
  /** Observation duration per tile in ms (scales with step). */
  readonly baseObserveMs: number;
  /** Per-step additional observation duration in ms. */
  readonly stepObserveMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /**
   * Adaptive-only: grid size for later rounds. When present, the grid
   * escalates from `gridSize` to `escalatedGridSize` at round 3+.
   * Absent in fixed-level params (the SDK parameters contract only
   * accepts `Record<string, number>`).
   */
  readonly escalatedGridSize?: number;
}

export type PatternTapBackPhase =
  | 'intro'
  | 'observe'
  | 'recall'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface PatternTapBackStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly longestSequence: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
}

export const INITIAL_STATS: Readonly<PatternTapBackStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  longestSequence: 0,
  totalTaps: 0,
  correctTaps: 0,
});

/**
 * Raw result persisted with every completed session.
 * Everything needed to reconstruct the exact session is present.
 */
export interface PatternTapBackRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly longestSequence: number;
  readonly bestStreak: number;
  /** Sequence lengths of each completed (passed) round, in order. */
  readonly completedRoundLengths: readonly number[];
  readonly initialSequenceLength: number;
  readonly maxSequenceLength: number;
  readonly gridSize: number;
  readonly baseObserveMs: number;
  readonly stepObserveMs: number;
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
 * QA force-state patch keys supported by the Pattern Tap Back game.
 * Applied only in the `intro` phase; unknown keys are ignored. Dev-only.
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type PatternTapBackAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'observe-tick' }
  | { type: 'tap-tile'; index: number }
  | { type: 'recall-tick' }
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

/** Complete game state; the screen renders this and dispatches actions. */
export interface PatternTapBackState {
  phase: PatternTapBackPhase;
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
  /** Sequence length of the current round. */
  length: number;
  /** Tile indices of the current round's sequence. */
  sequence: readonly number[];
  /** Tile currently flashing during observe; -1 when not observing. */
  observeIndex: number;
  /** Next expected position during recall. */
  inputIndex: number;
  /** Whether the auto-highlight timer is active after a correct tap. */
  recallHighlight: boolean;
  /** Taps recorded this round (in order). */
  taps: readonly number[];
  roundOutcome: 'passed' | 'failed' | null;
  /** Sequence lengths of each completed (passed) round, in order. */
  completedRoundLengths: readonly number[];
  /** Previous round's sequence (near-duplicate avoidance + diagnostics). */
  prevSequence: readonly number[] | null;
  stats: PatternTapBackStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialState(): PatternTapBackState {
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
    length: 0,
    sequence: [],
    observeIndex: -1,
    inputIndex: 0,
    recallHighlight: false,
    taps: [],
    roundOutcome: null,
    completedRoundLengths: [],
    prevSequence: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
