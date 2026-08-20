/**
 * Streak item rules: costs, limits and pure decisions (campaign 003, WP-3B,
 * constitution §18: "Missing a day normally breaks a streak. Support
 * proactive Freeze/Shield and post-miss Recovery with later-defined
 * costs/limits.").
 *
 * Cost rationale (config constants — tune freely, nothing here is
 * authoritative economics):
 * - Freeze 100 — cheapest: bought and applied proactively, it simply covers
 *   one upcoming missed day.
 * - Shield 150 — mid: a broader protection window (application semantics are
 *   UI-defined by the orchestrator), hence more than a single freeze.
 * - Recovery 200 — most expensive: it retroactively salvages an already
 *   broken streak, the most valuable effect.
 * Sanity anchor: the player earns ~10 coins per session (~50 XP at 1 coin
 * per 5 XP), so a freeze costs ~10 sessions and a recovery ~20.
 *
 * All functions are pure; callers persist via `db.profile.update` and the
 * ledger (`db.ledger.append`).
 */

import type { StreakFreezeUsage, StreakInventory, StreakItemKind, StreakState } from './types';
import { addCoveredDates, consumeItem, readInventory } from './inventory';
import { daysBetween, nextDate, previousDate } from './reconstruct';

/** Cost of one Freeze (coins, see rationale above). */
export const FREEZE_COST_COINS = 100;
/** Cost of one Shield (coins, see rationale above). */
export const SHIELD_COST_COINS = 150;
/** Cost of one Recovery (coins, see rationale above). */
export const RECOVERY_COST_COINS = 200;

/** Item costs keyed by kind. */
export const ITEM_COSTS: Record<StreakItemKind, number> = {
  freeze: FREEZE_COST_COINS,
  shield: SHIELD_COST_COINS,
  recovery: RECOVERY_COST_COINS,
};

/** Max Freezes usable (purchase or apply) per calendar month. */
export const FREEZE_MAX_PER_PERIOD = 3;

/** Max missed days a Recovery can restore. */
export const RECOVERY_MAX_STREAK_RESTORE_DAYS = 3;

/**
 * Calendar-month period key `YYYY-MM` for a clock date, following the
 * local-calendar convention of the quests module (WP-3A). Tests build `now`
 * from local components (`new Date(y, m, d, ...)`) so results stay
 * deterministic on every host.
 */
export function streakPeriodKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Tolerant read of the `streaks.freezeUsed` monthly usage counter. */
export function readFreezeUsage(settings: Record<string, unknown>): StreakFreezeUsage {
  const block = settings.streaks;
  if (!block || typeof block !== 'object') {
    return { period: '', count: 0 };
  }
  const usage = (block as Record<string, unknown>).freezeUsed;
  if (!usage || typeof usage !== 'object') {
    return { period: '', count: 0 };
  }
  const raw = usage as Record<string, unknown>;
  return {
    period: typeof raw.period === 'string' ? raw.period : '',
    count:
      typeof raw.count === 'number' && Number.isFinite(raw.count) && raw.count > 0
        ? Math.floor(raw.count)
        : 0,
  };
}

/** Freezes already used in the calendar month containing `now` (0 if none). */
export function freezeUsedThisPeriod(settings: Record<string, unknown>, now: Date): number {
  const usage = readFreezeUsage(settings);
  return usage.period === streakPeriodKey(now) ? usage.count : 0;
}

/**
 * PURE settings transform: record one Freeze use in the month containing
 * `now`, resetting automatically when the month rolls over. Call right after
 * persisting an applied Freeze. Unrelated settings keys are preserved.
 */
export function recordFreezeUse(
  settings: Record<string, unknown>,
  now: Date,
): Record<string, unknown> {
  const period = streakPeriodKey(now);
  const usage = readFreezeUsage(settings);
  const count = (usage.period === period ? usage.count : 0) + 1;
  const block = settings.streaks;
  const streaks =
    block && typeof block === 'object' ? { ...(block as Record<string, unknown>) } : {};
  return { ...settings, streaks: { ...streaks, freezeUsed: { period, count } } };
}

/**
 * Can the player buy `kind` with the given ledger balance? Requires a valid
 * kind, a finite non-negative balance covering the cost, and — for Freezes —
 * that the monthly usage cap is not already exhausted. The cap gates purchase
 * and apply alike, so it cannot be exceeded by stockpiling.
 */
export function canPurchase(
  balance: number,
  kind: StreakItemKind,
  settings: Record<string, unknown>,
  now: Date,
): boolean {
  if (!Number.isFinite(balance) || balance < 0) {
    return false;
  }
  const cost = (ITEM_COSTS as Record<string, number | undefined>)[kind];
  if (cost === undefined || balance < cost) {
    return false;
  }
  if (kind === 'freeze' && freezeUsedThisPeriod(settings, now) >= FREEZE_MAX_PER_PERIOD) {
    return false;
  }
  return true;
}

/**
 * Can a Freeze be applied right now? Requires the streak to be at risk (last
 * active day was yesterday — the only window in which a Freeze prevents a
 * break), at least one Freeze owned, and the monthly cap not exhausted.
 */
export function canApplyFreeze(
  state: StreakState,
  settings: Record<string, unknown>,
  now: Date,
): boolean {
  if (!state.atRisk) {
    return false;
  }
  const inventory: StreakInventory = readInventory(settings);
  if (inventory.freeze < 1) {
    return false;
  }
  return freezeUsedThisPeriod(settings, now) < FREEZE_MAX_PER_PERIOD;
}

/**
 * PURE state transform: cover `coveredDate` (normally today) with a Freeze.
 * The covered day counts toward the streak and becomes its new endpoint.
 * Precondition — checked by the caller via `canApplyFreeze` — is that the
 * state is at risk, a Freeze is owned and the monthly cap is not exhausted.
 */
export function applyFreeze(state: StreakState, coveredDate: string): StreakState {
  return {
    ...state,
    current: state.current + 1,
    lastActiveDate: coveredDate,
    atRisk: false,
    frozenDays: state.frozenDays + 1,
  };
}

/**
 * PURE state transform: post-miss Recovery (constitution §18). Restores a
 * broken streak by counting the missed days back into it, capped at
 * `maxRestoreDays` (use `RECOVERY_MAX_STREAK_RESTORE_DAYS`). The covered
 * days count toward the streak and toward `frozenDays`; the streak's endpoint
 * advances to `today` (today itself is not counted unless active/covered).
 *
 * Returns `state` unchanged when there is nothing to restore: no history,
 * the streak is alive or at risk, or the gap exceeds `maxRestoreDays`.
 *
 * Note: `today` is required — the gap between the last active day and today
 * is not derivable from `StreakState` alone (a deliberate, documented
 * deviation from the packet sketch).
 */
export function applyRecovery(state: StreakState, maxRestoreDays: number, today: string): StreakState {
  if (!Number.isInteger(maxRestoreDays) || maxRestoreDays < 0) {
    throw new RangeError('applyRecovery: maxRestoreDays must be a non-negative integer');
  }
  if (state.lastActiveDate === null) {
    return state; // no history to restore
  }
  if (state.lastActiveDate === today || state.lastActiveDate === previousDate(today)) {
    return state; // alive or at risk — recovery is post-miss only
  }
  const missedDays = daysBetween(today, state.lastActiveDate) - 1;
  if (missedDays < 1 || missedDays > maxRestoreDays) {
    return state; // too long gone for this cap
  }
  return {
    ...state,
    current: state.current + missedDays,
    lastActiveDate: today,
    atRisk: false,
    frozenDays: state.frozenDays + missedDays,
  };
}

/**
 * Can a Recovery be applied right now? Requires the streak to be BROKEN
 * (last active day older than yesterday — Recovery is post-miss only), a
 * gap within `maxRestoreDays` (use `RECOVERY_MAX_STREAK_RESTORE_DAYS`), and at
 * least one Recovery owned.
 */
export function canApplyRecovery(
  state: StreakState,
  settings: Record<string, unknown>,
  now: Date,
): boolean {
  if (state.lastActiveDate === null) {
    return false;
  }
  const today = localDateOf(now);
  if (state.lastActiveDate === today || state.lastActiveDate === previousDate(today)) {
    return false; // alive or at risk — recovery is post-miss only
  }
  const missedDays = daysBetween(today, state.lastActiveDate) - 1;
  if (missedDays < 1 || missedDays > RECOVERY_MAX_STREAK_RESTORE_DAYS) {
    return false;
  }
  const inventory: StreakInventory = readInventory(settings);
  return inventory.recovery >= 1;
}

/** Local `YYYY-MM-DD` key for a clock date (repo local-calendar convention). */
function localDateOf(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * PURE settings transform: apply an owned Freeze for `now`'s day. Consumes one
 * Freeze, records monthly usage, and persists `today` as a covered date so the
 * reconstructed streak treats it active. Precondition — checked by the caller
 * via `canApplyFreeze` — is that the streak is at risk, a Freeze is owned, and
 * the monthly cap is not exhausted.
 */
export function applyFreezeToSettings(
  settings: Record<string, unknown>,
  now: Date,
): Record<string, unknown> {
  const today = localDateOf(now);
  const consumed = consumeItem(settings, 'freeze');
  const withUsage = recordFreezeUse(consumed, now);
  return addCoveredDates(withUsage, [today]);
}

/**
 * PURE settings transform: apply an owned Recovery for `now`. Consumes one
 * Recovery and persists the missed days (last active + 1 .. today, inclusive)
 * as covered dates so the reconstructed streak is restored (up to
 * `RECOVERY_MAX_STREAK_RESTORE_DAYS`). Precondition — checked by the caller
 * via `canApplyRecovery` — is that the streak is broken, a Recovery is owned,
 * and the gap is within the restore cap.
 */
export function applyRecoveryToSettings(
  settings: Record<string, unknown>,
  state: StreakState,
  now: Date,
): Record<string, unknown> {
  if (state.lastActiveDate === null) {
    return settings; // nothing to restore
  }
  const today = localDateOf(now);
  const missed = missedDateRange(state.lastActiveDate, today);
  const consumed = consumeItem(settings, 'recovery');
  return addCoveredDates(consumed, missed);
}

/** Inclusive date range from `start + 1` through `end` (both `YYYY-MM-DD`). */
function missedDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = nextDate(start);
  while (cursor <= end) {
    dates.push(cursor);
    cursor = nextDate(cursor);
  }
  return dates;
}

/**
 * Can a Shield be applied right now? The Shield is a broader protection that
 * works in either the at-risk window (acts like a Freeze) or the broken window
 * (acts like a Recovery), provided at least one Shield is owned.
 */
export function canApplyShield(
  state: StreakState,
  settings: Record<string, unknown>,
  now: Date,
): boolean {
  const inventory: StreakInventory = readInventory(settings);
  if (inventory.shield < 1) {
    return false;
  }
  return canApplyFreeze(state, settings, now) || canApplyRecovery(state, settings, now);
}

/**
 * PURE settings transform: apply an owned Shield. Degrades to a Recovery when
 * the streak is broken, otherwise to a Freeze when at risk. No-op when neither
 * window applies. Consumes exactly one Shield.
 */
export function applyShieldToSettings(
  settings: Record<string, unknown>,
  state: StreakState,
  now: Date,
): Record<string, unknown> {
  if (canApplyRecovery(state, settings, now)) {
    return applyRecoveryToSettings(settings, state, now);
  }
  if (canApplyFreeze(state, settings, now)) {
    return applyFreezeToSettings(settings, now);
  }
  return settings;
}
