/**
 * Shell formatting helpers (W13) — small pure functions shared by the shell
 * screens. Deterministic: every function takes `now` explicitly so callers
 * (and tests) control the clock.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Human label for a timestamp relative to `now`, by local calendar day:
 * "Today", "Yesterday", "N days ago" (2–6), otherwise a locale date string.
 * Day boundaries use local midnight so the label matches what the player
 * sees as "days" everywhere else in the app (streaks, workouts).
 */
export function formatRelativeDay(timestampMs: number, nowMs: number): string {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) {
    return '—';
  }
  const startOfDay = (ms: number): number => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayDiff = Math.round((startOfDay(nowMs) - startOfDay(timestampMs)) / DAY_MS);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff <= 6) return `${dayDiff} days ago`;
  return new Date(timestampMs).toLocaleDateString();
}

export interface PerformanceBand {
  /** Short player-facing headline for a normalized result. */
  label: string;
  /** Semantic text color slot for the headline. */
  tone: 'success' | 'accent' | 'warning' | 'textSecondary';
}

/**
 * Map a normalized result (0..1) to an encouraging, non-clinical headline
 * band (constitution §4/§16: no unsupported claims; simple headline plus
 * metrics). Bands are inclusive lower bounds.
 */
export function performanceBand(normalizedResult: number): PerformanceBand {
  if (!(normalizedResult >= 0)) {
    return { label: 'Session complete', tone: 'textSecondary' };
  }
  if (normalizedResult >= 0.9) {
    return { label: 'Outstanding', tone: 'success' };
  }
  if (normalizedResult >= 0.75) {
    return { label: 'Strong run', tone: 'success' };
  }
  if (normalizedResult >= 0.5) {
    return { label: 'Solid work', tone: 'accent' };
  }
  if (normalizedResult >= 0.25) {
    return { label: 'Keep going', tone: 'warning' };
  }
  return { label: 'Keep training', tone: 'textSecondary' };
}
