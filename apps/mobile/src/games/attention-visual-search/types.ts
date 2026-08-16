/**
 * Visual Search game — shared types (rapid odd-one-out selection).
 *
 * The game is a pure state machine over `VisualSearchGameState` (see
 * reducer.ts); this module owns the vocabulary the reducer, the UI, and the
 * persistence layer all consume.
 *
 * Mechanic: a grid of tiles is shown with exactly ONE distinct target tile
 * (odd one out); the player must tap it within a difficulty-scaled response
 * window. Tapping a distractor fails the round and docks the session clock
 * (small time cost). Rounds escalate: more tiles, shorter windows, within a
 * fixed score-attack session budget.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'attention-visual-search';

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface VisualSearchDifficultyParams {
  /** Session time budget (score attack) in ms. */
  readonly sessionDurationMs: number;
  /** Number of rounds in a session (the session may end earlier on time). */
  readonly rounds: number;
  /** Round-1 grid tile count (square grids: 4, 9, 16, 25). */
  readonly initialGridSize: number;
  /** Largest grid the escalation may reach. */
  readonly maxGridSize: number;
  /** Round-1 response window in ms (the target must be tapped before it). */
  readonly initialWindowMs: number;
  /** Smallest window the escalation may reach. */
  readonly minWindowMs: number;
  /** Window shrink per escalation tier (fixed) or per outcome (adaptive), ms. */
  readonly windowStepMs: number;
  /** Adaptive-only: widest response window. */
  readonly maxWindowMs?: number;
}

export type VisualSearchPhase = 'intro' | 'playing' | 'roundResult' | 'results';

/** Accumulated session statistics (all player-facing raw numbers). */
export interface VisualSearchStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly bestStreak: number;
  readonly streak: number;
  readonly totalTaps: number;
  readonly correctTaps: number;
  /** Sum of response times of passed rounds (avg = / roundsPassed). */
  readonly sumResponseMs: number;
  /** Sum of remaining-window ratios of passed rounds (avg = / roundsPassed). */
  readonly sumResponseRatio: number;
  /** Fastest response over passed rounds; 0 = none yet. */
  readonly fastestResponseMs: number;
}

export const INITIAL_STATS: Readonly<VisualSearchStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  roundsPassed: 0,
  bestStreak: 0,
  streak: 0,
  totalTaps: 0,
  correctTaps: 0,
  sumResponseMs: 0,
  sumResponseRatio: 0,
  fastestResponseMs: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface VisualSearchRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly roundsPassed: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  /** Mean response time over passed rounds, ms. */
  readonly avgResponseMs: number;
  /** Fastest response over passed rounds, ms. */
  readonly fastestResponseMs: number;
  /** Mean remaining-window ratio over passed rounds (0..1; 1 = instant tap). */
  readonly avgSpeedRatio: number;
  readonly initialGridSize: number;
  readonly maxGridSize: number;
  readonly initialWindowMs: number;
  readonly minWindowMs: number;
  readonly sessionDurationMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Visual Search always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Visual Search game. Applied only
 * in the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type VisualSearchAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'tap-tile'; index: number; nowMs: number }
  | { type: 'next-round' }
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
  | { type: 'qa/force-state'; patch: QaForceStatePatch };

/** Complete game state; the screen renders this and dispatches actions. */
export interface VisualSearchGameState {
  phase: VisualSearchPhase;
  /** True while the SDK lifecycle is paused (timers frozen, board obscured). */
  paused: boolean;
  /** Monotonic-clock value captured when the pause began (deadline shifting). */
  pausedAtMs: number | null;
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
  /** Latest monotonic-clock reading (carried by tick/tap/pause/resume actions). */
  nowMs: number;
  /** Monotonic-clock instant the score-attack session ends; docked on distractor taps. */
  sessionDeadlineMs: number;
  /** 0-based index of the current round. */
  roundIndex: number;
  /** Tile count of the current round's grid. */
  gridSize: number;
  /** Response window of the current round, ms. */
  windowMs: number;
  /** Index of the odd tile (the target). */
  targetIndex: number;
  /** Monotonic-clock instant the current round's window expires. */
  roundDeadlineMs: number;
  roundOutcome: 'passed' | 'failed' | null;
  /** Why the round failed; null when not failed. */
  failReason: 'timeout' | 'distractor' | null;
  /** Index of the last tap (error highlight on the result board). */
  lastTapIndex: number | null;
  /** Response time of the last passed round, ms (0 when not passed). */
  lastResponseMs: number;
  /** Points earned by the last passed round (0 when not passed). */
  lastRoundPoints: number;
  stats: VisualSearchStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  tutorialOpen: boolean;
}

export function createInitialVisualSearchState(): VisualSearchGameState {
  return {
    phase: 'intro',
    paused: false,
    pausedAtMs: null,
    difficulty: 'normal',
    profile: null,
    seedOverride: null,
    seed: '',
    sessionId: null,
    startedAtMs: null,
    completedAtMs: null,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    nowMs: 0,
    sessionDeadlineMs: 0,
    roundIndex: 0,
    gridSize: 0,
    windowMs: 0,
    targetIndex: -1,
    roundDeadlineMs: 0,
    roundOutcome: null,
    failReason: null,
    lastTapIndex: null,
    lastResponseMs: 0,
    lastRoundPoints: 0,
    stats: { ...INITIAL_STATS },
    forced: false,
    xp: 0,
    normalized: null,
    persistState: 'idle',
    lastError: null,
    tutorialOpen: false,
  };
}
