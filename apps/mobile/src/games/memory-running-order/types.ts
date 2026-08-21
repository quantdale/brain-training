/**
 * Running Order game — shared types (working-memory update variant).
 *
 * A stream of symbols flashes one at a time; the player must recall the LAST
 * `recallLength` symbols IN ORDER, ignoring the earlier distractors. This is a
 * working-memory update / forgetting task — distinct from the full-sequence
 * Memory games — and is a pure state machine over `RunningOrderGameState`
 * (see reducer.ts).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "memory-running-order";

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface RunningOrderDifficultyParams {
  /** Length of the full stimulus stream shown each round. */
  readonly streamLen: number;
  /** Number of trailing symbols to recall in order. */
  readonly initialRecallLength: number;
  /** Per-symbol reveal duration in ms. */
  readonly flashMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: per-round recall-length lower bound. */
  readonly minRecallLength?: number;
  /** Adaptive-only: per-round recall-length upper bound. */
  readonly maxRecallLength?: number;
}

export type RunningOrderPhase =
  | "intro"
  | "reveal"
  | "input"
  | "roundResult"
  | "results";

/** Accumulated session statistics (all player-facing raw numbers). */
export interface RunningOrderStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Most correctly-ordered trailing symbols recalled in one round. */
  readonly bestRecall: number;
  /** Total trailing symbols presented across the session. */
  readonly totalTargets: number;
  /** Total correctly-ordered symbols across the session. */
  readonly correctTargets: number;
  /** Unused here (kept for parity); always 0. */
  readonly wrongTaps: number;
}

export const INITIAL_STATS: Readonly<RunningOrderStats> = Object.freeze({
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
export interface RunningOrderRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestRecall: number;
  readonly bestStreak: number;
  readonly initialRecallLength: number;
  readonly streamLen: number;
  readonly flashMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Running Order always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Running Order game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type RunningOrderAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
    }
  | { type: "reveal-tick" }
  | { type: "tap-symbol"; id: number }
  | { type: "backspace" }
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
export interface RunningOrderGameState {
  phase: RunningOrderPhase;
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
  /** Number of trailing symbols to recall this round. */
  recallLength: number;
  /** The full stimulus stream (symbol ids) shown this round. */
  stream: readonly number[];
  /** Index of the symbol currently flashing during reveal; -1 when not revealing. */
  revealedIndex: number;
  /** Player's ordered reconstruction (symbol ids). */
  answer: readonly number[];
  /** True when the current round has been checked. */
  roundScored: boolean;
  /** Correctly ordered trailing symbols in the current round (after submit). */
  roundCorrectTargets: number;
  roundOutcome: "passed" | "failed" | null;
  /** The correct trailing symbols of the previous round (diagnostics). */
  prevTarget: readonly number[] | null;
  stats: RunningOrderStats;
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

export function createInitialRunningOrderState(): RunningOrderGameState {
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
    recallLength: 0,
    stream: [],
    revealedIndex: 0,
    answer: [],
    roundScored: false,
    roundCorrectTargets: 0,
    roundOutcome: null,
    prevTarget: null,
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
