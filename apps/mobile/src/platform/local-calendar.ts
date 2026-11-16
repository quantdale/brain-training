/**
 * Immutable calendar attribution for completed activity. An instant alone
 * cannot remember the timezone where it was played. Persist its local day
 * once; never re-bucket authoritative quest/streak activity after travel.
 */
export function localDateForTimestamp(timestamp: number): string | null {
  if (!Number.isSafeInteger(timestamp)) return null;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  // The existing period/SQLite calendar contract uses four-digit civil years.
  if (!Number.isFinite(date.getTime()) || year < 100 || year > 9999) return null;
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isLocalCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 100 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Legacy snapshots infer the day only when no persisted attribution exists. */
export function activityLocalDate(sample: {
  completedAt: number;
  completedLocalDate?: string | null;
}): string | null {
  return sample.completedLocalDate == null
    ? localDateForTimestamp(sample.completedAt)
    : isLocalCalendarDate(sample.completedLocalDate) ? sample.completedLocalDate : null;
}

/** A representative local instant for a known civil day, not a new attribution. */
export function localCalendarNoon(day: string): Date {
  if (!isLocalCalendarDate(day)) throw new RangeError('Invalid activity calendar date');
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}
