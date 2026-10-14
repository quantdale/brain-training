/**
 * Memory game — shared types (sequence-recall variant).
 *
 * The game is a pure state machine over `MemoryGameState` (see reducer.ts);
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
export const GAME_ID = 'memory';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface MemoryDifficultyParams {
  /** Total tiles in the grid (9 → 3×3, 16 → 4×4). */
  readonly gridSize: number;
  /** Sequence length of round 1. */
  readonly initialSequenceLength: number;
  /** Per-tile reveal duration in ms. */
  readonly revealMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: per-round sequence-length lower bound. */
  readonly minSequenceLength?: number;
  /** Adaptive-only: per-round sequence-length upper bound. */
  readonly maxSequenceLength?: number;
}

export type MemoryPhase = 'intro' | 'reveal' | 'input' | 'roundResult' | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface MemoryStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly longestSequence: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
}

export const INITIAL_STATS: Readonly<MemoryStats> = Object.freeze({
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
export interface MemoryRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly longestSequence: number;
  readonly bestStreak: number;
  readonly initialSequenceLength: number;
  readonly gridSize: number;
  readonly revealMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Memory always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Memory game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

/** A callback remains bound to the session, round, phase and pause epoch it rendered. */
export interface MemoryWindowStamp {
  readonly sessionId: string | null;
  readonly roundIndex: number;
  readonly inputEpoch: number;
  readonly phase: MemoryPhase;
}

export interface MemoryRevealStamp extends MemoryWindowStamp {
  /** Sequence position, never a tile identity. */
  readonly revealedIndex: number;
}

export interface MemoryRecallStamp extends MemoryWindowStamp {
  readonly inputIndex: number;
}

export type MemoryAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number; nowMs: number }
  | { type: 'reveal-tick'; nowMs: number; stamp: MemoryRevealStamp }
  | { type: 'tap-tile'; index: number; stamp: MemoryRecallStamp }
  | { type: 'next-round'; nowMs: number; stamp: MemoryWindowStamp }
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
export interface MemoryGameState {
  phase: MemoryPhase;
  /** Changes on session start and each pause/resume boundary. */
  inputEpoch: number;
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
  /** Sequence position currently flashing; -1 when not revealing. */
  revealedIndex: number;
  /** Exact current-tile exposure deadline and the frozen pause remainder. */
  revealDeadlineMs: number;
  revealRemainingMs: number;
  /** Next expected position during input. */
  inputIndex: number;
  /** Taps recorded this round (in order). */
  taps: readonly number[];
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's sequence (near-duplicate avoidance + diagnostics). */
  prevSequence: readonly number[] | null;
  stats: MemoryStats;
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

export function createInitialMemoryState(): MemoryGameState {
  return {
    phase: 'intro',
    inputEpoch: 0,
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
    revealDeadlineMs: 0,
    revealRemainingMs: 0,
    inputIndex: 0,
    taps: [],
    roundOutcome: null,
    prevSequence: null,
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

export function windowStamp(state: MemoryGameState): MemoryWindowStamp {
  return { sessionId: state.sessionId, roundIndex: state.roundIndex, inputEpoch: state.inputEpoch, phase: state.phase };
}

export function revealStamp(state: MemoryGameState): MemoryRevealStamp {
  return { ...windowStamp(state), revealedIndex: state.revealedIndex };
}

export function recallStamp(state: MemoryGameState): MemoryRecallStamp {
  return { ...windowStamp(state), inputIndex: state.inputIndex };
}

export function isCurrentWindow(state: MemoryGameState, stamp: MemoryWindowStamp): boolean {
  return stamp != null && stamp.sessionId === state.sessionId &&
    stamp.roundIndex === state.roundIndex && stamp.inputEpoch === state.inputEpoch && stamp.phase === state.phase;
}
