/**
 * Word Scramble game — shared types.
 *
 * The game is a pure state machine over `WordScrambleGameState` (see reducer.ts);
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
export const GAME_ID = 'language-word-scramble';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface WordScrambleDifficultyParams {
  /** Number of options (including the correct answer) per round. */
  readonly optionsCount: number;
  /** Minimum word length for this tier. */
  readonly minWordLength: number;
  /** Maximum word length for this tier. */
  readonly maxWordLength: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Time budget per round in ms (0 = no time limit; score-attack uses clock). */
  readonly roundTimeMs: number;
  /** Adaptive-only: minimum options count. */
  readonly minOptionsCount?: number;
  /** Adaptive-only: maximum options count. */
  readonly maxOptionsCount?: number;
  /** Adaptive-only: minimum word length. */
  readonly adaptiveMinWordLength?: number;
  /** Adaptive-only: maximum word length. */
  readonly adaptiveMaxWordLength?: number;
}

export type WordScramblePhase =
  | 'intro'
  | 'play'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface WordScrambleStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly longestWord: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
}

export const INITIAL_STATS: Readonly<WordScrambleStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  longestWord: 0,
  totalTaps: 0,
  correctTaps: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details.
 */
export interface WordScrambleRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly longestWord: number;
  readonly bestStreak: number;
  readonly optionsCount: number;
  readonly minWordLength: number;
  readonly maxWordLength: number;
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
 * QA force-state patch keys supported by the Word Scramble game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

/** A single round's generated data. */
export interface WordScrambleRound {
  /** The correct answer (lowercase). */
  readonly answer: string;
  /** Category hint for the word. */
  readonly category: string;
  /** Scrambled letters (may differ from original if scramble is valid). */
  readonly scrambled: string;
  /** All option strings (including the correct answer). */
  readonly options: readonly string[];
  /** 0-based index of the correct answer in `options`. */
  readonly correctIndex: number;
  /** Word length of the answer. */
  readonly wordLength: number;
}

export type WordScrambleAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'select-option'; index: number }
  | { type: 'submit-answer' }
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
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface WordScrambleGameState {
  phase: WordScramblePhase;
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
  /** Current round data (answer, scrambled, options, category). */
  currentRound: WordScrambleRound | null;
  /** Index of the selected option (-1 = none selected). */
  selectedIndex: number;
  /** Whether the answer has been submitted. */
  submitted: boolean;
  /** Outcome of the current round. */
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's answer (near-duplicate avoidance). */
  prevAnswer: string | null;
  stats: WordScrambleStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialWordScrambleState(): WordScrambleGameState {
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
    selectedIndex: -1,
    submitted: false,
    roundOutcome: null,
    prevAnswer: null,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
