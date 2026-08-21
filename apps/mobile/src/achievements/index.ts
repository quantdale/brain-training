/**
 * Long-term achievements engine (campaign 003 convergence, constitution §18):
 * versioned definitions, pure evaluation, once-only unlock/claim rewards.
 */
export type {
  AchievementCriteria,
  AchievementCategory,
  AchievementTier,
  AchievementDef,
  AchievementSnapshot,
  AchievementProgress,
} from './types';
export { ACHIEVEMENT_DEFINITIONS_V1 } from './definitions';
export { evaluateAchievements, evaluateAchievementProgress } from './evaluate';
export { claimAchievementReward, toDbAchievementDefinition } from './rewards';
export type { AchievementClaimResult } from './rewards';
// Engagement V2 (campaign 010 / W12): multi-stage chains + tier ordering.
export {
  ACHIEVEMENT_CHAINS,
  TIER_ORDER,
  resolveChainProgress,
  tierRank,
} from './chains';
export type {
  AchievementChain,
  AchievementChainStage,
  AchievementChainProgress,
} from './chains';
