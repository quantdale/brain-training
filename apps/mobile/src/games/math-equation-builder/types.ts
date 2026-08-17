/**
 * Math Equation Builder game — shared types.
 *
 * The game is a pure state machine over `MathEquationBuilderGameState` (see reducer.ts);
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
export const GAME_ID = 'math-equation-builder';

/** Supported operators. */
export type Operator = '+' | '-' | '×' | '÷';

/** A token in the equation being built. */
export type EquationToken = number | Operator | '(' | ')';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface MathEquationBuilderDifficultyParams {
  /** Number of available numbers per puzzle. */
  readonly numbersCount: number;
  /** Minimum target number (inclusive). */
  readonly targetMin: number;
  /** Maximum target number (inclusive). */
  readonly targetMax: number;
  /** Allowed operators. */
  readonly operators: readonly Operator[];
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-puzzle time budget in milliseconds. */
  readonly timeBudgetMs: number;
  /** Adaptive-only: numbersCount lower bound. */
  readonly minNumbersCount?: number;
  /** Adaptive-only: numbersCount upper bound. */
  readonly maxNumbersCount?: number;
  /** Adaptive-only: targetMin lower bound. */
  readonly minTarget?: number;
  /** Adaptive-only: targetMax upper bound. */
  readonly maxTarget?: number;
}

export type MathEquationBuilderPhase =
  | 'intro'
  | 'playing'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface MathEquationBuilderStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalTimeBonus: number;
  readonly puzzlesSolvedFirstTry: number;
}

export const INITIAL_STATS: Readonly<MathEquationBuilderStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  totalTimeBonus: 0,
  puzzlesSolvedFirstTry: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface MathEquationBuilderRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalTimeBonus: number;
  readonly puzzlesSolvedFirstTry: number;
  readonly numbersCount: number;
  readonly targetMin: number;
  readonly targetMax: number;
  readonly operators: readonly Operator[];
  readonly timeBudgetMs: number;
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
 * QA force-state patch keys supported by the Equation Builder game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type MathEquationBuilderAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'add-number'; numberIndex: number }
  | { type: 'add-operator'; operator: Operator }
  | { type: 'group' }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'puzzle-timeout' }
  | { type: 'next-round' }
  | { type: 'tick-timer' }
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
export interface MathEquationBuilderGameState {
  phase: MathEquationBuilderPhase;
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
  /** Current puzzle target number. */
  target: number;
  /** Available numbers for the current puzzle. */
  availableNumbers: readonly number[];
  /** Operators allowed for the current puzzle. */
  allowedOperators: readonly Operator[];
  /** The equation tokens being built by the player. */
  equationTokens: readonly EquationToken[];
  /** Indices (into availableNumbers) already used in the equation. */
  usedNumberIndices: readonly number[];
  /** Whether the next expected input is an operator (true) or a number (false). */
  expectOperator: boolean;
  /** Whether the submitted equation evaluated correctly. */
  roundCorrect: boolean;
  /** Result of the submitted equation (null if not submitted). */
  roundResult: number | null;
  /** Time remaining for the current puzzle in ms. */
  timeRemainingMs: number;
  /** Time budget for the current puzzle in ms. */
  timeBudgetMs: number;
  /** Previous round's target (near-duplicate avoidance). */
  prevTarget: number | null;
  stats: MathEquationBuilderStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialMathEquationBuilderState(): MathEquationBuilderGameState {
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
    target: 0,
    availableNumbers: [],
    allowedOperators: [],
    equationTokens: [],
    usedNumberIndices: [],
    expectOperator: false,
    roundCorrect: false,
    roundResult: null,
    timeRemainingMs: 0,
    timeBudgetMs: 0,
    prevTarget: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
