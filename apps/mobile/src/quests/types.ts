/**
 * Quests/achievements engine types (campaign 003, WP-3A, constitution §18).
 *
 * The engine's `QuestDefinition` is the app-level, versioned contract this
 * module owns (typed criteria + reward). It maps onto the db's flat row shape
 * (`rewardXp` / `rewardCurrency`, opaque `criteria` JSON) in `rewards.ts` —
 * the db layer never interprets criteria.
 */

/** Stable quest id (canonical key across definition versions, e.g. `qd3`). */
export type QuestId = string;

export type QuestKind = 'daily' | 'weekly' | 'longterm';

/**
 * Versioned criteria document. `goal` is the completion target; `evaluate`
 * derives raw progress (count or XP sum) from the session snapshot.
 */
export type QuestCriteria =
  | { type: 'session-count'; goal: number }
  | { type: 'domain-sessions'; domain: string; goal: number }
  | { type: 'earn-xp'; goal: number };

export interface QuestReward {
  /** XP awarded on claim (constitution §17: one global XP level). */
  xp: number;
  /** Currency (coins) appended to the ledger on claim. */
  coins: number;
}

export interface QuestDefinition {
  id: QuestId;
  kind: QuestKind;
  title: string;
  description: string;
  criteria: QuestCriteria;
  reward: QuestReward;
  /** Bump on any change to criteria/reward/title semantics. */
  version: number;
}

/** Result of evaluating one quest for one period (see `evaluate.ts`). */
export interface QuestEvaluation {
  questId: QuestId;
  /** Period covered (see `periodKeyFor`); matches the db progress row key. */
  periodKey: string;
  /** Raw progress in the period (session count or XP sum). */
  progress: number;
  /** Completion target from the definition's criteria. */
  goal: number;
  /** `progress >= goal`. */
  completed: boolean;
}
