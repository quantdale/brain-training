/**
 * Symbol Tracker game — shared types (multiple-object identity tracking variant).
 *
 * The player is shown a board of distinct symbols, a subset of which are
 * highlighted as "track these". After a brief observe window the board
 * scrambles to new positions (discrete relayout — no continuous animation
 * timing) and extra distractor symbols may appear; the player must then pick
 * out the originally-tracked symbols by IDENTITY. This is a pure state machine
 * over `SymbolTrackerGameState` (see reducer.ts).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'attention-symbol-tracker';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SymbolTrackerDifficultyParams {
  /** Board size (9 → 3×3, 16 → 4×4). */
  readonly gridSize: number;
  /** Number of distinct symbols placed on the observe board. */
  readonly tokenCount: number;
  /** Number of those symbols the player must track. */
  readonly initialTrackCount: number;
  /** Observe duration in ms before the scramble. */
  readonly observeMs: number;
  /** Extra distractor symbols added after the scramble. */
  readonly distractors: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: per-round track-count lower bound. */
  readonly minTrackCount?: number;
  /** Adaptive-only: per-round track-count upper bound. */
  readonly maxTrackCount?: number;
}

export type SymbolTrackerPhase = 'intro' | 'observe' | 'respond' | 'roundResult' | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SymbolTrackerStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Most tracked symbols correctly identified in one round. */
  readonly bestRecall: number;
  /** Total tracked symbols presented across the session. */
  readonly totalTargets: number;
  /** Total correctly identified tracked symbols across the session. */
  readonly correctTargets: number;
  /** Total non-tracked symbols wrongly selected across the session. */
  readonly wrongTaps: number;
}

export const INITIAL_STATS: Readonly<SymbolTrackerStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  bestRecall: 0,
  totalTargets: 0,
  correctTargets: 0,
  wrongTaps: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface SymbolTrackerRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestRecall: number;
  readonly bestStreak: number;
  readonly initialTrackCount: number;
  /** Distinct symbols placed on the observe board (escalation cap). */
  readonly tokenCount: number;
  readonly gridSize: number;
  readonly observeMs: number;
  readonly distractors: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Symbol Tracker always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Symbol Tracker game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type SymbolTrackerAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'observe-tick' }
  | { type: 'tap-cell'; index: number }
  | { type: 'submit' }
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

/** Complete game state; the screen renders this and dispatches actions. */
export interface SymbolTrackerGameState {
  phase: SymbolTrackerPhase;
  /** True while the SDK lifecycle is paused (timers frozen). */
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
  /** Number of symbols to track this round. */
  trackCount: number;
  /** Observe board: symbol id per cell (-1 = empty). */
  observeBoard: readonly number[];
  /** Respond board: symbol id per cell (-1 = empty), scrambled + distractors. */
  respondBoard: readonly number[];
  /** The set of symbol ids that were tracked (the answer). */
  trackedSymbolIds: readonly number[];
  /** Cells the player has selected in the respond phase (symbol ids). */
  selections: readonly number[];
  /** True when the current round has been checked. */
  roundScored: boolean;
  /** Correctly identified tracked symbols in the current round (after submit). */
  roundCorrectTargets: number;
  /** Wrong (non-tracked) symbols selected in the current round. */
  roundWrongTaps: number;
  roundOutcome: 'passed' | 'failed' | null;
  /** The tracked symbol ids of the previous round (diagnostics). */
  prevTracked: readonly number[] | null;
  stats: SymbolTrackerStats;
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

export function createInitialSymbolTrackerState(): SymbolTrackerGameState {
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
    trackCount: 0,
    observeBoard: [],
    respondBoard: [],
    trackedSymbolIds: [],
    selections: [],
    roundScored: false,
    roundCorrectTargets: 0,
    roundWrongTaps: 0,
    roundOutcome: null,
    prevTracked: null,
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
