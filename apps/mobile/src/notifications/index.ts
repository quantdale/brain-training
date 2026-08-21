/**
 * Public surface of the notification preference seam (campaign 010, W19).
 *
 * Pure types/state for what the USER PREFERS about future notifications:
 * master switch, per-kind schedule intents (time window + days). No
 * expo-notifications usage, no scheduling engine, no default schedule —
 * those are deferred decisions (see types.ts / defaults.ts headers).
 */

export type {
  DayOfWeek,
  MinuteOfDay,
  NotificationIntentKind,
  NotificationPreferences,
  ScheduleIntent,
} from './types';
export { NOTIFICATIONS_PREFERENCE_FORMAT_VERSION } from './types';
export {
  ALL_INTENT_KINDS,
  createEmptyNotificationPreferences,
  createEmptyScheduleIntent,
} from './defaults';
export {
  MINUTES_PER_DAY,
  clampMinuteOfDay,
  isWindowDecided,
  normalizeDays,
  normalizeNotificationPreferences,
  normalizeScheduleIntent,
  windowCoversMinute,
} from './normalize';
