import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

import type { Tier } from './content-validation';

export const GAME_ID = 'language-context-fit';

export interface ContextFitDifficultyParams {
  readonly tierMask: number;
  readonly rounds: number;
  readonly timePerRoundMs: number;
  readonly minTimePerRoundMs?: number;
  readonly maxTimePerRoundMs?: number;
  readonly timeStepMs?: number;
  readonly initialTier?: number;
}

export type ContextFitPhase = 'intro' | 'question' | 'roundResult' | 'results';

export type RoundOutcome = 'correct' | 'wrong' | 'timeout';

export interface ContextFitStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalAnswerMs: number;
  readonly sumAnswerRatio: number;
}

export const INITIAL_STATS: Readonly<ContextFitStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsCorrect: 0,
  bestStreak: 0,
  streak: 0,
  totalAnswerMs: 0,
  sumAnswerRatio: 0,
});

export interface ContextFitRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsCorrect: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalAnswerMs: number;
  readonly sumAnswerRatio: number;
  readonly roundOutcomes: readonly RoundOutcome[];
  readonly contentPackId: string;
  readonly contentPackVersion: string;
  readonly challengeRating: number;
  readonly finalTier: Tier | null;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type ContextFitAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number; nowMs: number }
  | { type: 'answer-option'; index: number; nowMs: number }
  | { type: 'expire-round'; nowMs: number }
  | { type: 'next-round'; nowMs: number }
  | { type: 'pause'; nowMs: number }
  | { type: 'resume'; nowMs: number }
  | { type: 'tutorial-open' }
  | { type: 'tutorial-close' }
  | { type: 'session-finalized'; xp: number; normalized: number; activeDurationMs: number; pausedDurationMs: number; completedAtMs: number }
  | { type: 'persistence-started' }
  | { type: 'persistence-succeeded' }
  | { type: 'persistence-failed'; message: string }
  | { type: 'completion-outcome-received'; xp: number; currency: number; deltas: readonly { domain: string; delta: number; ratingAfter: number }[] }
  | { type: 'qa/force-win' }
  | { type: 'qa/force-lose' }
  | { type: 'qa/force-timeout' }
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

export interface ContextFitRound {
  readonly itemId: string;
  readonly context: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly correctWord: string;
  readonly tier: Tier;
}

export interface ContextFitGameState {
  phase: ContextFitPhase;
  paused: boolean;
  difficulty: DifficultyLevel | null;
  profile: DifficultyProfile | null;
  params: ContextFitDifficultyParams | null;
  seedOverride: string | null;
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  roundIndex: number;
  poolTiers: readonly Tier[];
  currentTier: Tier | null;
  roundBudgetMs: number;
  round: ContextFitRound | null;
  roundStartedAtMs: number | null;
  roundDeadlineMs: number | null;
  roundRemainingMs: number | null;
  roundElapsedMs: number | null;
  roundOutcome: RoundOutcome | null;
  lastAnswerIndex: number | null;
  lastAnswerMs: number | null;
  roundOutcomes: readonly RoundOutcome[];
  usedItemIds: readonly string[];
  stats: ContextFitStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  lastError: string | null;
  authoritativeXp: number | null;
  authoritativeCurrency: number | null;
  authoritativeDeltas: readonly { domain: string; delta: number; ratingAfter: number }[];
  tutorialOpen: boolean;
}

export function createInitialContextFitState(): ContextFitGameState {
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
    authoritativeXp: null,
    authoritativeCurrency: null,
    authoritativeDeltas: [],
    tutorialOpen: false,
  };
}
