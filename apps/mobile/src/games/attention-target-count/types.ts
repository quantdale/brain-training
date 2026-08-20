/**
 * Target Count game — shared types (selective attention + numerosity).
 *
 * The game is a pure state machine over `TargetCountGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume. The answer is a NUMBER (how many target symbols), not a
 * location — distinct from Visual Search (locate/tap) and Odd One Out (find
 * the single odd item).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'attention-target-count';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface TargetCountDifficultyParams {
  /** Number of grid rows. */
  readonly rows: number;
  /** Number of grid columns. */
  readonly cols: number;
  /** How many DISTINCT non-target symbols appear as distractors. */
  readonly distractorClasses: number;
  /** Inclusive [lo, hi] range for how many target symbols appear per round. */
  readonly targetCountRange: readonly [number, number];
  /** Per-round response window in milliseconds. */
  readonly roundTimeMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
}

export type TargetCountPhase =
  | 'intro'
  | 'showGrid'
  | 'roundResult'
  | 'results';

/** One generated round: a grid plus the answer metadata. */
export interface TargetCountRound {
  /** Glyph at every grid index (length = rows * cols). */
  readonly cells: readonly string[];
  /** Index into the shared `SYMBOLS` palette for the target glyph. */
  readonly targetGlyphIndex: number;
  /** The target glyph string (e.g. '★'). */
  readonly targetGlyph: string;
  /** Human-readable name of the target glyph (e.g. 'star'). */
  readonly targetGlyphName: string;
  /** How many copies of the target glyph are in the grid (the correct answer). */
  readonly targetCount: number;
  /** Answer options (numbers) shown to the player; always includes `targetCount`. */
  readonly options: readonly number[];
  /** Total cell count (rows * cols). */
  readonly gridSize: number;
  /** Rows used to lay out the grid. */
  readonly rows: number;
  /** Columns used to lay out the grid. */
  readonly cols: number;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface TargetCountStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  /** Sum of per-round elapsed time (ms) the player actually used. */
  readonly totalElapsedMs: number;
  /** Sum of per-round time budgets (ms) — denominator for efficiency. */
  readonly totalBudgetMs: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Fastest correct round (ms); Infinity until a correct round is played. */
  readonly bestRoundTimeMs: number;
}

export const INITIAL_STATS: Readonly<TargetCountStats> = Object.freeze({
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
export interface TargetCountRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly bestRoundTimeMs: number;
  readonly totalElapsedMs: number;
  readonly totalBudgetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Target Count always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Target Count game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type TargetCountAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'answer'; selectedCount: number | null; elapsedMs: number }
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
export interface TargetCountGameState {
  phase: TargetCountPhase;
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
  /** The current round's grid + answer metadata (null before start-session). */
  currentRound: TargetCountRound | null;
  /** The previous round (for near-duplicate avoidance + diagnostics). */
  prevRound: TargetCountRound | null;
  /** The player's chosen count for the current round (null before answering). */
  selectedCount: number | null;
  /** Whether the current round was answered correctly. */
  roundCorrect: boolean | null;
  /** Outcome after the player answers (or times out). */
  roundOutcome: 'correct' | 'wrong' | 'timeout' | null;
  stats: TargetCountStats;
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

export function createInitialTargetCountState(): TargetCountGameState {
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
    selectedCount: null,
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
