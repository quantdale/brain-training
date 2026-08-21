/**
 * Cue Keeper game — shared types (event-based prospective memory).
 *
 * The player first forms INTENTIONS during a briefing ("when ★ appears, tap
 * SIGNAL"), then watches a fast stream of symbols. Every non-signal item
 * demands the ongoing GO response; the moment an active signal appears the
 * player must switch to the prospective SIGNAL response — using only the
 * intention they are holding, because the watchlist is never re-displayed
 * during play. Between rounds new signals join (briefed once) and old ones
 * retire (announced once), so intentions must be maintained, dropped, and
 * added across filled delays.
 *
 * This is event-based PROSPECTIVE memory — remembering TO act at the right
 * future moment — which no other catalog game covers: every existing Memory
 * game is retrospective (reproduce or recognize something already shown),
 * and the flexibility games display their active rule on screen at decision
 * time. Pure state machine over `ProspectiveCueGameState` (see reducer.ts).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "memory-prospective-cue";

/** One stream item: which glyph showed and whether it was an active signal. */
export interface StreamItem {
  /** 0-based glyph palette id (see glyphs.ts). */
  readonly glyphId: number;
  /** True iff `glyphId` was in the round's active signal set. */
  readonly isSignal: boolean;
}

/**
 * A generated round: the stream presentation order plus the intention
 * bookkeeping. `newSignalIds` are briefed as NEW at round start;
 * `retiredSignalIds` are announced as leaving the watchlist; every other
 * previously-learned signal carries over UNANNOUNCED (the player must still
 * be holding it).
 */
export interface ProspectiveRound {
  /** Presentation order of the stream items. */
  readonly items: readonly StreamItem[];
  /** Full active signal set for this round (after retirement + addition). */
  readonly activeSignalIds: readonly number[];
  /** Signals briefed as NEW this round (disjoint from any previous active). */
  readonly newSignalIds: readonly number[];
  /** Previously-active signals announced as retired this round. */
  readonly retiredSignalIds: readonly number[];
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface ProspectiveCueDifficultyParams {
  /** Active signal count in round 1. */
  readonly initialSignalCount: number;
  /** Escalation cap for the active signal count (all levels). */
  readonly maxSignalCount: number;
  /** Per-item response window in ms in round 1. */
  readonly initialItemMs: number;
  /** Per-item response window floor (escalation never goes below this). */
  readonly minItemMs: number;
  /** Stream length (items per round). */
  readonly streamLen: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Adaptive-only: signal-count lower bound. */
  readonly minSignalCount?: number;
}

export type ProspectiveCuePhase =
  | "intro"
  | "briefing"
  | "stream"
  | "roundResult"
  | "results";

/** The player's response to one stream item (or the window expiring). */
export type ItemResponse = "go" | "signal" | "timeout";

/** Outcome of the just-resolved item (drives feedback + diagnostics). */
export interface LastItemOutcome {
  /** 0-based index into the round's `items`. */
  readonly itemIndex: number;
  readonly wasSignal: boolean;
  readonly response: ItemResponse;
  readonly correct: boolean;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface ProspectiveCueStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Total signal items presented across the session. */
  readonly totalSignals: number;
  /** Signal items answered with the SIGNAL response (hits only). */
  readonly signalHits: number;
  /** SIGNAL responses on non-signal items (prospective false alarms). */
  readonly falseAlarms: number;
  /** Total stream items presented across the session. */
  readonly totalItems: number;
  /** Items answered correctly (GO on filler + SIGNAL on signal). */
  readonly correctResponses: number;
  /** Filler items that timed out without any response. */
  readonly goMisses: number;
}

export const INITIAL_STATS: Readonly<ProspectiveCueStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  totalSignals: 0,
  signalHits: 0,
  falseAlarms: 0,
  totalItems: 0,
  correctResponses: 0,
  goMisses: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface ProspectiveCueRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  /** Overall item accuracy: correctResponses / totalItems (0..1). */
  readonly accuracy: number;
  /** Prospective accuracy: signalHits / totalSignals (0..1). */
  readonly signalAccuracy: number;
  readonly bestStreak: number;
  readonly initialSignalCount: number;
  readonly maxSignalCount: number;
  /** Per-item window reached by the end of the session (ms). */
  readonly itemMs: number;
  readonly streamLen: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Cue Keeper always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Cue Keeper game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type ProspectiveCueAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
    }
  | { type: "briefing-done" }
  | {
      type: "respond";
      kind: "go" | "signal";
      /** Fraction of the item window consumed when the response landed (0..1). */
      elapsedFraction: number;
    }
  | { type: "item-timeout" }
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
export interface ProspectiveCueGameState {
  phase: ProspectiveCuePhase;
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
  /** Active signal count of the current round. */
  signalCount: number;
  /** Per-item response window of the current round (ms). */
  itemMs: number;
  /** The current round's generated content (stream + intention bookkeeping). */
  round: ProspectiveRound | null;
  /** Active signal set of the previous round (generator input + diagnostics). */
  prevActiveSignalIds: readonly number[];
  /** 0-based index of the current stream item. */
  itemIndex: number;
  /** Signal items presented so far in the CURRENT round. */
  roundSignalTotal: number;
  /** Signals caught so far in the CURRENT round. */
  roundSignalHits: number;
  /** False alarms so far in the CURRENT round. */
  roundFalseAlarms: number;
  /** Outcome of the most recently resolved item (null before the first). */
  lastItem: LastItemOutcome | null;
  /** True when the current round has been checked. */
  roundScored: boolean;
  roundOutcome: "passed" | "failed" | null;
  stats: ProspectiveCueStats;
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

export function createInitialProspectiveCueState(): ProspectiveCueGameState {
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
    signalCount: 0,
    itemMs: 0,
    round: null,
    prevActiveSignalIds: [],
    itemIndex: 0,
    roundSignalTotal: 0,
    roundSignalHits: 0,
    roundFalseAlarms: 0,
    lastItem: null,
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
