/**
 * Cue Shift (Flexibility) game — shared types (cue-driven task switching).
 *
 * Unlike Card Sort (rule blocks / notice phase) and Color Stroop (word/ink
 * conflict), Cue Shift changes the active rule EVERY trial via an explicit
 * rule cue. The player must read the cue and apply the matching rule to the
 * target stimulus, picking the candidate that matches under that rule.
 *
 * Content model: a `Card = { shape; color; number }`. Three classification
 * rules exist — match by COLOR, by SHAPE, or by NUMBER. Exactly one candidate
 * matches the target under the active rule; the correct candidate matches ONLY
 * under that rule (the cue is genuinely disambiguating), and distractors never
 * match under the active rule (preferring lures that match under one of the
 * OTHER rules to create interference).
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'flexibility-cue-shift';

/** Shape alphabet (fixed; difficulties select the first N). */
export const SHAPES = ['circle', 'triangle', 'square', 'star'] as const;

export type ShapeId = (typeof SHAPES)[number];

/** Color alphabet (fixed; difficulties select the first N). */
export const CARD_COLORS = ['red', 'blue', 'green', 'yellow'] as const;

export type ColorId = (typeof CARD_COLORS)[number];

/** The three classification rules; the active one changes every trial. */
export const RULES = ['color', 'shape', 'number'] as const;

export type RuleId = (typeof RULES)[number];

/** One stimulus card: a shape/color/number triple drawn from the active alphabet. */
export interface Card {
  readonly shape: ShapeId;
  readonly color: ColorId;
  readonly number: number;
}

/** True when `card` matches `target` under `rule`. */
export function matchesUnder(rule: RuleId, card: Card, target: Card): boolean {
  switch (rule) {
    case 'color':
      return card.color === target.color;
    case 'shape':
      return card.shape === target.shape;
    case 'number':
      return card.number === target.number;
  }
}

/** The two rules other than `rule` (for lures / disambiguation checks). */
export function otherRules(rule: RuleId): readonly RuleId[] {
  return RULES.filter((r) => r !== rule);
}

/** Player-facing labels for the rules (used by the cue banner / tutorial). */
export const RULE_LABELS: Readonly<Record<RuleId, string>> = {
  color: 'Match by color',
  shape: 'Match by shape',
  number: 'Match by number',
};

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface FlexibilityCueDifficultyParams {
  /** Number of shapes in the alphabet (3 or 4). */
  readonly numShapes: number;
  /** Number of colors in the alphabet (3 or 4). */
  readonly numColors: number;
  /** Number of distinct integers in the alphabet (1..numNumbers). */
  readonly numNumbers: number;
  /** Total rounds in a session. */
  readonly rounds: number;
  /** Per-trial rule-switch probability (0..1; higher = more switching). */
  readonly switchRate: number;
  /** Reference response time (ms) that earns the full speed bonus. */
  readonly speedTargetMs: number;
  /** Adaptive-only: per-session switch-rate lower bound. */
  readonly minSwitchRate?: number;
  /** Adaptive-only: per-session switch-rate upper bound. */
  readonly maxSwitchRate?: number;
}

export type FlexibilityCuePhase = 'intro' | 'trialActive' | 'trialResult' | 'results';

/**
 * One generated round: a target card, candidate cards, the index of the
 * single candidate that matches the target under the active `rule`, the rule
 * itself, and whether this trial's rule differs from the previous trial's rule
 * (round 0 is always `isSwitch = false`).
 */
export interface GeneratedRound {
  readonly target: Card;
  readonly candidates: readonly Card[];
  readonly correctIndex: number;
  readonly rule: RuleId;
  readonly isSwitch: boolean;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface FlexibilityCueStats {
  readonly score: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly bestStreak: number;
  readonly streak: number;
  /** Sum of per-round response times (only rounds where a card was picked). */
  readonly totalResponseMs: number;
  /** Rounds where a card was picked (correct or wrong). */
  readonly scoredPicks: number;
  /** Trials played immediately after a rule switch (the flexibility diagnostic). */
  readonly switchPlayed: number;
  /** Rule-switch trials answered correctly. */
  readonly switchCorrect: number;
}

export const INITIAL_STATS: Readonly<FlexibilityCueStats> = Object.freeze({
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
});

/** Switch-rule accuracy; 0 when no switch trials were played. */
export function switchAccuracyOf(stats: FlexibilityCueStats): number {
  return stats.switchPlayed > 0 ? stats.switchCorrect / stats.switchPlayed : 0;
}

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 *
 * Note: there is no `switchEvery` / `noticeMs` — those belong to Card Sort's
 * block-switch model. Cue Shift records `switchRate` and `numNumbers`.
 */
export interface FlexibilityCueRawResult extends GameRawResult {
  readonly score: number;
  readonly totalRounds: number;
  readonly roundsPlayed: number;
  readonly correctPicks: number;
  readonly mistakes: number;
  readonly accuracy: number;
  readonly bestStreak: number;
  /** Sum of per-round response times over `scoredPicks` picks. */
  readonly totalResponseMs: number;
  /** Rounds where a card was picked (correct or wrong); speed denominator. */
  readonly scoredPicks: number;
  readonly speedScore: number;
  readonly switchPlayed: number;
  readonly switchCorrect: number;
  readonly switchAccuracy: number;
  readonly numShapes: number;
  readonly numColors: number;
  readonly numNumbers: number;
  /** Effective per-trial switch rate at session end (constant per session). */
  readonly switchRate: number;
  readonly speedTargetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Cue Shift always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Cue Shift game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type FlexibilityCueAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'pick-card'; index: number; responseMs: number }
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
  | { type: 'qa/force-state'; patch: QaForceStatePatch }
  | { type: 'qa/force-timeout' };

/** Complete game state; the screen renders this and dispatches actions. */
export interface FlexibilityCueGameState {
  phase: FlexibilityCuePhase;
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
  /** Active classification rule for the current round (the cue). */
  rule: RuleId;
  /** The full deterministic plan for this session (indexable by roundIndex). */
  plan: readonly GeneratedRound[];
  /** Content of the current round; null outside trialActive/trialResult. */
  round: GeneratedRound | null;
  roundOutcome: 'correct' | 'wrong' | null;
  /** Response time of the last pick, in ms. */
  lastResponseMs: number;
  /** Candidate index of the last pick (highlights the wrong pick on feedback). */
  lastPickIndex: number;
  /** Previous round's target (consecutive-target avoidance + diagnostics). */
  prevTarget: Card | null;
  stats: FlexibilityCueStats;
  forced: boolean;
  xp: number;
  normalized: number | null;
  persistState: 'idle' | 'started' | 'succeeded' | 'failed';
  /** Persistence failure detail (shown on the results screen). */
  lastError: string | null;
  /** Authoritative XP from the rating pipeline (null until persistence succeeds). */
  authoritativeXp: number | null;
  /** Authoritative currency from the rating pipeline (null until persistence succeeds). */
  authoritativeCurrency: number | null;
  /** Authoritative rating deltas with resulting ratings (empty until persistence succeeds). */
  authoritativeDeltas: readonly { domain: string; delta: number; ratingAfter: number }[];
  tutorialOpen: boolean;
}

export function createInitialFlexibilityCueState(): FlexibilityCueGameState {
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
    rounds: 0,
    rule: 'color',
    plan: [],
    round: null,
    roundOutcome: null,
    lastResponseMs: 0,
    lastPickIndex: -1,
    prevTarget: null,
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
