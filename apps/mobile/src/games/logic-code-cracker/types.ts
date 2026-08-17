/**
 * Code Cracker game — shared types (Mastermind-style deduction).
 *
 * The game is a pure state machine over `CodeCrackerGameState` (see reducer.ts);
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
export const GAME_ID = 'logic-code-cracker';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface CodeCrackerDifficultyParams {
  /** Number of pegs in the code (4 for standard). */
  readonly codeLength: number;
  /** Number of available colors (6 for standard). */
  readonly colorCount: number;
  /** Maximum guesses allowed per round. */
  readonly guessBudget: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: per-round code-length lower bound. */
  readonly minLength?: number;
  /** Adaptive-only: per-round code-length upper bound. */
  readonly maxLength?: number;
}

export type CodeCrackerPhase =
  | 'intro'
  | 'roundReveal'
  | 'input'
  | 'roundResult'
  | 'results';

/** Feedback on a guess: exact matches (right color, right position) and color-only (right color, wrong position). */
export interface GuessFeedback {
  /** Number of pegs with correct color in correct position. */
  readonly exact: number;
  /** Number of pegs with correct color but wrong position. */
  readonly colorOnly: number;
}

/** One guess entry in the history. */
export interface GuessEntry {
  /** The colors the player guessed (0-based indices). */
  readonly guess: readonly number[];
  /** Feedback for this guess. */
  readonly feedback: GuessFeedback;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface CodeCrackerStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsSolved: number;
  readonly totalGuessesUsed: number;
  readonly totalGuessesBudget: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Fewest guesses used to solve a single round (Infinity if none solved). */
  readonly bestSolveGuesses: number;
}

export const INITIAL_STATS: Readonly<CodeCrackerStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsSolved: 0,
  totalGuessesUsed: 0,
  totalGuessesBudget: 0,
  bestStreak: 0,
  streak: 0,
  bestSolveGuesses: Number.POSITIVE_INFINITY,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface CodeCrackerRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsSolved: number;
  readonly accuracy: number;
  readonly totalGuessesUsed: number;
  readonly totalGuessesBudget: number;
  readonly bestStreak: number;
  readonly bestSolveGuesses: number;
  readonly codeLength: number;
  readonly colorCount: number;
  readonly guessBudget: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Code Cracker always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  /** Full guess history for diagnostics (round → guesses → feedback). */
  readonly guessHistory: readonly (readonly GuessEntry[])[];
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Code Cracker game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type CodeCrackerAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'reveal-code' }
  | { type: 'select-color'; colorIndex: number }
  | { type: 'clear-current-guess' }
  | { type: 'submit-guess' }
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
export interface CodeCrackerGameState {
  phase: CodeCrackerPhase;
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
  /** The secret code for the current round (hidden from player). */
  secretCode: readonly number[];
  /** Current guess being built (0-based indices). */
  currentGuess: readonly number[];
  /** Guess history for the current round. */
  roundGuesses: readonly GuessEntry[];
  /** Number of guesses used in the current round. */
  guessesUsed: number;
  /** Whether the current round was solved. */
  roundSolved: boolean;
  /** Outcome after revealing the code at round end. */
  roundOutcome: 'solved' | 'budget-exhausted' | null;
  /** Previous round's secret code (for near-duplicate avoidance + diagnostics). */
  prevSecretCode: readonly number[] | null;
  stats: CodeCrackerStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialCodeCrackerState(): CodeCrackerGameState {
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
    secretCode: [],
    currentGuess: [],
    roundGuesses: [],
    guessesUsed: 0,
    roundSolved: false,
    roundOutcome: null,
    prevSecretCode: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
