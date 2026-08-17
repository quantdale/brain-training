/**
 * Color Stroop game — shared types.
 *
 * The game is a pure state machine over `ColorStroopGameState` (see reducer.ts);
 * this module owns the vocabulary the reducer, the UI, and the persistence
 * layer all consume.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'flexibility-color-stroop';

/**
 * The four game colors. Tokens lack 4 distinct hues suitable for Stroop,
 * so these are defined here with a documented rationale.
 *
 * Design note: These are high-contrast, perceptually distinct hues that
 * work well for color-naming tasks. They avoid confusion between similar
 * shades (e.g., no light blue vs dark blue).
 */
export const STROOP_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type StroopColor = (typeof STROOP_COLORS)[number];

/** Color display values for rendering (hex codes). */
export const STROOP_COLOR_HEX: Readonly<Record<StroopColor, string>> = {
  red: '#E53935',
  blue: '#1E88E5',
  green: '#43A047',
  yellow: '#FDD835',
};

/** Non-color words used for neutral trials. */
export const NEUTRAL_WORDS = ['TABLE', 'CHAIR', 'BOOK', 'PEN', 'DOOR', 'WALL'] as const;

/** The current rule for answering. */
export type AnswerRule = 'ink' | 'word';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface ColorStroopDifficultyParams {
  /** Total number of trials in a session. */
  readonly trials: number;
  /** Fraction of trials that are incongruent (0..1). */
  readonly incongruentRatio: number;
  /** Time budget for the entire session in ms. */
  readonly timeBudgetMs: number;
  /** Number of trials between rule flips. */
  readonly flipFrequency: number;
  /** Display duration for each trial stimulus in ms. */
  readonly stimulusMs: number;
  /** Adaptive-only: incongruent ratio lower bound. */
  readonly minIncongruentRatio?: number;
  /** Adaptive-only: incongruent ratio upper bound. */
  readonly maxIncongruentRatio?: number;
}

export type ColorStroopPhase =
  | 'intro'
  | 'stimulus'
  | 'feedback'
  | 'flipCue'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics. */
export interface ColorStroopStats {
  readonly score: number;
  readonly trialsPlayed: number;
  readonly correctTrials: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly postFlipCorrect: number;
  readonly totalResponseTimeMs: number;
  readonly fastestResponseMs: number;
}

export const INITIAL_STATS: Readonly<ColorStroopStats> = Object.freeze({
  score: 0,
  trialsPlayed: 0,
  correctTrials: 0,
  bestStreak: 0,
  streak: 0,
  postFlipCorrect: 0,
  totalResponseTimeMs: 0,
  fastestResponseMs: Number.POSITIVE_INFINITY,
});

/**
 * A single trial in the generated sequence.
 */
export interface StroopTrial {
  /** The color word displayed (e.g., "RED"). */
  readonly word: StroopColor | string;
  /** The actual ink color the word is rendered in. */
  readonly inkColor: StroopColor;
  /** The correct answer for this trial (depends on current rule). */
  readonly correctAnswer: StroopColor;
  /** The rule in effect for this trial. */
  readonly rule: AnswerRule;
  /** Whether this trial is a rule-flip cue point. */
  readonly isFlipPoint: boolean;
  /** The trial type for diagnostic purposes. */
  readonly trialType: 'congruent' | 'incongruent' | 'neutral';
}

/**
 * Raw result persisted with every completed session.
 */
export interface ColorStroopRawResult extends GameRawResult {
  readonly score: number;
  readonly totalTrials: number;
  readonly trialsPlayed: number;
  readonly correctTrials: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly postFlipCorrect: number;
  readonly avgResponseTimeMs: number;
  readonly fastestResponseMs: number;
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
 * QA force-state patch keys supported by the Color Stroop game.
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type ColorStroopAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'show-stimulus'; trialIndex: number }
  | { type: 'submit-answer'; answer: StroopColor; responseTimeMs: number }
  | { type: 'show-flip-cue' }
  | { type: 'dismiss-flip-cue' }
  | { type: 'next-trial' }
  | { type: 'session-timeout' }
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
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state. */
export interface ColorStroopGameState {
  phase: ColorStroopPhase;
  paused: boolean;
  difficulty: DifficultyLevel | null;
  profile: DifficultyProfile | null;
  seedOverride: string | null;
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  /** 0-based index of the current trial. */
  trialIndex: number;
  /** The generated trial sequence. */
  trials: readonly StroopTrial[];
  /** Current answer rule (may flip during the session). */
  currentRule: AnswerRule;
  /** Number of trials since the last rule flip. */
  trialsSinceFlip: number;
  /** Whether we're showing a flip cue. */
  showingFlipCue: boolean;
  /** The player's answer for the current trial (null if not answered). */
  currentAnswer: StroopColor | null;
  /** Response time for the current trial in ms. */
  currentResponseTimeMs: number | null;
  /** Whether the current trial was correct. */
  currentCorrect: boolean | null;
  /** Previous trial's outcome for streak tracking. */
  previousCorrect: boolean | null;
  stats: ColorStroopStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialColorStroopState(): ColorStroopGameState {
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
    currentRule: 'ink',
    trialsSinceFlip: 0,
    showingFlipCue: false,
    currentAnswer: null,
    currentResponseTimeMs: null,
    currentCorrect: null,
    previousCorrect: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}