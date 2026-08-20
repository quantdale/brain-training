/**
 * Grid Recall game — shared types (simultaneous pattern-recall variant).
 *
 * The game shows a SET of highlighted cells all at once (study phase), hides
 * the board, then asks the player to rebuild that set by tapping cells
 * (input phase). This is a spatial bitmap recall — distinct from the
 * sequential tapping Memory games — and is a pure state machine over
 * `GridRecallGameState` (see reducer.ts).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "memory-grid-recall";

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface GridRecallDifficultyParams {
  /** Total cells in the grid (9 → 3×3, 16 → 4×4, 25 → 5×5, 36 → 6×6). */
  readonly gridSize: number;
  /** Number of cells to recall in round 1. */
  readonly initialTargetCount: number;
  /** Per-round study duration in ms (how long the pattern is shown). */
  readonly studyMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: per-round target-count lower bound. */
  readonly minTargetCount?: number;
  /** Adaptive-only: per-round target-count upper bound. */
  readonly maxTargetCount?: number;
}

export type GridRecallPhase =
  | "intro"
  | "study"
  | "input"
  | "roundResult"
  | "results";

/** Accumulated session statistics (all player-facing raw numbers). */
export interface GridRecallStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Most target cells the player ever recalled perfectly in one round. */
  readonly bestRecall: number;
  /** Total target cells presented across the session. */
  readonly totalTargets: number;
  /** Total correctly recalled target cells across the session. */
  readonly correctTargets: number;
  /** Total non-target cells the player wrongly tapped. */
  readonly wrongTaps: number;
}

export const INITIAL_STATS: Readonly<GridRecallStats> = Object.freeze({
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
export interface GridRecallRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestRecall: number;
  readonly bestStreak: number;
  readonly initialTargetCount: number;
  readonly gridSize: number;
  readonly studyMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Grid Recall always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Grid Recall game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type GridRecallAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
    }
  | { type: "study-tick" }
  | { type: "tap-cell"; index: number }
  | { type: "submit" }
  | { type: "next-round" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "tutorial-open" }
  | { type: "tutorial-close" }
  | {
      type: "session-finalized";
      xp: number;
      normalized: number;
      activeDurationMs: number;
      pausedDurationMs: number;
      completedAtMs: number;
    }
  | { type: "persistence-started" }
  | { type: "persistence-succeeded" }
  | { type: "persistence-failed"; message: string }
  | {
      type: "completion-outcome-received";
      xp: number;
      currency: number;
      deltas: readonly { domain: string; delta: number; ratingAfter: number }[];
    }
  | { type: "qa/force-win" }
  | { type: "qa/force-lose" }
  | { type: "qa/force-state"; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface GridRecallGameState {
  phase: GridRecallPhase;
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
  /** Number of target cells to recall this round. */
  targetCount: number;
  /** Cell indices that are targets this round (the pattern). */
  targets: readonly number[];
  /** Cells the player has selected in the input phase. */
  selections: readonly number[];
  /** True when the current round has been checked. */
  roundScored: boolean;
  /** Correctly recalled target cells in the current round (after submit). */
  roundCorrectTargets: number;
  /** Wrong cells tapped in the current round (after submit). */
  roundWrongTaps: number;
  roundOutcome: "passed" | "failed" | null;
  /** Previous round's target set (near-duplicate avoidance + diagnostics). */
  prevTargets: readonly number[] | null;
  stats: GridRecallStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: "idle" | "started" | "succeeded" | "failed";
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  /** Authoritative XP from the rating pipeline (null until persistence succeeds). */
  authoritativeXp: number | null;
  /** Authoritative currency from the rating pipeline (null until persistence succeeds). */
  authoritativeCurrency: number | null;
  /** Authoritative rating deltas with resulting ratings (empty until persistence succeeds). */
  authoritativeDeltas: readonly {
    domain: string;
    delta: number;
    ratingAfter: number;
  }[];
  tutorialOpen: boolean;
}

export function createInitialGridRecallState(): GridRecallGameState {
  return {
    phase: "intro",
    paused: false,
    difficulty: "normal",
    profile: null,
    seedOverride: null,
    seed: "",
    sessionId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    roundIndex: 0,
    targetCount: 0,
    targets: [],
    selections: [],
    roundScored: false,
    roundCorrectTargets: 0,
    roundWrongTaps: 0,
    roundOutcome: null,
    prevTargets: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: "idle",
    lastError: null,
    authoritativeXp: null,
    authoritativeCurrency: null,
    authoritativeDeltas: [],
    tutorialOpen: false,
  };
}
