/**
 * Speed — Color Match game: shared types.
 *
 * A color swatch is displayed with a color name label (e.g. a blue swatch with
 * the word "RED" in green text). The player taps the button matching the SWATCH
 * color (not the text color). Congruent trials have matching swatch/label;
 * incongruent trials create Stroop-like interference.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). */
export const GAME_ID = 'speed-color-match';

/** The 6 distinct hue names used in the palette. */
export const COLOR_PALETTE = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type ColorName = (typeof COLOR_PALETTE)[number];

/** Hex colour values for each hue (used in UI rendering). */
export const COLOR_HEX: Readonly<Record<ColorName, string>> = {
  red: '#FF3B30',
  blue: '#007AFF',
  green: '#34C759',
  yellow: '#FFCC00',
  purple: '#AF52DE',
  orange: '#FF9500',
};

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SpeedColorMatchDifficultyParams {
  /** Total number of trials in the session. */
  readonly trials: number;
  /** Proportion of trials that are incongruent (0..1). */
  readonly incongruentRatio: number;
  /** Total time budget for the session in ms. */
  readonly timeBudgetMs: number;
  /** Per-trial stimulus timeout in ms (wrong/miss on expiry). */
  readonly stimulusTimeoutMs: number;
  /** Adaptive-only: ratio lower bound. */
  readonly minIncongruentRatio?: number;
  /** Adaptive-only: ratio upper bound. */
  readonly maxIncongruentRatio?: number;
}

export type SpeedColorMatchPhase =
  | 'intro'
  | 'trial'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface SpeedColorMatchStats {
  readonly score: number;
  readonly trialsPlayed: number;
  readonly trialsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly avgReactionMs: number;
  readonly fastestReactionMs: number;
  readonly slowestReactionMs: number;
}

export const INITIAL_STATS: Readonly<SpeedColorMatchStats> = Object.freeze({
  score: 0,
  trialsPlayed: 0,
  trialsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  avgReactionMs: 0,
  fastestReactionMs: Infinity,
  slowestReactionMs: 0,
});

/**
 * A single trial in the generated sequence.
 * `swatchColor` is the visual swatch hue; `labelColor` is the text colour
 * of the name word. Congruent when swatchColor === labelColor.
 */
export interface Trial {
  readonly swatchColor: ColorName;
  readonly labelColor: ColorName;
}

/**
 * Raw result persisted with every completed session.
 */
export interface SpeedColorMatchRawResult extends GameRawResult {
  readonly score: number;
  readonly totalTrials: number;
  readonly trialsPlayed: number;
  readonly trialsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly avgReactionMs: number;
  readonly fastestReactionMs: number;
  readonly slowestReactionMs: number;
  readonly incongruentRatio: number;
  readonly stimulusTimeoutMs: number;
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

/**
 * QA force-state patch keys supported by Color Match. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type SpeedColorMatchAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'trial-shown'; shownAtMs: number }
  | { type: 'tap-color'; color: ColorName; tappedAtMs: number }
  | { type: 'trial-timeout'; timedOutAtMs: number }
  | { type: 'next-trial' }
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
export interface SpeedColorMatchGameState {
  phase: SpeedColorMatchPhase;
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
  /** 0-based index of the current trial. */
  trialIndex: number;
  /** The full generated trial sequence. */
  trials: readonly Trial[];
  /** Timestamp when the current trial was shown to the player. */
  trialShownAtMs: number | null;
  /** Result of the current trial (null while awaiting response). */
  currentTrialOutcome: 'correct' | 'timeout' | null;
  /** Reaction time of the current trial in ms (null if timeout). */
  currentReactionMs: number | null;
  stats: SpeedColorMatchStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  lastError: string | null;
  /** Authoritative XP from the rating pipeline (null until persistence succeeds). */
  authoritativeXp: number | null;
  /** Authoritative currency from the rating pipeline (null until persistence succeeds). */
  authoritativeCurrency: number | null;
  /** Authoritative rating deltas with resulting ratings (empty until persistence succeeds). */
  authoritativeDeltas: readonly { domain: string; delta: number; ratingAfter: number }[];
  tutorialOpen: boolean;
}

export function createInitialSpeedColorMatchState(): SpeedColorMatchGameState {
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
    trialIndex: 0,
    trials: [],
    trialShownAtMs: null,
    currentTrialOutcome: null,
    currentReactionMs: null,
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
