/**
 * Sustained Vigilance (Signal Watch) — shared types.
 *
 * Mechanic: a SART-like go/no-go stream. Digits 1–9 appear one at a time in
 * the center of the screen; the player taps GO for every digit EXCEPT the
 * session's stop digit. The stop digit is rare (configurable per difficulty),
 * so responding becomes prepotent and withholding it on target trials is the
 * real challenge — sustained attention plus response inhibition over time.
 *
 * Distinctness from the other Attention games (see also packet W01):
 * - `attention-visual-search` / `attention-odd-one-out`: spatial search over
 *   many simultaneously visible items; here there is exactly one stimulus at
 *   a time and nothing to search.
 * - `attention-target-count`: enumeration/numerosity of a flashed grid; here
 *   no counting is ever required.
 * - `attention-symbol-tracker`: tracking tokens through a scramble (memory +
 *   attention); here memory is irrelevant — the rule is public, the challenge
 *   is staying vigilant and inhibiting a ready response.
 * It is also the only Attention game where NOT acting is the correct answer
 * on target trials.
 *
 * Timing contract (constitution §20): the reducer never reads a clock. Ticks
 * and responses carry `atActiveMs` — the SessionLifecycle's active-only
 * elapsed ms (paused segments excluded by the lifecycle) — and the reducer
 * derives `trialElapsedMs = atActiveMs − trialStartActiveMs`. Pausing freezes
 * the stream exactly; pausing can never buy or lose time.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'attention-sustained-vigilance';

/** Digit pool shown on stimulus cards: 1–9 (classic SART vocabulary). */
export const DIGIT_MIN = 1;
export const DIGIT_MAX = 9;

/**
 * Game-defined difficulty tuning; recorded in the resolved difficulty profile.
 * All timing fields are milliseconds of ACTIVE (non-paused) time.
 */
export interface VigilanceDifficultyParams {
  /** Stimulus trials per session. */
  readonly trials: number;
  /** How long each digit stays visible, in ms. */
  readonly stimulusOnMs: number;
  /** Blank inter-stimulus interval after the digit, in ms. */
  readonly isiMs: number;
  /**
   * Response window measured from stimulus onset, in ms. A GO tap inside the
   * window counts; without one, the trial resolves at window end as an
   * omission (go trial) or a correct hold (target trial).
   */
  readonly responseWindowMs: number;
  /** Percent of trials that are stop-digit targets (e.g. `12` = 12%). */
  readonly targetRarityPct: number;
  /** Minimum number of trials between two targets (no back-to-back stops). */
  readonly minTargetGap: number;
  /** Reaction time scoring full speed marks, in ms (see scoring.ts). */
  readonly rtTargetMs: number;
  /** Reaction time at/above which the speed component scores 0, in ms. */
  readonly rtFailMs: number;
  /** Adaptive-only: response-window lower bound, in ms. */
  readonly minResponseWindowMs?: number;
  /** Adaptive-only: response-window upper bound, in ms. */
  readonly maxResponseWindowMs?: number;
  /** Adaptive-only: per-trial response-window step, in ms. */
  readonly stepResponseWindowMs?: number;
}

/** Phases: intro → stream → results. */
export type VigilancePhase = 'intro' | 'stream' | 'results';

/** Per-trial verdict. */
export type TrialVerdict =
  /** Go trial answered within the window. */
  | 'hit'
  /** Target trial where the player failed to withhold (tapped). */
  | 'commission'
  /** Go trial with no response inside the window. */
  | 'omission'
  /** Target trial correctly withheld through the whole window. */
  | 'correct-hold';

/** True when the verdict means "the player acted on this trial". */
export function isResponseVerdict(verdict: TrialVerdict): boolean {
  return verdict === 'hit' || verdict === 'commission';
}

/** One generated stimulus trial. `isTarget` ⇔ `digit === stopDigit`. */
export interface VigilanceTrial {
  /** 0-based position in the stream. */
  readonly index: number;
  /** Displayed digit, always in `[DIGIT_MIN, DIGIT_MAX]`. */
  readonly digit: number;
  /** True when this is a stop-digit trial (withhold the response). */
  readonly isTarget: boolean;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface VigilanceStats {
  readonly score: number;
  readonly trialsPlayed: number;
  readonly hits: number;
  readonly commissions: number;
  readonly omissions: number;
  readonly correctHolds: number;
  readonly streak: number;
  readonly bestStreak: number;
  /** Valid go-trial reaction times in ms, in play order. */
  readonly reactions: readonly number[];
  /** Sum of per-hit speed factors in [0, 1]; mean = total / hits. */
  readonly totalSpeed: number;
  readonly bestReactionMs: number | null;
}

export const INITIAL_STATS: Readonly<VigilanceStats> = Object.freeze({
  score: 0,
  trialsPlayed: 0,
  hits: 0,
  commissions: 0,
  omissions: 0,
  correctHolds: 0,
  streak: 0,
  bestStreak: 0,
  reactions: [],
  totalSpeed: 0,
  bestReactionMs: null,
});

/** Raw result persisted with every completed session. */
export interface VigilanceRawResult extends GameRawResult {
  readonly score: number;
  readonly trialsTotal: number;
  readonly trialsPlayed: number;
  readonly hits: number;
  readonly commissions: number;
  readonly omissions: number;
  readonly correctHolds: number;
  readonly bestStreak: number;
  readonly meanReactionMs: number | null;
  readonly bestReactionMs: number | null;
  readonly reactions: readonly number[];
  /** Share of go trials hit (0 when no go trial was resolved). */
  readonly goAccuracy: number;
  /** Share of target trials held (0 when no target was resolved). */
  readonly holdAccuracy: number;
  /** Mean per-hit speed factor in [0, 1] (0 when no hit). */
  readonly meanSpeed: number;
  readonly finalResponseWindowMs: number;
  readonly stopDigit: number;
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
 * QA force-state patch keys supported by the game. Applied only in the
 * `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type VigilanceAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'trial-tick'; atActiveMs: number }
  | { type: 'respond'; atActiveMs: number }
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
export interface VigilanceGameState {
  phase: VigilancePhase;
  /** True while the SDK lifecycle is paused (stream frozen + obscured). */
  paused: boolean;
  difficulty: DifficultyLevel | null;
  profile: DifficultyProfile | null;
  /** QA-injected seed for the next session; null = random per session. */
  seedOverride: string | null;
  seed: string;
  sessionId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  activeDurationMs: number;
  pausedDurationMs: number;
  /** Full deterministic trial list, generated once at session start. */
  stream: readonly VigilanceTrial[];
  /** The withheld digit for the active session (1–9); 0 outside sessions. */
  stopDigit: number;
  /** 0-based index of the current trial. */
  trialIndex: number;
  /** Response window in effect for the current trial (adaptive moves it). */
  responseWindowMs: number;
  /** Lifecycle active-ms reading when the current trial's stimulus appeared. */
  trialStartActiveMs: number;
  /** Active-ms elapsed since stimulus onset (updated by ticks). */
  trialElapsedMs: number;
  /** True once the current trial has been answered (GO tapped). */
  responded: boolean;
  /** Reaction time of the accepted response, in ms; null while unanswered. */
  responseRtMs: number | null;
  /** Verdict of the current/last resolved trial; null while unresolved. */
  outcome: TrialVerdict | null;
  stats: VigilanceStats;
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

export function createInitialVigilanceState(): VigilanceGameState {
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
    stream: [],
    stopDigit: 0,
    trialIndex: 0,
    responseWindowMs: 0,
    trialStartActiveMs: 0,
    trialElapsedMs: 0,
    responded: false,
    responseRtMs: null,
    outcome: null,
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
