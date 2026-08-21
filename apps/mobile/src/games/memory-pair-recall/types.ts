/**
 * Pair Recall game — shared types (associative pair-recall variant).
 *
 * The game shows a set of stimulus→response pairs (study phase), then runs a
 * cued recall: each stimulus is presented alone and the player must pick its
 * partner response from the round's full response palette. Between rounds,
 * carried-over stimuli are deliberately RE-PAIRED with new responses, so
 * associations learned in earlier rounds become proactive-interference traps —
 * a working-memory updating mechanic distinct from sequence recall (memory,
 * memory-sequence-memory), spatial bitmap recall (memory-grid-recall),
 * span tap-back (memory-pattern-tap-back), and recency order recall
 * (memory-running-order). Pure state machine over `PairRecallGameState`
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
export const GAME_ID = "memory-pair-recall";

/** One learned association: a stimulus glyph paired with one response letter. */
export interface StimulusResponsePair {
  /** 0-based stimulus palette id (see pairs.ts). */
  readonly stimulusId: number;
  /** 0-based response palette id (see pairs.ts). */
  readonly responseId: number;
}

/**
 * A generated round: the pair set, the seeded cue presentation order, and the
 * seeded response-palette presentation order (the palette is the full set of
 * the round's responses, so every decoy is another pair's true partner).
 */
export interface PairRecallRound {
  /** The associations to learn this round; stimuli and responses are unique. */
  readonly pairs: readonly StimulusResponsePair[];
  /** Cue presentation order: indices into `pairs`. */
  readonly cueOrder: readonly number[];
  /** Response palette presentation order: ids into the response palette. */
  readonly responseOptions: readonly number[];
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface PairRecallDifficultyParams {
  /** Number of pairs in round 1. */
  readonly initialPairCount: number;
  /** Per-round study duration in ms (how long the pairs are shown). */
  readonly studyMs: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Escalation cap for the per-round pair count (all levels). */
  readonly maxPairCount: number;
  /** Adaptive-only: per-round pair-count lower bound. */
  readonly minPairCount?: number;
}

export type PairRecallPhase =
  | "intro"
  | "study"
  | "recall"
  | "roundResult"
  | "results";

/** Accumulated session statistics (all player-facing raw numbers). */
export interface PairRecallStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Most partner responses the player ever recalled correctly in one round. */
  readonly bestRecall: number;
  /** Total partner prompts presented across the session. */
  readonly totalPairs: number;
  /** Total cues answered correctly across the session. */
  readonly correctPairs: number;
  /** Total wrong response picks across the session. */
  readonly wrongTaps: number;
}

export const INITIAL_STATS: Readonly<PairRecallStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  bestRecall: 0,
  totalPairs: 0,
  correctPairs: 0,
  wrongTaps: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface PairRecallRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestRecall: number;
  readonly bestStreak: number;
  readonly initialPairCount: number;
  readonly maxPairCount: number;
  readonly studyMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Pair Recall always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Pair Recall game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type PairRecallAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
    }
  | { type: "study-tick" }
  | { type: "respond"; responseId: number }
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

/** Outcome of the just-finished cue (drives feedback + result reveal). */
export interface LastCueOutcome {
  /** Index into the round's `pairs` that was cued. */
  readonly pairIndex: number;
  readonly responseId: number;
  readonly correct: boolean;
}

/** Complete game state; the screen renders this and dispatches actions. */
export interface PairRecallGameState {
  phase: PairRecallPhase;
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
  /** Pair count of the current round. */
  pairCount: number;
  /** The current round's generated content (pairs + orders). */
  round: PairRecallRound | null;
  /** Previous round (interference re-pairing source + diagnostics). */
  prevRound: PairRecallRound | null;
  /** 0-based position within the cue sequence during recall. */
  cueIndex: number;
  /** Correct responses so far in the current round. */
  correctCues: number;
  /** Wrong picks so far in the current round. */
  wrongCues: number;
  /** Outcome of the most recent cue (null before the first / after reveal). */
  lastCue: LastCueOutcome | null;
  /** True when the current round has been checked. */
  roundScored: boolean;
  roundOutcome: "passed" | "failed" | null;
  stats: PairRecallStats;
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

export function createInitialPairRecallState(): PairRecallGameState {
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
    pairCount: 0,
    round: null,
    prevRound: null,
    cueIndex: 0,
    correctCues: 0,
    wrongCues: 0,
    lastCue: null,
    roundScored: false,
    roundOutcome: null,
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
