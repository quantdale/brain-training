/**
 * Streaks + Freeze/Shield/Recovery model (campaign 003, WP-3B, constitution §18).
 *
 * Pure reconstruction from activity history plus item cost/limit rules; no
 * db access anywhere in this module except `actions.ts` (which persists item
 * applications and milestone rewards). The orchestrator wires the Home streak
 * slot: read session `completedAt` dates, call `reconstructStreak`, read the
 * inventory from profile settings, and persist item purchases/applications
 * via `db` and the ledger.
 */
export type {
  StreakState,
  StreakItemKind,
  StreakInventory,
  StreakFreezeUsage,
  StreakSettings,
} from './types';
export {
  reconstructStreak,
  effectiveCurrent,
  previousDate,
  nextDate,
  daysBetween,
  toUtcDate,
} from './reconstruct';
export {
  readInventory,
  isStreakItemKind,
  grantItems,
  consumeItem,
  addCoveredDates,
  readCoveredDates,
  clearCoveredDates,
} from './inventory';
export {
  FREEZE_COST_COINS,
  SHIELD_COST_COINS,
  RECOVERY_COST_COINS,
  ITEM_COSTS,
  FREEZE_MAX_PER_PERIOD,
  RECOVERY_MAX_STREAK_RESTORE_DAYS,
  streakPeriodKey,
  readFreezeUsage,
  freezeUsedThisPeriod,
  recordFreezeUse,
  canPurchase,
  canApplyFreeze,
  canApplyRecovery,
  canApplyShield,
  applyFreeze,
  applyRecovery,
  applyFreezeToSettings,
  applyRecoveryToSettings,
  applyShieldToSettings,
} from './rules';
export {
  STREAK_MILESTONES,
  reachedMilestones,
  milestoneProgress,
  readClaimedMilestones,
  markMilestoneClaimed,
} from './milestones';
export type { StreakMilestone, MilestoneProgress } from './milestones';
export { applyOwnedStreakItem, claimStreakMilestoneReward } from './actions';
export type { StreakApplyResult, MilestoneClaimStatus } from './actions';
