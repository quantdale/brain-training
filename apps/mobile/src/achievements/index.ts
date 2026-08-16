/**
 * Long-term achievements engine (campaign 003 convergence, constitution §18):
 * versioned definitions, pure evaluation, once-only unlock/claim rewards.
 */
export type {
  AchievementCriteria,
  AchievementDef,
  AchievementSnapshot,
} from './types';
export { ACHIEVEMENT_DEFINITIONS_V1 } from './definitions';
export { evaluateAchievements } from './evaluate';
export { claimAchievementReward, toDbAchievementDefinition } from './rewards';
export type { AchievementClaimResult } from './rewards';
