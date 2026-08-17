/**
 * Fast Math game — shared types (validated procedural arithmetic variant).
 *
 * The game is a pure state machine over `MathGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 *
 * Mechanic: a score-attack session of arithmetic problems (+, −, ×, ÷ with
 * always-exact results). Problems are generated procedurally with the SDK RNG
 * and validated at generation (integer operands, non-negative results,
 * division always exact); the player answers with a number pad and gets
 * immediate correct/incorrect feedback; score combines speed and accuracy.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'math-fast-math';

/** Arithmetic operators; division is always exact by construction. */
export type Operator = '+' | '−' | '×' | '÷';

/** Canonical operator order (also the decode order of the profile mask). */
export const OPERATORS: readonly Operator[] = ['+', '−', '×', '÷'];

/** One validated problem. All values are integers; answers are ≥ 0. */
export interface MathProblem {
  readonly operator: Operator;
  /** Displayed left operand (non-negative integer). */
  readonly left: number;
  /** Displayed right operand (positive integer; for ÷ this is the divisor). */
  readonly right: number;
  /** The exact answer; for ÷ `left === answer * right` always holds. */
  readonly answer: number;
}

/** Operand range for one operator (inclusive bounds). */
export interface OperatorRange {
  readonly maxLeft: number;
  readonly maxRight: number;
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface MathDifficultyParams {
  /** Number of problems in a session. */
  readonly rounds: number;
  /** Per-problem time budget in ms; null = untimed. Encoded as 0 in profiles. */
  readonly timeBudgetMs: number | null;
  /** Operand ranges per operator (see difficulty.ts for the ÷ invariant). */
  readonly ranges: Readonly<Record<Operator, OperatorRange>>;
  /** Allowed operators for the session (uniformly picked at generation). */
  readonly operators: readonly Operator[];
  /** Adaptive-only: per-problem difficulty-step bounds. */
  readonly minStep?: number;
  /** Adaptive-only: per-problem difficulty-step bounds. */
  readonly maxStep?: number;
}

export type MathPhase = 'intro' | 'problem' | 'feedback' | 'results';

/** Per-problem outcome used by the feedback phase and the adaptive step rule. */
export type MathRoundOutcome = 'correct' | 'incorrect' | 'timeout';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface MathStats {
  readonly score: number;
  readonly problemsPlayed: number;
  readonly problemsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Fastest correct answer in ms; null when nothing was answered correctly. */
  readonly fastestMs: number | null;
  /** Sum of response times of correct answers (speed/avg-correct derivation). */
  readonly totalCorrectMs: number;
}

export const INITIAL_STATS: Readonly<MathStats> = Object.freeze({
  score: 0,
  problemsPlayed: 0,
  problemsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  fastestMs: null,
  totalCorrectMs: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface MathRawResult extends GameRawResult {
  readonly score: number;
  readonly totalProblems: number;
  readonly problemsPlayed: number;
  readonly problemsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly fastestMs: number | null;
  /** Average response time of correct answers in ms; null when none. */
  readonly avgCorrectMs: number | null;
  /** Per-problem time budget in ms (0 = untimed). */
  readonly timeBudgetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Fast Math always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Fast Math game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type MathAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'digit'; digit: number }
  | { type: 'backspace' }
  | { type: 'clear-input' }
  | { type: 'submit-answer'; atActiveMs: number }
  | { type: 'problem-tick'; atActiveMs: number }
  | { type: 'next-problem'; startedAtActiveMs: number }
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
export interface MathGameState {
  phase: MathPhase;
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
  /** 0-based index of the current problem. */
  problemIndex: number;
  /** The current problem (generated deterministically from the seed). */
  problem: MathProblem | null;
  /** Previous problem (near-duplicate avoidance + diagnostics). */
  prevProblem: MathProblem | null;
  /** Digits entered by the player for the current problem. */
  input: string;
  /** Submitted digits of the just-finished problem (feedback display). */
  enteredAnswer: string;
  /** Active-only lifecycle ms at the start of the current problem. */
  problemStartActiveMs: number;
  /** Active-only ms elapsed in the current problem (tick-driven). */
  problemElapsedMs: number;
  /** Time budget of the current problem in ms (0 = untimed). */
  problemBudgetMs: number;
  /** Outcome of the just-finished problem (feedback phase). */
  outcome: MathRoundOutcome | null;
  /** Adaptive-only: current difficulty step within [minStep, maxStep]. */
  difficultyStep: number;
  stats: MathStats;
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

export function createInitialMathState(): MathGameState {
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
    problemIndex: 0,
    problem: null,
    prevProblem: null,
    input: '',
    enteredAnswer: '',
    problemStartActiveMs: 0,
    problemElapsedMs: 0,
    problemBudgetMs: 0,
    outcome: null,
    difficultyStep: 0,
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
