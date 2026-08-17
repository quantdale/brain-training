/**
 * Math Missing Operator — shared types.
 *
 * The game is a pure state machine over `MathMissingOperatorGameState` (see
 * reducer.ts). Mechanic: an equation with the operator missing (`8 _ 2 = 16`);
 * the player picks the operator (`+ − × ÷`) that makes it true. Distinct from
 * the Phase-2 Math game (Fast Math: rapid arithmetic with a presented result):
 * here the arithmetic is verification/completion, and division results are
 * constrained to exact integers.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'math-missing-operator';

/**
 * Canonical operator keys. ASCII only (`*`/`/`), so they are unambiguous in
 * code and tests; the UI maps them to display glyphs via `OPERATOR_GLYPHS`.
 */
export const OPERATORS = ['+', '-', '*', '/'] as const;

export type Operator = (typeof OPERATORS)[number];

/** Display glyphs for the canonical operator keys (`-` → "−", `*` → "×", `/` → "÷"). */
export const OPERATOR_GLYPHS: Readonly<Record<Operator, string>> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface MathMissingOperatorDifficultyParams {
  /** First-operand range [minA, maxA]; escalates toward maxA across rounds. */
  readonly minA: number;
  readonly maxA: number;
  /** Second-operand range [minB, maxB]. Always ≥ 2, so `×1`/`÷1` never appear. */
  readonly minB: number;
  readonly maxB: number;
  /** Operators the correct answer may be drawn from (a difficulty knob). */
  readonly operators: readonly Operator[];
  /** Time budget (ms) of round 0; shrinks per round via `shrinkPerRound`. */
  readonly baseTimeMs: number;
  /** Floor (ms) for the shrinking per-round budget. */
  readonly minTimeMs: number;
  /** Multiplicative budget shrink per round (≤ 1). */
  readonly shrinkPerRound: number;
  /** Number of rounds in a session (1–3 minute score-attack). */
  readonly rounds: number;
}

export type MathMissingOperatorPhase = 'intro' | 'answer' | 'roundResult' | 'results';

/** One generated equation; `answerOperator` is the unique correct operator. */
export interface Equation {
  readonly a: number;
  readonly b: number;
  /** Result: `a answerOperator b === c`. */
  readonly c: number;
  /** The one operator among all four that makes the equation true. */
  readonly answerOperator: Operator;
}

export type MathMissingOperatorRoundOutcome = 'correct' | 'wrong' | 'timeout';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface MathMissingOperatorStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of response times (ms) over all answered rounds (correct + wrong). */
  readonly totalResponseMs: number;
  /** Rounds that expired without an answer. */
  readonly timeouts: number;
}

export const INITIAL_STATS: Readonly<MathMissingOperatorStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  totalResponseMs: 0,
  timeouts: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface MathMissingOperatorRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly timeouts: number;
  /** Mean response time (ms) over answered rounds; 0 when none answered. */
  readonly avgResponseMs: number;
  readonly totalResponseMs: number;
  /** Round-0 time budget (ms); the normalizer compares speed against this. */
  readonly baseTimeMs: number;
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

/**
 * QA force-state patch keys supported by this game. Applied only in the
 * `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type MathMissingOperatorAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      /** Wall-clock epoch ms; recorded with the result (not used for pacing). */
      startedAtMs: number;
      /** Monotonic clock value; the round-0 pacing anchor. */
      roundStartedAtMs: number;
    }
  | { type: 'answer-round'; operator: Operator; responseMs: number }
  | { type: 'round-timeout' }
  | { type: 'next-round'; roundStartedAtMs: number }
  | { type: 'pause'; pausedAtMs: number }
  | { type: 'resume'; resumedAtMs: number }
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
export interface MathMissingOperatorGameState {
  phase: MathMissingOperatorPhase;
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
  /** Wall-clock epoch ms of session start (recorded, not used for pacing). */
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  /** 0-based index of the current round. */
  roundIndex: number;
  /** The current round's equation, or null outside the session. */
  equation: Equation | null;
  /**
   * Monotonic anchor of the current active segment: the time the round (or
   * the last resume) started. Pacing and response time are derived from this
   * plus `roundElapsedMs`, so pause never inflates response time.
   */
  roundStartedAtMs: number;
  /** Active (non-paused) ms already elapsed in the current round. */
  roundElapsedMs: number;
  roundOutcome: MathMissingOperatorRoundOutcome | null;
  /** Operator the player picked in the current round; null on timeout. */
  lastAnsweredOperator: Operator | null;
  /** Adaptive-only continuous rating; moves with each round outcome. */
  adaptiveRating: number;
  stats: MathMissingOperatorStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialMathMissingOperatorState(): MathMissingOperatorGameState {
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
    equation: null,
    roundStartedAtMs: 0,
    roundElapsedMs: 0,
    roundOutcome: null,
    lastAnsweredOperator: null,
    adaptiveRating: 0.5,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
