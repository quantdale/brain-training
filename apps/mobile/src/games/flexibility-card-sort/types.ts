/**
 * Card Sort (Flexibility) game — shared types (rule-switching state machine).
 *
 * The game is a pure state machine over `FlexibilityGameState` (see
 * reducer.ts) whose core loop is ROUND_ACTIVE → ROUND_RESULT →
 * RULE_SWITCH_NOTICE → ROUND_ACTIVE; this module owns the vocabulary the
 * reducer, the UI, and the persistence layer all consume.
 *
 * Content model: cards are (shape × color) pairs. Two classification rules
 * are available — match by COLOR or match by SHAPE. The active rule switches
 * every K rounds (a "rule block"); each switch passes through an explicit
 * notice phase so the player can re-anchor before the next round.
 */
import type {
  DiagnosticMetadata,
  DifficultyLevel,
  DifficultyProfile,
  GameRawResult,
  GeneratorInfo,
} from '@/sdk';

/** Stable game id (must match game.json). Never rename once shipped. */
export const GAME_ID = 'flexibility-card-sort';

/** Shape alphabet (fixed; difficulties select the first N). */
export const SHAPES = ['circle', 'triangle', 'square', 'star'] as const;

export type ShapeId = (typeof SHAPES)[number];

/** Color alphabet (fixed; difficulties select the first N). */
export const CARD_COLORS = ['red', 'blue', 'green', 'yellow'] as const;

export type ColorId = (typeof CARD_COLORS)[number];

/** The two classification rules; the game switches between them. */
export const RULES = ['color', 'shape'] as const;

export type RuleId = (typeof RULES)[number];

/** One card: a shape/color pair drawn from the active alphabet. */
export interface Card {
  readonly shape: ShapeId;
  readonly color: ColorId;
}

/** True when `card` matches `target` under `rule`. */
export function matchesUnder(rule: RuleId, card: Card, target: Card): boolean {
  return rule === 'color' ? card.color === target.color : card.shape === target.shape;
}

/** The other classification rule (color ⇄ shape). */
export function otherRule(rule: RuleId): RuleId {
  return rule === 'color' ? 'shape' : 'color';
}

/** Game-defined difficulty tuning; recorded in the resolved difficulty profile. */
export interface FlexibilityDifficultyParams {
  /** Number of shapes in the alphabet (3 or 4). */
  readonly numShapes: number;
  /** Number of colors in the alphabet (3 or 4). */
  readonly numColors: number;
  /** Total rounds in a session. */
  readonly rounds: number;
  /** Rounds per rule block before the rule switches (1..4). */
  readonly switchEvery: number;
  /** Rule-switch notice phase duration in ms. */
  readonly noticeMs: number;
  /** Reference response time (ms) that earns the full speed bonus. */
  readonly speedTargetMs: number;
  /** Adaptive-only: per-block switch-frequency lower bound. */
  readonly minSwitchEvery?: number;
  /** Adaptive-only: per-block switch-frequency upper bound. */
  readonly maxSwitchEvery?: number;
}

export type FlexibilityPhase = 'intro' | 'roundActive' | 'roundResult' | 'ruleSwitchNotice' | 'results';

/**
 * One generated round: a target card, four candidate cards, the index of the
 * single candidate that matches the target under the active `rule`, and the
 * rule itself (generation depends on the rule).
 */
export interface GeneratedRound {
  readonly target: Card;
  readonly candidates: readonly Card[];
  readonly correctIndex: number;
  readonly rule: RuleId;
}

/** Accumulated session statistics (all player-facing raw numbers). */
export interface FlexibilityStats {
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
  /** Rounds played immediately after a rule switch (block starts > 0). */
  readonly postSwitchPlayed: number;
  /** Post-switch rounds answered correctly (the flexibility diagnostic). */
  readonly postSwitchCorrect: number;
}

export const INITIAL_STATS: Readonly<FlexibilityStats> = Object.freeze({
  score: 0,
  roundsPlayed: 0,
  correctPicks: 0,
  mistakes: 0,
  bestStreak: 0,
  streak: 0,
  totalResponseMs: 0,
  scoredPicks: 0,
  postSwitchPlayed: 0,
  postSwitchCorrect: 0,
});

/**
 * Raw result persisted with every completed session. Everything needed to
 * reconstruct the exact session is present: seed, versions, difficulty, and
 * generator details (see `generatorInfo` / `diagnosticMetadata`).
 */
export interface FlexibilityRawResult extends GameRawResult {
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
  readonly postSwitchPlayed: number;
  readonly postSwitchCorrect: number;
  readonly switchAccuracy: number;
  readonly numShapes: number;
  readonly numColors: number;
  /** Effective switch frequency at session end (constant for fixed levels). */
  readonly switchEvery: number;
  readonly noticeMs: number;
  readonly speedTargetMs: number;
  readonly challengeRating: number;
  readonly difficulty: DifficultyLevel;
  readonly seed: string;
  readonly gameVersion: string;
  /** Null only for non-procedural games; Card Sort always ships a generator. */
  readonly generatorVersion: string | null;
  readonly scoringVersion: string;
  /** True when the session was ended by a dev-only QA force hook. */
  readonly forced: boolean;
  readonly generatorInfo: GeneratorInfo;
  readonly diagnosticMetadata: DiagnosticMetadata;
}

/**
 * QA force-state patch keys supported by the Card Sort game. Applied only in
 * the `intro` phase; unknown keys are ignored. Dev-only (see hooks.ts).
 */
export interface QaForceStatePatch extends Readonly<Record<string, unknown>> {
  /** Seed for the next session (QA reproducibility). */
  readonly seed?: string | number;
  /** Difficulty for the next session. */
  readonly difficulty?: DifficultyLevel;
}

export type FlexibilityAction =
  | { type: 'select-difficulty'; level: DifficultyLevel }
  | { type: 'start-session'; seed: string; sessionId: string; startedAtMs: number }
  | { type: 'pick-card'; index: number; responseMs: number }
  | { type: 'next-round' }
  | { type: 'notice-expired' }
  | { type: 'notice-continue' }
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
export interface FlexibilityGameState {
  phase: FlexibilityPhase;
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
  /** Active classification rule (matches the banner and the round content). */
  rule: RuleId;
  /** 0-based index of the current rule block. */
  blockIndex: number;
  /** Rounds played inside the current rule block (0 = first round of a block). */
  roundsInBlock: number;
  /** Rounds per rule block (adaptive may adjust this at block boundaries). */
  switchEvery: number;
  /** Picks inside the current rule block (adaptive block-outcome tracking). */
  blockPlayed: number;
  /** Correct picks inside the current rule block. */
  blockCorrect: number;
  /** Content of the current round; null outside roundActive. */
  round: GeneratedRound | null;
  roundOutcome: 'correct' | 'wrong' | null;
  /** Response time of the last pick, in ms. */
  lastResponseMs: number;
  /** Candidate index of the last pick (highlights the wrong pick on feedback). */
  lastPickIndex: number;
  /** Previous round's target (consecutive-target avoidance + diagnostics). */
  prevTarget: Card | null;
  stats: FlexibilityStats;
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

export function createInitialFlexibilityState(): FlexibilityGameState {
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
    blockIndex: 0,
    roundsInBlock: 0,
    switchEvery: 3,
    blockPlayed: 0,
    blockCorrect: 0,
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
