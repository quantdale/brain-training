/**
 * Streak milestones (engagement-cosmetics wave, constitution §18).
 *
 * Milestones are permanent honors tied to the player's BEST streak (the
 * `longest` run), so once reached they stay reached even if the current streak
 * later breaks. Some milestones also confer a cosmetic reward (see
 * `src/cosmetics`) — the cosmetic's own unlock rule references the milestone
 * day count, so ownership is derived, never stored.
 *
 * Pure: every helper is a function of inputs, no db access.
 */
import type { StreakState } from './types';

export interface StreakMilestone {
  id: string;
  /** Streak length (in days) that reaches this milestone. */
  days: number;
  label: string;
  description: string;
  /** Optional one-time reward granted when first reached (constitution §17). */
  rewardXp?: number;
  rewardCurrency?: number;
  /** Optional cosmetic id conferred when reached (see `src/cosmetics`). */
  cosmeticId?: string;
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  Object.freeze({
    id: 'mil-3',
    days: 3,
    label: 'Getting Started',
    description: 'Reach a 3-day streak.',
    rewardXp: 30,
    rewardCurrency: 15,
    cosmeticId: 'cos-accent-amber',
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-7',
    days: 7,
    label: 'One Week',
    description: 'Reach a 7-day streak.',
    rewardXp: 80,
    rewardCurrency: 40,
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-14',
    days: 14,
    label: 'Two Weeks Strong',
    description: 'Reach a 14-day streak.',
    rewardXp: 150,
    rewardCurrency: 75,
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-30',
    days: 30,
    label: 'Monthly Devotion',
    description: 'Reach a 30-day streak.',
    rewardXp: 300,
    rewardCurrency: 150,
    cosmeticId: 'cos-frame-silver',
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-50',
    days: 50,
    label: 'Half Century',
    description: 'Reach a 50-day streak.',
    rewardXp: 500,
    rewardCurrency: 250,
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-100',
    days: 100,
    label: 'Centurion',
    description: 'Reach a 100-day streak.',
    rewardXp: 1000,
    rewardCurrency: 500,
    cosmeticId: 'cos-accent-rose',
  } satisfies StreakMilestone),
  Object.freeze({
    id: 'mil-365',
    days: 365,
    label: 'Year Strong',
    description: 'Reach a 365-day streak.',
    rewardXp: 5000,
    rewardCurrency: 2000,
  } satisfies StreakMilestone),
];

/** Milestone ids reached for a given best (longest) streak length. */
export function reachedMilestones(bestStreak: number): string[] {
  return STREAK_MILESTONES.filter((m) => bestStreak >= m.days).map((m) => m.id);
}

/** Presentational progress for one milestone against a streak state. */
export interface MilestoneProgress {
  milestone: StreakMilestone;
  reached: boolean;
  /** Days remaining until this milestone is reached (0 once reached). */
  remaining: number;
}

/**
 * Compute per-milestone progress for display. `bestStreak` is normally
 * `state.longest` (permanent honors); pass `state.current` to show
 * progress toward the current run instead.
 */
export function milestoneProgress(state: StreakState, useCurrent = false): MilestoneProgress[] {
  const best = useCurrent ? state.current : state.longest;
  return STREAK_MILESTONES.map((milestone) => ({
    milestone,
    reached: best >= milestone.days,
    remaining: best >= milestone.days ? 0 : milestone.days - best,
  }));
}

/**
 * Tolerant read of the `streaks.claimedMilestones` list (ids already rewarded).
 * Missing/garbage → [].
 */
export function readClaimedMilestones(settings: Record<string, unknown>): string[] {
  const block = settings.streaks;
  if (!block || typeof block !== 'object') {
    return [];
  }
  const raw = (block as Record<string, unknown>).claimedMilestones;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value): value is string => typeof value === 'string');
}

/**
 * PURE settings transform: record a milestone as claimed. Returns the next
 * settings object; idempotent (re-claiming an already-claimed id is a no-op).
 * Unrelated settings keys are preserved. The input is not mutated.
 */
export function markMilestoneClaimed(
  settings: Record<string, unknown>,
  milestoneId: string,
): Record<string, unknown> {
  const block = settings.streaks;
  const streaks =
    block && typeof block === 'object' ? { ...(block as Record<string, unknown>) } : {};
  const claimed = new Set(readClaimedMilestones(settings));
  claimed.add(milestoneId);
  return {
    ...settings,
    streaks: { ...streaks, claimedMilestones: [...claimed] },
  };
}
