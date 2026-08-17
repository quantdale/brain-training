/**
 * Sequence Memory game — shared types (Simon-style score attack).
 *
 * The game is a pure state machine over `SequenceMemoryGameState` (see
 * reducer.ts); this module owns the vocabulary the reducer, the UI, and the
 * persistence layer all consume.
 *
 * Distinct from the Phase-2 Memory game (rounds-based, 9/16-tile grids,
 * sequence length holds on failure): this variant runs an unbounded
 * score attack against a monotonic time budget, on a small Simon pad
 * (4 or 9 tiles), and a wrong tap ends the round with the next round
 * restarting at the difficulty's base length (classic Simon rule).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'memory-sequence-memory';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SequenceMemoryDifficultyParams {
  /** Tiles on the pad (4 → 2×2 Simon pad, 9 → 3×3). */
  readonly tileCount: number;
  /** Sequence length of the first round (and after a failed round, fixed levels). */
  readonly baseLength: number;
  /** Sequence-length ceiling; passes escalate toward it, never beyond. */
  readonly maxLength: number;
  /** Per-tile reveal duration in ms. */
  readonly revealMs: number;
  /** Score-attack time budget in seconds; the session ends when it expires. */
  readonly sessionSeconds: number;
  /** Adaptive-only: per-round sequence-length lower bound. */
  readonly minLength?: number;
}

export type SequenceMemoryPhase = 'intro' | 'reveal' | 'input' | 'roundResult' | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SequenceMemoryStats {
  readonly score: number;
  /** Number of sequence rounds that were started (attempts). */
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly longestSequence: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
}

export const INITIAL_STATS: Readonly<SequenceMemoryStats> = Object.freeze({
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
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SequenceMemoryRawResult extends GameRawResult {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly longestSequence: number;
  readonly bestStreak: number;
  readonly baseLength: number;
  readonly maxLength: number;
  readonly tileCount: number;
  readonly revealMs: number;
  readonly sessionSeconds: number;
  /** True when the session ended because the time budget expired. */
  readonly timeUp: boolean;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Sequence Memory always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by Sequence Memory. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type SequenceMemoryAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'reveal-tick' }
  | { type: 'tap-tile'; index: number }
  | { type: 'next-round' }
  /** Screen-dispatched when the monotonic time budget is exhausted. */
  | { type: 'time-up' }
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
  /** End the session; the in-flight round counts as passed. */
  | { type: 'qa/force-win' }
  /** End the session; the in-flight round counts as failed. */
  | { type: 'qa/force-lose' }
  /** End the session with the canonical perfect-run statistics. */
  | { type: 'qa/force-perfect' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface SequenceMemoryGameState {
  phase: SequenceMemoryPhase;
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
  /** 0-based index of the current sequence round. */
  roundIndex: number;
  /** Sequence length of the current round. */
  length: number;
  /** Tile indices of the current round's sequence. */
  sequence: readonly number[];
  /** Tile currently flashing during reveal; -1 when not revealing. */
  revealedIndex: number;
  /** Next expected position during input. */
  inputIndex: number;
  /** Taps recorded this round (in order). */
  taps: readonly number[];
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's sequence (near-duplicate avoidance + diagnostics). */
  prevSequence: readonly number[] | null;
  /** True when the session ended because the time budget expired. */
  timeUp: boolean;
  stats: SequenceMemoryStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialSequenceMemoryState(): SequenceMemoryGameState {
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
    revealedIndex: -1,
    inputIndex: 0,
    taps: [],
    roundOutcome: null,
    prevSequence: null,
    timeUp: false,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
