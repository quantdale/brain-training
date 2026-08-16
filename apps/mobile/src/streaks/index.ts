/**
 * Streaks + Freeze/Recovery model (campaign 003, WP-3B, constitution §18).
 *
 * Pure reconstruction from activity history plus item cost/limit rules; no
 * db access anywhere in this module. The orchestrator wires the Home streak
 * slot: read session `completedAt` dates, call `reconstructStreak`, read the
 * inventory from profile settings, and persist item purchases/applications
 * via `db.profile.update` and `db.ledger.append`.
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
export { readInventory, grantItems, consumeItem } from './inventory';
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
  applyFreeze,
  applyRecovery,
} from './rules';
