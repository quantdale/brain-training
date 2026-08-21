/**
 * Deduction Table game — shared types (small attribute-deduction / CSP).
 *
 * The player reads a short table of entities and a set of clues, then answers
 * ONE targeted question whose correct value is uniquely forced by the clues.
 * An independent solver (`solver.ts`) proves the answer is unique across all
 * assignments consistent with the clues, so every generated round has exactly
 * one correct option (constitution §10: generated challenges must be
 * validated for correctness/solvability/ambiguity).
 *
 * The game is a pure state machine over `LogicDeductionState` (see reducer.ts);
 * this module owns the vocabulary the reducer, UI, persistence, and generator
 * all consume.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "logic-deduction-table";

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface LogicDeductionDifficultyParams {
  /** Number of entities in the table. */
  readonly entityCount: number;
  /** Number of attributes each entity has. */
  readonly attributeCount: number;
  /** Target number of clues shown (generator may exceed it to guarantee uniqueness). */
  readonly clueCount: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-round answer time budget in ms (auto-times-out at 0). */
  readonly roundTimeMs: number;
  /** Adaptive-only bounds. */
  readonly minEntityCount?: number;
  readonly maxEntityCount?: number;
  readonly minAttributeCount?: number;
  readonly maxAttributeCount?: number;
  readonly minClueCount?: number;
  readonly maxClueCount?: number;
}

export type LogicDeductionPhase =
  | "intro"
  | "question"
  | "roundResult"
  | "results";

/** A single attribute definition (its value domain + whether it is ordered). */
export interface AttributeDef {
  /** Stable attribute id. */
  readonly id: string;
  /** Player-facing label (e.g. "color"). */
  readonly label: string;
  /** Distinct values (length >= entityCount). */
  readonly values: readonly string[];
  /** True when values are ordered (the ordering drives inequality clues). */
  readonly ordered: boolean;
  /** Ascending order of `values` when `ordered` (used for inequality text). */
  readonly order?: readonly string[];
}

/** A clue shown to the player. */
export interface Clue {
  /** Player-facing text. */
  readonly text: string;
  /** Structured form (for the solver + diagnostics). */
  readonly kind: "equality" | "exclusion" | "inequality";
  readonly entity: string;
  readonly attribute: string;
  /** For equality/exclusion: the value. For inequality: the other entity. */
  readonly value?: string;
  /** For inequality: '>' or '<' (entity's attribute compared to `value` entity). */
  readonly relation?: ">" | "<";
}

/** The targeted question the player must answer. */
export interface Question {
  /** Entity the question is about. */
  readonly entity: string;
  /** Attribute the question asks for. */
  readonly attribute: string;
  /** Player-facing text (e.g. "What is P2's color?"). */
  readonly text: string;
}

/** One generated round. */
export interface LogicDeductionRound {
  /** Entity labels. */
  readonly entities: readonly string[];
  /** Attribute definitions actually used this round. */
  readonly attributes: readonly AttributeDef[];
  /** Clues (shuffled, but always uniquely solvably per the solver). */
  readonly clues: readonly Clue[];
  /** The question. */
  readonly question: Question;
  /** The uniquely correct value. */
  readonly answer: string;
  /** Answer options (include `answer`); length == attribute domain size. */
  readonly options: readonly string[];
  /** Index of `answer` in `options`. */
  readonly correctIndex: number;
  readonly entityCount: number;
  readonly clueCount: number;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface LogicDeductionStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalAnswerMs: number;
  readonly sumAnswerRatio: number;
}

export const INITIAL_STATS: Readonly<LogicDeductionStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswerMs: 0,
  sumAnswerRatio: 0,
});

/**
 * Raw result persisted with every completed session. Carries everything needed
 * to reconstruct the exact session: seed, versions, difficulty, per-round
 * outcomes, and generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface LogicDeductionRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly sumAnswerRatio: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly entityCount: number;
  readonly attributeCount: number;
  readonly clueCount: number;
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

/** QA force-state patch keys (dev-only, applied only in `intro`). */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type RoundOutcome = "correct" | "wrong" | "timeout";

export type LogicDeductionAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
      nowMs: number;
    }
  | { type: "answer-option"; index: number; nowMs: number }
  | { type: "expire-round"; nowMs: number }
  | { type: "next-round"; nowMs: number }
  | { type: "pause"; nowMs: number }
  | { type: "resume"; nowMs: number }
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
  | { type: "qa/force-timeout" }
  | { type: "qa/force-state"; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface LogicDeductionState {
  phase: LogicDeductionPhase;
  paused: boolean;
  difficulty: DifficultyLevel | null;
  profile: DifficultyProfile | null;
  params: LogicDeductionDifficultyParams | null;
  seedOverride: string | null;
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  roundIndex: number;
  round: LogicDeductionRound | null;
  roundStartedAtMs: number | null;
  roundDeadlineMs: number | null;
  roundRemainingMs: number | null;
  roundElapsedMs: number | null;
  roundOutcome: RoundOutcome | null;
  lastAnswerIndex: number | null;
  lastAnswerMs: number | null;
  roundOutcomes: readonly RoundOutcome[];
  stats: LogicDeductionStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: "idle" | "started" | "succeeded" | "failed";
  lastError: string | null;
  authoritativeXp: number | null;
  authoritativeCurrency: number | null;
  authoritativeDeltas: readonly {
    domain: string;
    delta: number;
    ratingAfter: number;
  }[];
  tutorialOpen: boolean;
}

export function createInitialLogicDeductionState(): LogicDeductionState {
  return {
    phase: "intro",
    paused: false,
    difficulty: "normal",
    profile: null,
    params: null,
    seedOverride: null,
    seed: "",
    sessionId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    roundIndex: 0,
    round: null,
    roundStartedAtMs: null,
    roundDeadlineMs: null,
    roundRemainingMs: null,
    roundElapsedMs: null,
    roundOutcome: null,
    lastAnswerIndex: null,
    lastAnswerMs: null,
    roundOutcomes: [],
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
