/**
 * Sentence Builder game — shared types.
 *
 * The game is a pure state machine over `SentenceBuilderState` (see reducer.ts);
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
export const GAME_ID = 'language-sentence-builder';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface SentenceBuilderDifficultyParams {
  /** Min word count per sentence at this tier. */
  readonly minWords: number;
  /** Max word count per sentence at this tier. */
  readonly maxWords: number;
  /** Number of rounds in a session. */
  readonly rounds: number;
  /** Per-sentence time budget in ms. */
  readonly timeBudgetMs: number;
  /** Allowed sentence types (category slugs). Empty = all. */
  readonly allowedCategories: readonly string[];
}

export type SentenceBuilderPhase =
  | 'intro'
  | 'puzzle'
  | 'roundResult'
  | 'results';

/** Accumulated session statistics. */
export interface SentenceBuilderStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly longestSentence: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
  /** Sum of all per-round accuracy fractions (0..1) for normalization. */
  readonly accuracySum: number;
}

export const INITIAL_STATS: Readonly<SentenceBuilderStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  longestSentence: 0,
  totalTaps: 0,
  correctTaps: 0,
  accuracySum: 0,
});

/** A curated sentence from the sentence bank. */
export interface CuratedSentence {
  /** The original sentence text. */
  readonly text: string;
  /** Grammatical category slug. */
  readonly category: string;
  /** Pre-computed word count. */
  readonly wordCount: number;
}

/** Scramble result: words in shuffled order with the mapping back. */
export interface ScrambledSentence {
  /** The original sentence split into words. */
  readonly original: readonly string[];
  /** Shuffled word order (indices into `original`). */
  readonly scrambleOrder: readonly number[];
  /** Words in scrambled order. */
  readonly scrambled: readonly string[];
  /** Category label for the hint. */
  readonly category: string;
}

/**
 * Raw result persisted with every completed session.
 */
export interface SentenceBuilderRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly longestSentence: number;
  readonly avgWordLengthFactor: number;
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

/** QA force-state patch keys supported by the Sentence Builder game. */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type SentenceBuilderAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'tap-word'; index: number }
  | { type: 'timer-expired' }
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
export interface SentenceBuilderState {
  phase: SentenceBuilderPhase;
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
  /** Scrambled sentence for the current round (null before first round). */
  scrambled: ScrambledSentence | null;
  /** Indices tapped so far (in order). */
  taps: readonly number[];
  /** Next expected tap index. */
  inputIndex: number;
  roundOutcome: 'passed' | 'failed' | null;
  /** Previous round's category (for near-duplicate avoidance). */
  prevCategory: string | null;
  stats: SentenceBuilderStats;
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
  /** Field width for layout stability across remounts. */
  fieldWidth: number | null;
}

export function createInitialState(): SentenceBuilderState {
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
    scrambled: null,
    taps: [],
    inputIndex: 0,
    roundOutcome: null,
    prevCategory: null,
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
    fieldWidth: null,
  };
}
