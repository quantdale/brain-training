/**
 * Rule Grid game — shared types (Latin-square constraint inference).
 *
 * The game is a pure state machine over `RuleGridGameState` (see reducer.ts);
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
export const GAME_ID = 'logic-rule-grid';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface RuleGridDifficultyParams {
  /** Side length of the (square) grid: symbols are 0..size-1. */
  readonly size: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-round time budget in milliseconds (answer auto-times-out at 0). */
  readonly roundTimeMs: number;
}

export type RuleGridPhase =
  | 'intro'
  | 'showGrid'
  | 'roundResult'
  | 'results';

/** One generated round: a Latin square puzzle with chained deduction. */
export interface RuleGridRound {
  /** Side length (n). */
  readonly size: number;
  /** The full solution grid; each inner row is a permutation of 0..size-1. */
  readonly square: readonly (readonly number[])[];
  /** Flat index of the primary blank cell the player must answer (0..size*size-1). */
  readonly blankIndex: number;
  /** Row of the primary blank cell (floor(blankIndex / size)). */
  readonly blankRow: number;
  /** Column of the primary blank cell (blankIndex % size). */
  readonly blankCol: number;
  /** The unique symbol that belongs in the primary blank cell. */
  readonly answer: number;
  /** Answer candidates shown to the player (includes `answer`). */
  readonly options: readonly number[];
  /** All hidden cells (flat indices); includes `blankIndex`. At least one. */
  readonly blanks: readonly number[];
  /** Dependency depth: number of singleton propagation layers needed to solve all blanks (≥1). */
  readonly depth: number;
  /** Whether the puzzle was solved by singleton propagation alone (true when fullyPropagated). */
  readonly fullyPropagated: boolean;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface RuleGridStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly totalElapsedMs: number;
  readonly totalBudgetMs: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Fastest correct answer time in ms (Infinity until a correct answer). */
  readonly bestRoundTimeMs: number;
}

export const INITIAL_STATS: Readonly<RuleGridStats> = Object.freeze({
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
export interface RuleGridRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly bestRoundTimeMs: number;
  readonly totalElapsedMs: number;
  readonly totalBudgetMs: number;
  readonly size: number;
  readonly roundTimeMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Rule Grid always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Rule Grid game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type RuleGridAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'answer'; selectedValue: number | null; elapsedMs: number }
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
export interface RuleGridGameState {
  phase: RuleGridPhase;
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
  currentRound: RuleGridRound | null;
  /** Previous round (for near-duplicate avoidance + diagnostics). */
  prevRound: RuleGridRound | null;
  /** The symbol the player selected this round (null = timed out). */
  selectedValue: number | null;
  /** Whether the current round was answered correctly. */
  roundCorrect: boolean | null;
  /** Outcome after the player answers (or times out). */
  roundOutcome: 'correct' | 'wrong' | 'timeout' | null;
  stats: RuleGridStats;
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

export function createInitialRuleGridState(): RuleGridGameState {
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
    prevRound: null,
    selectedValue: null,
    roundCorrect: null,
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
