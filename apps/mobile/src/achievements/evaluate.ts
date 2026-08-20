/**
 * Pure achievement evaluation (campaign 003 convergence). No db access: the
 * caller builds the snapshot and decides when to persist unlocks
 * (`achievements.unlock` is INSERT OR IGNORE — idempotent by contract).
 */
import type { AchievementDef, AchievementProgress, AchievementSnapshot } from './types';

/**
 * The ids of every achievement whose criteria the snapshot satisfies.
 * Deterministic — same inputs, same result, in definition order.
 */
export function evaluateAchievements(
  definitions: readonly AchievementDef[],
  snapshot: AchievementSnapshot,
): string[] {
  return definitions
    .filter((definition) => isMet(definition.criteria, snapshot))
    .map((definition) => definition.id);
}

/**
 * Compute presentational progress for one achievement against the snapshot.
 * `ratio` is clamped to 0..1 so the UI can render a progress bar safely even
 * before completion.
 */
export function evaluateAchievementProgress(
  definition: AchievementDef,
  snapshot: AchievementSnapshot,
): AchievementProgress {
  const { progress, goal } = rawProgress(definition, snapshot);
  const completed = progress >= goal;
  const ratio = goal <= 0 ? (completed ? 1 : 0) : Math.min(progress / goal, 1);
  return { achievementId: definition.id, progress, goal, completed, ratio };
}

/** Raw (un-clamped) progress toward a definition's goal. */
function rawProgress(
  definition: AchievementDef,
  snapshot: AchievementSnapshot,
): { progress: number; goal: number } {
  const criteria = definition.criteria;
  switch (criteria.type) {
    case 'session-count':
      return { progress: snapshot.sessionCount, goal: criteria.goal };
    case 'total-xp':
      return { progress: snapshot.totalXp, goal: criteria.goal };
    case 'domain-sessions':
      return {
        progress: snapshot.domainSessions?.[criteria.domain] ?? 0,
        goal: criteria.goal,
      };
    case 'longest-streak':
      return { progress: snapshot.longestStreak ?? 0, goal: criteria.goal };
    case 'perfect-sessions':
      return { progress: snapshot.perfectSessions ?? 0, goal: criteria.goal };
  }
}

function isMet(criteria: AchievementDef['criteria'], snapshot: AchievementSnapshot): boolean {
  const { progress, goal } = rawProgress({ criteria } as AchievementDef, snapshot);
  return progress >= goal;
}
