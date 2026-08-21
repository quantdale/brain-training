/**
 * Word Chain — shared types.
 *
 * The game is a pure state machine over `LanguageWordChainState` (see
 * reducer.ts); this module owns the vocabulary the reducer, the UI, the
 * generator, and the persistence layer all consume.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

import type { Tier } from "./content-validation";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "language-word-chain";

/**
 * Game-defined difficulty tuning; recorded in the resolved difficulty profile.
 *
 * Chain selection uses a bitmask over `Tier` (t1=1, t2=2, t3=4) because the
 * SDK difficulty profile only carries numeric parameters. `timePerRoundMs`
 * is the per-chain answer budget; a chain expires when the player has not
 * completed it in time. `minChainLen`/`maxChainLen` bound which chains are
 * eligible; `minBlanks`/`maxBlanks` bound how many positions are blanked.
 */
export interface WordChainDifficultyParams {
  /** Bitmask over tiers used by this difficulty (t1=1, t2=2, t3=4). */
  readonly tierMask: number;
  /** Number of chains (rounds) in a session. */
  readonly rounds: number;
  /** Per-chain answer time budget in ms (fixed levels). */
  readonly timePerRoundMs: number;
  /** Minimum eligible chain length (number of words). */
  readonly minChainLen: number;
  /** Maximum eligible chain length (number of words). */
  readonly maxChainLen: number;
  /** Minimum number of blanked positions per chain. */
  readonly minBlanks: number;
  /** Maximum number of blanked positions per chain. */
  readonly maxBlanks: number;
  /** Number of answer options shown per blank (1 correct + distractors). */
  readonly optionsPerStep: number;
  /** Adaptive-only: per-chain time-budget lower bound. */
  readonly minTimePerRoundMs?: number;
  /** Adaptive-only: per-chain time-budget upper bound. */
  readonly maxTimePerRoundMs?: number;
  /** Adaptive-only: budget step applied after each chain (±). */
  readonly timeStepMs?: number;
  /** Adaptive-only: starting tier, 1 | 2 | 3. */
  readonly initialTier?: number;
}

export type LanguageWordChainPhase =
  | "intro"
  | "question"
  | "roundResult"
  | "results";

/** Outcome of one chain (round); adaptive difficulty reacts to it. */
export type RoundOutcome = "correct" | "wrong" | "timeout";

/** One blank to fill within a chain, in ascending position order. */
export interface ChainStep {
  /** Position in the full chain (`words[position]` is the answer). */
  readonly position: number;
  /** The letter the next word must start with (last letter of `words[position-1]`). */
  readonly requiredFirstLetter: string;
  /** Shuffled answer options; exactly one starts with `requiredFirstLetter`. */
  readonly options: readonly string[];
  /** Index into `options` of the correct word. */
  readonly correctIndex: number;
  /** The correct word (`words[position]`). */
  readonly correctWord: string;
}

/** A generated chain puzzle: the full correct chain plus the blanks to fill. */
export interface WordChainRound {
  readonly chainId: string;
  readonly tier: Tier;
  /** The full, correct word sequence. */
  readonly words: readonly string[];
  /** `fixed[i]` is true when position `i` is revealed (given) to the player. */
  readonly fixed: readonly boolean[];
  /** Number of blanked positions. */
  readonly blankCount: number;
  /** The blanks to fill, in ascending position order. */
  readonly steps: readonly ChainStep[];
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface LanguageWordChainStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of answer times over played steps (timeout steps count the budget). */
  readonly totalAnswerMs: number;
  /** Sum of `answerMs / budget` over played steps; feeds normalization. */
  readonly sumAnswerRatio: number;
  /** Number of blank steps answered (correct or wrong/timeout). */
  readonly stepsPlayed: number;
  /** Number of blank steps answered correctly. */
  readonly stepsCorrect: number;
}

export const INITIAL_STATS: Readonly<LanguageWordChainStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswerMs: 0,
  sumAnswerRatio: 0,
  stepsPlayed: 0,
  stepsCorrect: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty,
 * per-chain outcomes, and the content pack identity (see `generatorInfo` /
 * `diagnosticMetadata`). Recording the pack id/version keeps old results
 * interpretable when the pack evolves (constitution §21).
 */
export interface LanguageWordChainRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalAnswerMs: number;
  readonly sumAnswerRatio: number;
  readonly stepsPlayed: number;
  readonly stepsCorrect: number;
  /** Per-chain outcomes in order. */
  readonly roundOutcomes: readonly RoundOutcome[];
  /** Content pack identity — old results stay interpretable across pack updates. */
  readonly contentPackId: string;
  readonly contentPackVersion: string;
  readonly challengeRating: number;
  /** Final adaptive tier (null for fixed difficulties). */
  readonly finalTier: Tier | null;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null: this game ships curated content, not a procedural generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by Word Chain. Applied only in the
 * `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type LanguageWordChainAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      /** Wall-clock session start (diagnostics). */
      startedAtMs: number;
      /** Monotonic clock now (gameplay timing — round deadline base). */
      nowMs: number;
    }
  | { type: "answer-step"; index: number; nowMs: number }
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
export interface LanguageWordChainState {
  phase: LanguageWordChainPhase;
  /** True while the SDK lifecycle is paused (timers frozen, content hidden). */
  paused: boolean;
  /** Selected difficulty (preselected 'normal' in the intro). */
  difficulty: DifficultyLevel | null;
  /** Resolved difficulty profile for the active session. */
  profile: DifficultyProfile | null;
  /** Resolved tuning parameters (mask/rounds/budget/blanks/adaptive bounds). */
  params: WordChainDifficultyParams | null;
  /** QA-injected seed for the next session; null = random per session. */
  seedOverride: string | null;
  /** Canonical seed of the active session. */
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  /** 0-based index of the current chain (round). */
  roundIndex: number;
  /** Tiers the current chain's items may come from. */
  poolTiers: readonly Tier[];
  /** Adaptive only: the active tier; null for fixed difficulties. */
  currentTier: Tier | null;
  /** Current chain puzzle, or null outside the question phase. */
  currentRound: WordChainRound | null;
  /** Index into `currentRound.steps` of the blank being filled. */
  currentStepIndex: number;
  /** Chosen option index per step (null until answered). */
  chosenPerStep: readonly (number | null)[];
  /** Current chain's answer budget in ms. */
  roundBudgetMs: number;
  /** Monotonic-clock segment start of the current chain (active time only). */
  roundStartedAtMs: number | null;
  /** Monotonic-clock deadline of the current chain; null while paused. */
  roundDeadlineMs: number | null;
  /** Frozen remaining budget while paused (resume recomputes the deadline). */
  roundRemainingMs: number | null;
  /** Frozen active elapsed while paused (answer timing excludes pause). */
  roundElapsedMs: number | null;
  /** Monotonic-clock start of the current step (active time only). */
  stepStartedAtMs: number | null;
  /** Frozen active step elapsed while paused. */
  stepElapsedMs: number | null;
  roundOutcome: RoundOutcome | null;
  /** Index the player tapped on the current step (feedback rendering). */
  lastAnswerIndex: number | null;
  /** Answer time recorded for the current step. */
  lastAnswerMs: number | null;
  /** Per-chain outcomes in order (reproducibility envelope). */
  roundOutcomes: readonly RoundOutcome[];
  /** Chain ids already used this session (no prompt repeats). */
  usedChainIds: readonly string[];
  stats: LanguageWordChainStats;
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

export function createInitialLanguageWordChainState(): LanguageWordChainState {
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
    poolTiers: [],
    currentTier: null,
    currentRound: null,
    currentStepIndex: 0,
    chosenPerStep: [],
    roundBudgetMs: 0,
    roundStartedAtMs: null,
    roundDeadlineMs: null,
    roundRemainingMs: null,
    roundElapsedMs: null,
    stepStartedAtMs: null,
    stepElapsedMs: null,
    roundOutcome: null,
    lastAnswerIndex: null,
    lastAnswerMs: null,
    roundOutcomes: [],
    usedChainIds: [],
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
