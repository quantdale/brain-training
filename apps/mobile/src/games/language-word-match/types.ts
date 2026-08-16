/**
 * Word Match — shared types.
 *
 * The game is a pure state machine over `LanguageGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, the generator, and the
 * persistence layer all consume.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

import type { Tier } from './content-validation';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'language-word-match';

/**
 * Game-defined difficulty tuning; recorded in the resolved difficulty profile.
 *
 * Tier selection uses a bitmask over `Tier` (t1=1, t2=2, t3=4) because the SDK
 * difficulty profile only carries numeric parameters. `timePerRoundMs` is the
 * per-round answer budget; a round expires when the player has not answered
 * in time.
 */
export interface LanguageDifficultyParams {
  /** Bitmask over tiers used by this difficulty (t1=1, t2=2, t3=4). */
  readonly tierMask: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-round answer time budget in ms (fixed levels). */
  readonly timePerRoundMs: number;
  /** Adaptive-only: per-round time-budget lower bound. */
  readonly minTimePerRoundMs?: number;
  /** Adaptive-only: per-round time-budget upper bound. */
  readonly maxTimePerRoundMs?: number;
  /** Adaptive-only: budget step applied after each round (±). */
  readonly timeStepMs?: number;
  /** Adaptive-only: starting tier, 1 | 2 | 3. */
  readonly initialTier?: number;
}

export type LanguagePhase = 'intro' | 'question' | 'roundResult' | 'results';

/** Outcome of one round; adaptive difficulty reacts to it. */
export type RoundOutcome = 'correct' | 'wrong' | 'timeout';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface LanguageStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of answer times over played rounds (timeout rounds count the budget). */
  readonly totalAnswerMs: number;
  /** Sum of `answerMs / budget` over played rounds; feeds normalization. */
  readonly sumAnswerRatio: number;
}

export const INITIAL_STATS: Readonly<LanguageStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswerMs: 0,
  sumAnswerRatio: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty,
 * per-round outcomes, and the content pack identity (see `generatorInfo` /
 * `diagnosticMetadata`). Recording the pack id/version keeps old results
 * interpretable when the pack evolves (constitution §21).
 */
export interface LanguageRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalAnswerMs: number;
  readonly sumAnswerRatio: number;
  /** Per-round outcomes in order (reproducibility envelope for adaptive). */
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
 * QA force-state patch keys supported by Word Match. Applied only in the
 * `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type LanguageAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | {
      type: 'start-session';
      seed: string;
      sessionId: string;
      /** Wall-clock session start (diagnostics). */
      startedAtMs: number;
      /** Monotonic clock now (gameplay timing — round deadline base). */
      nowMs: number;
    }
  | { type: 'answer-option'; index: number; nowMs: number }
  | { type: 'expire-round'; nowMs: number }
  | { type: 'next-round'; nowMs: number }
  | { type: 'pause'; nowMs: number }
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
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-timeout' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** A generated round: the prompt plus the shuffled option arrangement. */
export interface LanguageRound {
  readonly itemId: string;
  readonly prompt: string;
  /** Shuffled arrangement of the item's four options. */
  readonly options: readonly string[];
  /** Index into `options` of the correct synonym. */
  readonly correctIndex: number;
  readonly correctWord: string;
  readonly tier: Tier;
  readonly family: string;
}

/** Complete game state; the screen renders this and dispatches actions. */
export interface LanguageGameState {
  phase: LanguagePhase;
  /** True while the SDK lifecycle is paused (timers frozen, content hidden). */
  paused: boolean;
  /** Selected difficulty (preselected 'normal' in the intro). */
  difficulty: DifficultyLevel | null;
  /** Resolved difficulty profile for the active session. */
  profile: DifficultyProfile | null;
  /** Resolved tuning parameters (mask/rounds/budget/adaptive bounds). */
  params: LanguageDifficultyParams | null;
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
  /** Tiers the current round's item may come from. */
  poolTiers: readonly Tier[];
  /** Adaptive only: the active tier; null for fixed difficulties. */
  currentTier: Tier | null;
  /** Current round's answer budget in ms (adaptive adjusts it per round). */
  roundBudgetMs: number;
  /** Current round's question data, or null outside the question phase. */
  round: LanguageRound | null;
  /** Monotonic-clock segment start of the current round (active time only). */
  roundStartedAtMs: number | null;
  /** Monotonic-clock deadline of the current round; null while paused. */
  roundDeadlineMs: number | null;
  /** Frozen remaining budget while paused (resume recomputes the deadline). */
  roundRemainingMs: number | null;
  /** Frozen active elapsed while paused (answer timing excludes pause). */
  roundElapsedMs: number | null;
  roundOutcome: RoundOutcome | null;
  /** Index the player tapped (feedback rendering). */
  lastAnswerIndex: number | null;
  /** Answer time recorded for the current round. */
  lastAnswerMs: number | null;
  /** Per-round outcomes in order (reproducibility envelope). */
  roundOutcomes: readonly RoundOutcome[];
  /** Item ids already used this session (no prompt repeats). */
  usedItemIds: readonly string[];
  stats: LanguageStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialLanguageState(): LanguageGameState {
  return {
    phase: 'intro',
    paused: false,
    difficulty: 'normal',
    profile: null,
    params: null,
    seedOverride: null,
    seed: '',
    sessionId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    roundIndex: 0,
    poolTiers: [],
    currentTier: null,
    roundBudgetMs: 0,
    round: null,
    roundStartedAtMs: null,
    roundDeadlineMs: null,
    roundRemainingMs: null,
    roundElapsedMs: null,
    roundOutcome: null,
    lastAnswerIndex: null,
    lastAnswerMs: null,
    roundOutcomes: [],
    usedItemIds: [],
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
