/**
 * Notification preference + schedule INTENT types (campaign 010, W19;
 * constitution §24).
 *
 * Pure types/state only: this module deliberately contains NO
 * expo-notifications usage, NO scheduling engine and NO default schedule.
 * Notifications themselves are a deferred system — the concrete schedule,
 * copy and delivery mechanics are registered deferred decisions
 * (docs/DEFERRED_DECISIONS.md: "notification schedule and copy"). What lands
 * here is the vocabulary a future implementation (and its settings UI) can
 * be written against: what the USER PREFERS, expressed as intents, never as
 * promised OS-level alarms.
 */

/** Format version of the persisted preference shape (for future migrations). */
export const NOTIFICATIONS_PREFERENCE_FORMAT_VERSION = 1;

/**
 * Day-of-week as used by JS `Date#getDay`: `0 = Sunday` … `6 = Saturday`.
 * The numeric convention keeps the type directly computable from local dates
 * without a mapping table.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Minutes since local midnight for one wall-clock time (`0..1439`). */
export type MinuteOfDay = number;

/**
 * Stable keys for the kinds of notifications the user may opt into. Additive
 * vocabulary only — adding a kind is backward compatible; unknown kinds in
 * stored preferences are dropped by `normalize.ts` (forward compatibility).
 *
 * - `streak-reminder`: conservative nudge while a streak is at risk (§18).
 * - `workout-reminder`: nudge that today's workout is waiting (§14).
 */
export type NotificationIntentKind = 'streak-reminder' | 'workout-reminder';

/**
 * One user-expressed scheduling intent. This is a PREFERENCE MODEL, not an
 * OS schedule: nothing here decides that anything actually fires.
 *
 * All fields are readonly; mutate through replacement (the normalizer in
 * `normalize.ts` returns new objects).
 */
export interface ScheduleIntent {
  /** Which notification kind this intent configures. */
  readonly kind: NotificationIntentKind;
  /** User-level on/off for this kind (subject to the master switch). */
  readonly enabled: boolean;
  /**
   * Preferred window start, minutes since LOCAL midnight (`0..1439`). `null`
   * means "not decided yet" — there is intentionally NO default time: the
   * actual default schedule is a deferred product decision.
   */
  readonly windowStartMinute: MinuteOfDay | null;
  /**
   * Preferred window end, same units/convention as {@link windowStartMinute}.
   * Windows never cross midnight; `null` pairs with a `null` start.
   */
  readonly windowEndMinute: MinuteOfDay | null;
  /**
   * Days the intent may fire (`0 = Sunday`…`6 = Saturday`). An empty array
   * means no days selected (= effectively off) — NOT "every day"; callers
   * must list all seven days explicitly for daily intent.
   */
  readonly days: readonly DayOfWeek[];
}

/** The complete user preference state for notifications. */
export interface NotificationPreferences {
  /**
   * Master switch (constitution §24: notifications stay conservative and
   * configurable). When `false`, every intent is ignored regardless of its
   * own `enabled` flag.
   */
  readonly masterEnabled: boolean;
  /** One intent per known kind; see `defaults.ts` / `normalize.ts`. */
  readonly intents: readonly ScheduleIntent[];
}
