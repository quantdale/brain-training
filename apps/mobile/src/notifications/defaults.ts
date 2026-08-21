/**
 * Null-state notification preferences (campaign 010, W19).
 *
 * The ONLY default this module ships: everything OFF and undecided. That is
 * not a product decision about reminders — it is the absence of one, kept
 * explicit because the real default schedule/copy is a registered deferred
 * decision (docs/DEFERRED_DECISIONS.md). A future product decision replaces
 * the body of {@link createEmptyNotificationPreferences} (or layers a
 * suggested-but-confirm flow on top); nothing else may assume a schedule.
 */

import type {
  NotificationIntentKind,
  NotificationPreferences,
  ScheduleIntent,
} from './types';

/** Every known intent kind in canonical order. */
export const ALL_INTENT_KINDS: readonly NotificationIntentKind[] = [
  'streak-reminder',
  'workout-reminder',
];

/**
 * An all-off, undecided intent for `kind`: disabled, no window, no days.
 */
export function createEmptyScheduleIntent(kind: NotificationIntentKind): ScheduleIntent {
  return {
    kind,
    enabled: false,
    windowStartMinute: null,
    windowEndMinute: null,
    days: [],
  };
}

/**
 * The null state: master switch off, every known kind present but disabled
 * with no decided window/days. Deterministic; intents appear in
 * {@link ALL_INTENT_KINDS} order.
 */
export function createEmptyNotificationPreferences(): NotificationPreferences {
  return {
    masterEnabled: false,
    intents: Object.freeze(ALL_INTENT_KINDS.map(createEmptyScheduleIntent)),
  };
}
