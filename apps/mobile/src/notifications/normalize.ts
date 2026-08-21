/**
 * Pure normalization/validation for notification preferences (campaign 010,
 * W19).
 *
 * Deterministic repair of untrusted input (stored JSON, future settings UI):
 * out-of-range values are clamped or reset to the undecided null state, day
 * lists are canonicalized, and unknown intent kinds are DROPPED so newer
 * formats degrade gracefully instead of crashing older consumers. Normalizers
 * never invent a schedule — an invalid window becomes "undecided", never a
 * guessed default.
 */

import type {
  DayOfWeek,
  MinuteOfDay,
  NotificationIntentKind,
  NotificationPreferences,
  ScheduleIntent,
} from './types';
import { ALL_INTENT_KINDS, createEmptyScheduleIntent } from './defaults';

/** Minutes in a day; valid {@link MinuteOfDay} values are `0..MINUTES_PER_DAY - 1`. */
export const MINUTES_PER_DAY = 24 * 60;

const ALL_DAYS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Coerce an unknown value to a boolean (`true` stays true, everything else follows JS truthiness). */
function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

/** Clamp any finite number into the valid minute-of-day range (fractions truncate). */
export function clampMinuteOfDay(minute: number): MinuteOfDay {
  return Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.trunc(minute)));
}

/**
 * Canonicalize a day list: keep only valid day numbers, dedupe, sort
 * ascending. Non-array input yields `[]` (no days selected).
 */
export function normalizeDays(days: unknown): readonly DayOfWeek[] {
  if (!Array.isArray(days)) {
    return [];
  }
  const seen = new Set<number>();
  for (const day of days) {
    if (isFiniteNumber(day) && Number.isInteger(day) && day >= 0 && day <= 6) {
      seen.add(day);
    }
  }
  return ALL_DAYS.filter((day) => seen.has(day));
}

/**
 * Normalize one intent. Rules:
 * - unknown `kind` → `null` (drop; forward compatibility),
 * - window bounds are clamped into `0..1439`; non-finite bounds become
 *   undecided,
 * - a half-specified or `start > end` window (would cross midnight) resets
 *   BOTH bounds to `null` ("undecided") rather than guessing,
 * - days pass through {@link normalizeDays}.
 */
export function normalizeScheduleIntent(
  input: ScheduleIntent | null | undefined,
): ScheduleIntent | null {
  if (!input) {
    return null;
  }
  if (!ALL_INTENT_KINDS.includes(input.kind)) {
    return null;
  }

  let start: MinuteOfDay | null = isFiniteNumber(input.windowStartMinute)
    ? clampMinuteOfDay(input.windowStartMinute)
    : null;
  let end: MinuteOfDay | null = isFiniteNumber(input.windowEndMinute)
    ? clampMinuteOfDay(input.windowEndMinute)
    : null;
  if (start === null || end === null || start > end) {
    start = null;
    end = null;
  }

  return {
    kind: input.kind,
    enabled: toBoolean(input.enabled),
    windowStartMinute: start,
    windowEndMinute: end,
    days: normalizeDays(input.days),
  };
}

/**
 * Normalize full preferences: master switch coerced, every intent passed
 * through {@link normalizeScheduleIntent}, unknown kinds dropped, known kinds
 * that were missing re-added as empty intents so consumers can rely on one
 * entry per kind, in canonical order.
 */
export function normalizeNotificationPreferences(
  input: NotificationPreferences | null | undefined,
): NotificationPreferences {
  const byKind = new Map<NotificationIntentKind, ScheduleIntent>();
  const rawIntents = Array.isArray(input?.intents) ? input.intents : [];
  for (const raw of rawIntents) {
    const intent = normalizeScheduleIntent(raw);
    if (intent && !byKind.has(intent.kind)) {
      byKind.set(intent.kind, intent);
    }
  }
  const intents = ALL_INTENT_KINDS.map(
    (kind) => byKind.get(kind) ?? createEmptyScheduleIntent(kind),
  );
  return {
    masterEnabled: toBoolean(input?.masterEnabled),
    intents: Object.freeze(intents),
  };
}

/**
 * True when the intent carries a decided delivery window (both bounds set).
 */
export function isWindowDecided(intent: ScheduleIntent): boolean {
  return intent.windowStartMinute !== null && intent.windowEndMinute !== null;
}

/**
 * True when `minute` falls inside the intent's decided window (inclusive on
 * both ends). Undecided windows cover nothing.
 */
export function windowCoversMinute(
  intent: ScheduleIntent,
  minute: MinuteOfDay,
): boolean {
  if (!isWindowDecided(intent)) {
    return false;
  }
  const point = clampMinuteOfDay(minute);
  return point >= intent.windowStartMinute! && point <= intent.windowEndMinute!;
}
