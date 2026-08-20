/**
 * Achievement engine types (campaign 003 convergence, constitution §18).
 *
 * Long-term achievements are defined in a versioned app module, seeded into
 * the db (`achievements` table) at startup, evaluated purely against a
 * snapshot, and unlocked once (INSERT OR IGNORE semantics in the repo).
 *
 * This wave expands the catalog with meaningful tiers and categories and adds
 * richer criteria (per-domain lifetime sessions, longest streak, perfect
 * sessions) so the engagement layer rewards breadth across the whole library,
 * not just raw session/XP volume.
 */
export type AchievementCriteria =
  | { type: 'session-count'; goal: number }
  | { type: 'total-xp'; goal: number }
  | { type: 'domain-sessions'; domain: string; goal: number }
  | { type: 'longest-streak'; goal: number }
  | { type: 'perfect-sessions'; goal: number; threshold?: number };

/** Achievement grouping for presentation (constitution §8 library taxonomy). */
export type AchievementCategory =
  | 'Milestone'
  | 'Memory'
  | 'Attention'
  | 'Speed'
  | 'Math'
  | 'Language'
  | 'Logic'
  | 'Flexibility'
  | 'Spatial';

/**
 * Reward tier. Purely presentational/ordinal — it does not affect evaluation
 * or reward amounts, only how the catalog is grouped and surfaced.
 */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Versioned achievement definition (engine shape; db row shape is flat). */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  criteria: AchievementCriteria;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

/**
 * Pure evaluation input; callers build it from the session/xp/rating repos.
 * The richer fields are optional so older callers (and tests) need not supply
 * them — missing data is treated as zero progress.
 */
export interface AchievementSnapshot {
  /** Total completed sessions ever. */
  sessionCount: number;
  /** Lifetime XP: sessions + xp_awards. */
  totalXp: number;
  /** Lifetime completed sessions per cognitive domain (game primary category). */
  domainSessions?: Record<string, number>;
  /** Longest consecutive-day streak anywhere in history. */
  longestStreak?: number;
  /** Sessions whose normalized performance met/exceeded `threshold` (default 0.9). */
  perfectSessions?: number;
}

/** Presentational progress for one achievement (UI progress bar). */
export interface AchievementProgress {
  achievementId: string;
  progress: number;
  goal: number;
  completed: boolean;
  /** Clamped 0..1 fraction toward the goal. */
  ratio: number;
}
