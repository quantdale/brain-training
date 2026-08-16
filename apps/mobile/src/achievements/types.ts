/**
 * Achievement engine types (campaign 003 convergence, constitution §18).
 *
 * Long-term achievements are defined in a versioned app module, seeded into
 * the db (`achievements` table) at startup, evaluated purely against a
 * snapshot, and unlocked once (INSERT OR IGNORE semantics in the repo).
 */
export type AchievementCriteria =
  | { type: 'session-count'; goal: number }
  | { type: 'total-xp'; goal: number };

/** Versioned achievement definition (engine shape; db row shape is flat). */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  criteria: AchievementCriteria;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

/** Pure evaluation input; callers build it from the session/xp repos. */
export interface AchievementSnapshot {
  /** Total completed sessions ever. */
  sessionCount: number;
  /** Lifetime XP: sessions + xp_awards. */
  totalXp: number;
}
