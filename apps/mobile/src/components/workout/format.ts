/**
 * Workout UI formatting helpers (campaign 010 / W24).
 *
 * Small pure functions shared by the workout components. Deterministic:
 * inputs are passed explicitly — no clock, no db, no registry access — so
 * callers (and tests) fully control them.
 */

/**
 * Human label for a duration: "45s", "4m 30s", "1h 05m". Non-finite or
 * non-positive inputs degrade to "0s" instead of producing garbage labels.
 */
export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0s';
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Local-midnight timestamp for a YYYY-MM-DD date string (no timezone
 * suffix → parsed as local time, matching how the app draws day boundaries).
 * Returns NaN for malformed input; callers feed the result to formatters
 * that already degrade gracefully on non-finite values.
 */
export function localDayStartMs(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}
