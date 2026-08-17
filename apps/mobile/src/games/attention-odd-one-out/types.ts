/**
 * Odd One Out game — shared types.
 *
 * Mechanic: a grid of similar items where exactly ONE differs from the
 * majority (shape/orientation/color — the deviation is defined only by the
 * majority, there is NO specified target, unlike Visual Search). The player
 * taps the odd item before the display window expires. Wrong taps deduct
 * points; a passed round awards a base plus a first-try bonus. Rounds
 * escalate within a session (subtler deviation, shorter window) via a step
 * index (see difficulty.ts).
 *
 * The game is a pure state machine over `OddOneOutGameState` (see reducer.ts);
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
export const GAME_ID = 'attention-odd-one-out';

/**
 * Game-defined difficulty tuning; recorded in the resolved difficulty profile.
 * Escalation is linear in a `step` index: subtlety rises and the window
 * shrinks by a fixed amount per step, both clamped to the declared bounds.
 */
export interface OddOneOutDifficultyParams {
  /** Total items in the grid (9 → 3×3, 16 → 4×4). Constant per session. */
  readonly gridSize: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Subtlety of the step-0 deviation (0 = easiest … 3 = hardest). */
  readonly minSubtlety: number;
  /** Highest subtlety the session may reach. */
  readonly maxSubtlety: number;
  /** Shortest allowed display window in ms. */
  readonly minWindowMs: number;
  /** Window of the step-0 round in ms. */
  readonly maxWindowMs: number;
  /** Window shrink per escalation step in ms. */
  readonly windowStepMs: number;
}

export type OddOneOutPhase = 'intro' | 'playing' | 'roundResult' | 'results';

/**
 * One board's deviation: a render description for the majority items plus the
 * single odd item. `color` is a fixed hex (palette chosen for light+dark
 * surfaces) or null, in which case the tile renders with the theme text
 * color. This is the complete visual vocabulary — a board is exactly
 * `{ oddIndex, deviation }`.
 */
export interface DeviationSpec {
  /** 'shape' | 'color' | 'orientation'; recorded for diagnostics. */
  readonly kind: 'shape' | 'color' | 'orientation';
  /** Stable variant id (e.g. `shape-circle-square`); near-duplicate detection key. */
  readonly key: string;
  /** Majority glyph. */
  readonly glyph: string;
  /** Majority color (hex) or null → theme text color. */
  readonly color: string | null;
  /** Majority rotation in degrees. */
  readonly rotation: number;
  /** Odd item's glyph. */
  readonly oddGlyph: string;
  /** Odd item's color (hex) or null → theme text color. */
  readonly oddColor: string | null;
  /** Odd item's rotation in degrees. */
  readonly oddRotation: number;
}

/** A generated board: exactly one odd item at `oddIndex`, everything else identical. */
export interface OddOneOutBoard {
  readonly oddIndex: number;
  readonly deviation: DeviationSpec;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface OddOneOutStats {
  readonly score: number;
  /** Boards presented (passed + timed out). */
  readonly roundsPlayed: number;
  /** Boards solved within the window. */
  readonly roundsPassed: number;
  /** Passed rounds that were solved on the first tap (no wrong tap). */
  readonly firstTryCorrect: number;
  readonly wrongTaps: number;
  readonly timeouts: number;
  readonly bestStreak: number;
  readonly streak: number;
  /**
   * Sum over passed rounds of `solveMs / windowMs` (each clamped to [0, 1]).
   * Average-ratio form stays meaningful when the window varies per round
   * (adaptive mode); see scoring.ts.
   */
  readonly solveRatioSum: number;
}

export const INITIAL_STATS: Readonly<OddOneOutStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  firstTryCorrect: 0,
  wrongTaps: 0,
  timeouts: 0,
  bestStreak: 0,
  streak: 0,
  solveRatioSum: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface OddOneOutRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly firstTryCorrect: number;
  readonly wrongTaps: number;
  readonly timeouts: number;
  /** roundsPassed / roundsPlayed (0 when nothing played). */
  readonly accuracy: number;
  /** firstTryCorrect / roundsPlayed. */
  readonly firstTryRate: number;
  /** Mean solve-ratio over passed rounds (0 when none passed). */
  readonly avgSolveRatio: number;
  readonly bestStreak: number;
  /** Effective params of the final round (full progression is replayable). */
  readonly gridSize: number;
  readonly subtlety: number;
  readonly windowMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Odd One Out always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Odd One Out game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type OddOneOutAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      /** Wall-clock session start (ms epoch) — recorded for diagnostics. */
      startedAtMs: number;
      /** Monotonic clock value; the round deadline is derived from it. */
      nowMs: number;
    }
  /** Countdown display refresh; `remainingMs` comes from the monotonic clock. */
  | { type: 'tick'; remainingMs: number }
  /** A tile was tapped; `nowMs` (monotonic) sizes the solve ratio. */
  | { type: 'tap-tile'; index: number; nowMs: number }
  /** The display window expired for the current round. */
  | { type: 'round-timeout' }
  /** Advance after a round result; `nowMs` seeds the next round's deadline. */
  | { type: 'next-round'; nowMs: number }
  /** Pause freezes the window; the screen reports the precise remaining ms. */
  | { type: 'pause'; remainingMs: number }
  /** Resume restarts the window from `nowMs` + stored remaining. */
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
export interface OddOneOutGameState {
  phase: OddOneOutPhase;
  /** True while the SDK lifecycle is paused (window frozen, board obscured). */
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
  /** Current round's board; null before the first session start. */
  board: OddOneOutBoard | null;
  /** Previous round's board (near-duplicate avoidance + diagnostics). */
  prevBoard: OddOneOutBoard | null;
  /** Escalation step of the current round (see difficulty.ts). */
  step: number;
  /** Effective params of the current round (mirrored for the UI). */
  gridSize: number;
  subtlety: number;
  windowMs: number;
  /** Monotonic deadline of the current round (pause/resume-safe). */
  deadlineMs: number;
  /** Monotonic start of the current round (sizes the solve ratio). */
  roundStartedAtMs: number;
  /** Displayed countdown; also the pause/resume remainder. */
  remainingMs: number;
  /** Wrong taps in the current round (first-try bonus eligibility). */
  roundWrongTaps: number;
  /** Most recently wrong-tapped index, highlighted as an error; null when none. */
  lastWrongIndex: number | null;
  roundOutcome: 'passed' | 'timeout' | null;
  stats: OddOneOutStats;
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

export function createInitialOddOneOutState(): OddOneOutGameState {
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
    board: null,
    prevBoard: null,
    step: 0,
    gridSize: 0,
    subtlety: 0,
    windowMs: 0,
    deadlineMs: 0,
    roundStartedAtMs: 0,
    remainingMs: 0,
    roundWrongTaps: 0,
    lastWrongIndex: null,
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
