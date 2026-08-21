/**
 * Quick Compare game — shared types.
 *
 * The game is a pure state machine over `QuickCompareGameState` (see
 * reducer.ts); this module owns the vocabulary the reducer, the UI, and the
 * persistence layer all consume.
 *
 * Mechanic: each round shows two compact stimuli (A and B) and a relationship
 * question; the player picks the correct option as fast and accurately as
 * possible. Decision types escalate with difficulty (same/different →
 * larger/smaller → compare summed pairs), while remaining fair (the correct
 * answer is always unambiguous by construction).
 *
 * Timing contract: gameplay timestamps are monotonic clock values supplied by
 * the screen (`roundStartedAtMs`, `nowMs`); the reducer never reads the wall
 * clock. A round's reaction time is `answer.nowMs - roundStartedAtMs`.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'speed-quick-compare';

/** Relationship question families used by the generator. */
export type ComparePromptType = 'same-different' | 'magnitude' | 'sum-compare';

/** A comparable side: one or two numbers, with a pre-rendered display string. */
export interface CompareSide {
  readonly kind: 'single' | 'pair';
  /** One or two integers that define the side's value. */
  readonly numbers: readonly number[];
  /** Rendered text (e.g. "7" or "3 + 4"). */
  readonly display: string;
}

/** One generated round (validated at generation; see generator.ts). */
export interface QuickCompareRound {
  readonly promptType: ComparePromptType;
  /** Human question, e.g. "Which side is larger?". */
  readonly question: string;
  /** Option button labels, e.g. ["Left", "Right"] or ["Same", "Different"]. */
  readonly optionLabels: readonly string[];
  /** Index of the uniquely-correct option. */
  readonly correctIndex: number;
  /** Left stimulus (value and display). */
  readonly left: CompareSide;
  /** Right stimulus (value and display). */
  readonly right: CompareSide;
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface QuickCompareDifficultyParams {
  /** Rounds in a session. */
  readonly rounds: number;
  /** Per-round response window (ms). */
  readonly windowMs: number;
  /** Allowed decision types for the session (in difficulty order). */
  readonly promptTypes: readonly ComparePromptType[];
  /** Max absolute integer magnitude for generated operands. */
  readonly maxValue: number;
  /** Number of answer options (2, 3, or 4). */
  readonly optionCount: number;
  /** Adaptive-only: response-window lower bound (ms). */
  readonly minWindowMs?: number;
  /** Adaptive-only: response-window upper bound (ms). */
  readonly maxWindowMs?: number;
}

export type QuickComparePhase = 'intro' | 'active' | 'feedback' | 'results';

/** Per-round resolution verdict. */
export type CompareVerdict = 'correct' | 'incorrect' | 'miss';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface QuickCompareStats {
  readonly score: number;
  readonly roundsTotal: number;
  readonly roundsCorrect: number;
  readonly roundsWrong: number;
  readonly roundsMissed: number;
  /** Reaction time per answered round (ms, monotonic deltas). */
  readonly reactions: readonly number[];
  /** Per-answer speed factor in round order (see scoring.ts). */
  readonly speedFactors: readonly number[];
  readonly bestStreak: number;
  readonly streak: number;
}

export const INITIAL_STATS: Readonly<QuickCompareStats> = Object.freeze({
  score: 0,
  roundsTotal: 0,
  roundsCorrect: 0,
  roundsWrong: 0,
  roundsMissed: 0,
  reactions: [],
  speedFactors: [],
  bestStreak: 0,
  streak: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface QuickCompareRawResult extends GameRawResult {
  readonly score: number;
  readonly roundsTotal: number;
  readonly roundsCorrect: number;
  readonly roundsWrong: number;
  readonly roundsMissed: number;
  readonly accuracy: number;
  /** Reaction time per answered round (ms), in round order. */
  readonly reactions: readonly number[];
  /** Speed factor per answered round (see scoring.ts), in round order. */
  readonly speedFactors: readonly number[];
  readonly meanReactionMs: number | null;
  readonly bestReactionMs: number | null;
  readonly meanSpeed: number;
  readonly bestStreak: number;
  readonly windowMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Quick Compare always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Quick Compare game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type QuickCompareAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      startedAtMs: number;
      /** Monotonic clock value at which the first round becomes live. */
      spawnedAtMs: number;
    }
  | {
      type: 'answer';
      /** Selected option index. */
      index: number;
      /** Monotonic clock value at answer time. */
      nowMs: number;
    }
  | {
      type: 'answer-timeout';
      /** Monotonic clock value when the window closed. */
      nowMs: number;
    }
  | { type: 'next-round'; spawnedAtMs: number }
  | { type: 'pause' }
  | {
      type: 'resume';
      /** Monotonic clock value at resume time. */
      nowMs: number;
      /** Window time (ms) left at pause; the deadline is re-anchored from it. */
      remainingMs: number;
    }
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
export interface QuickCompareGameState {
  phase: QuickComparePhase;
  /** True while the SDK lifecycle is paused (timers frozen, field obscured). */
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
  /** Per-round response window (ms) of the current round. */
  windowMs: number;
  /** Monotonic clock value when the current round became live. */
  roundStartedAtMs: number | null;
  /** Monotonic clock value by which an answer must arrive. */
  deadlineMs: number | null;
  /** The current round's data (null except during active/feedback). */
  round: QuickCompareRound | null;
  /** Index the player selected this round (null until answered). */
  selectedIndex: number | null;
  /** Verdict of the just-resolved round (feedback rendering). */
  lastVerdict: CompareVerdict | null;
  stats: QuickCompareStats;
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

export function createInitialQuickCompareState(): QuickCompareGameState {
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
    windowMs: 0,
    roundStartedAtMs: null,
    deadlineMs: null,
    round: null,
    selectedIndex: null,
    lastVerdict: null,
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
