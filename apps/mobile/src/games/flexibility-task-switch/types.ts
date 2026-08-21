/**
 * Task Switch (Flexibility) game — shared types.
 *
 * Classic Monsell task switching. Each trial shows a Token (a number rendered
 * in a color and shape) and an explicit TASK CUE. The player applies the cued
 * task to the token and picks the matching answer:
 *
 *   - parity:    answers {Even, Odd}        (number % 2)
 *   - magnitude: answers {Low (1–4), High (5–9)}
 *   - color:     answers {Red, Blue, Green, Yellow}  (token.color)
 *
 * A SWITCH trial is one whose cued task differs from the previous trial's
 * task. The deterministic schedule uses `switchRate` (probability the next
 * trial's task differs). Switch cost is measured as `switchAccuracy −
 * repeatAccuracy` (device-independent) plus an informational `switchCostMs`.
 *
 * The module is a pure state machine over `FlexibilityTaskSwitchGameState`
 * (see reducer.ts); the screen owns timing, lifecycle, tutorial, and
 * persistence side effects.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from "@/sdk";

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = "flexibility-task-switch";

/** Token color alphabet (fixed; difficulties select the first N). */
export const TOKEN_COLORS = ["red", "blue", "green", "yellow"] as const;

export type ColorId = (typeof TOKEN_COLORS)[number];

/** Token shape alphabet (fixed; difficulties select the first N). */
export const TOKEN_SHAPES = ["circle", "triangle", "square", "star"] as const;

export type ShapeId = (typeof TOKEN_SHAPES)[number];

/** The task set. */
export const TASKS = ["parity", "magnitude", "color"] as const;

export type TaskId = (typeof TASKS)[number];

/** One stimulus token: a number shown in a color and shape. */
export interface Token {
  readonly number: number;
  readonly color: ColorId;
  readonly shape: ShapeId;
}

/** Player-facing cue labels for each task. */
export const TASK_LABELS: Readonly<Record<TaskId, string>> = {
  parity: "Is it EVEN or ODD?",
  magnitude: "Is it LOW or HIGH?",
  color: "What COLOR is it?",
};

/** Short cue word for compact banners. */
export const TASK_CUE_WORDS: Readonly<Record<TaskId, string>> = {
  parity: "Parity",
  magnitude: "Magnitude",
  color: "Color",
};

/** Ordered answer option lists per task (stable order → deterministic options). */
export const TASK_ANSWERS: Readonly<Record<TaskId, readonly string[]>> = {
  parity: ["Even", "Odd"],
  magnitude: ["Low", "High"],
  color: ["Red", "Blue", "Green", "Yellow"],
};

/** The correct answer string for a token under a given task. */
export function correctAnswerFor(task: TaskId, token: Token): string {
  switch (task) {
    case "parity":
      return token.number % 2 === 0 ? "Even" : "Odd";
    case "magnitude":
      return token.number <= 4 ? "Low" : "High";
    case "color":
      return token.color.charAt(0).toUpperCase() + token.color.slice(1);
  }
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface FlexibilityTaskSwitchDifficultyParams {
  /** Total rounds in a session. */
  readonly rounds: number;
  /** Per-trial switch probability (0..1; higher = more task switching). */
  readonly switchRate: number;
  /** Tasks available this session. */
  readonly taskPool: readonly TaskId[];
  /** Number of colors in the token alphabet (3 or 4). */
  readonly numColors: number;
  /** Number of shapes in the token alphabet (3 or 4). */
  readonly numShapes: number;
  /** Max token number (always 9). */
  readonly numNumbers: number;
  /** Reference response time (ms) that earns the full speed bonus. */
  readonly speedTargetMs: number;
  /** Adaptive-only: per-session switch-rate lower bound. */
  readonly minSwitchRate?: number;
  /** Adaptive-only: per-session switch-rate upper bound. */
  readonly maxSwitchRate?: number;
}

export type FlexibilityTaskSwitchPhase =
  | "intro"
  | "trialActive"
  | "trialResult"
  | "results";

/** One generated round: the cued task, the token, the answer options, and the correct index. */
export interface GeneratedRound {
  readonly task: TaskId;
  readonly token: Token;
  readonly options: readonly string[];
  readonly correctIndex: number;
  /** True when this trial's task differs from the previous trial's task. */
  readonly isSwitch: boolean;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface FlexibilityTaskSwitchStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of per-round response times (only rounds where an answer was picked). */
  readonly totalResponseMs: number;
  /** Rounds where an answer was picked (correct or wrong). */
  readonly scoredPicks: number;
  /** Switch trials played (task differed from previous trial). */
  readonly switchPlayed: number;
  /** Switch trials answered correctly. */
  readonly switchCorrect: number;
  /** Repeat trials played (task same as previous trial). */
  readonly repeatPlayed: number;
  /** Repeat trials answered correctly. */
  readonly repeatCorrect: number;
  /** Sum of response times on switch trials (for switch-cost telemetry). */
  readonly switchRtSum: number;
  /** Count of switch trials with a recorded response time. */
  readonly switchRtCount: number;
  /** Sum of response times on repeat trials. */
  readonly repeatRtSum: number;
  /** Count of repeat trials with a recorded response time. */
  readonly repeatRtCount: number;
}

export const INITIAL_STATS: Readonly<FlexibilityTaskSwitchStats> =
  Object.freeze({
    score: 0,
    roundsPlayed: 0,
    correctPicks: 0,
    mistakes: 0,
    bestStreak: 0,
    streak: 0,
    totalResponseMs: 0,
    scoredPicks: 0,
    switchPlayed: 0,
    switchCorrect: 0,
    repeatPlayed: 0,
    repeatCorrect: 0,
    switchRtSum: 0,
    switchRtCount: 0,
    repeatRtSum: 0,
    repeatRtCount: 0,
  });

/** Switch-cost metric (ms): avg switch RT − avg repeat RT, clamped ≥ 0. */
export function switchCostMsOf(stats: FlexibilityTaskSwitchStats): number {
  if (stats.switchRtCount === 0 || stats.repeatRtCount === 0) {
    return 0;
  }
  const switchAvg = stats.switchRtSum / stats.switchRtCount;
  const repeatAvg = stats.repeatRtSum / stats.repeatRtCount;
  return Math.max(0, switchAvg - repeatAvg);
}

/** Share of switch trials answered correctly; 0 when none were played. */
export function switchAccuracyOfStats(
  stats: FlexibilityTaskSwitchStats,
): number {
  return stats.switchPlayed > 0 ? stats.switchCorrect / stats.switchPlayed : 0;
}

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface FlexibilityTaskSwitchRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly totalResponseMs: number;
  readonly scoredPicks: number;
  readonly speedScore: number;
  readonly switchPlayed: number;
  readonly switchCorrect: number;
  readonly switchAccuracy: number;
  readonly repeatPlayed: number;
  readonly repeatCorrect: number;
  readonly switchCostMs: number;
  readonly taskPool: readonly TaskId[];
  readonly numColors: number;
  readonly numShapes: number;
  readonly numNumbers: number;
  readonly switchRate: number;
  readonly speedTargetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; this game always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/** QA force-state patch keys supported by the Task Switch game. Dev-only. */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  readonly seed?: string | number;
  readonly difficulty?: DifficultyLevel;
}

export type FlexibilityTaskSwitchAction =
  | { type: "select-difficulty"; level: DifficultyLevel }
  | {
      type: "start-session";
      seed: string;
      sessionId: string;
      startedAtMs: number;
    }
  | { type: "answer"; index: number; responseMs: number }
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
export interface FlexibilityTaskSwitchGameState {
  phase: FlexibilityTaskSwitchPhase;
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
  /** Total rounds in the session (from the difficulty params). */
  rounds: number;
  /** The full deterministic plan for this session (indexable by roundIndex). */
  plan: readonly GeneratedRound[];
  /** Content of the current round; null outside trialActive/trialResult. */
  round: GeneratedRound | null;
  roundOutcome: "correct" | "wrong" | null;
  /** Response time of the last answer, in ms. */
  lastResponseMs: number;
  /** Candidate index of the last answer (highlights the wrong pick on feedback). */
  lastPickIndex: number;
  /** Previous round's task (switch detection); null for round 0. */
  prevTask: TaskId | null;
  stats: FlexibilityTaskSwitchStats;
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

export function createInitialFlexibilityTaskSwitchState(): FlexibilityTaskSwitchGameState {
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
    rounds: 0,
    plan: [],
    round: null,
    roundOutcome: null,
    lastResponseMs: 0,
    lastPickIndex: -1,
    prevTask: null,
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
