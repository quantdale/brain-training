/**
 * Pure achievement evaluation (campaign 003 convergence). No db access: the
 * caller builds the snapshot and decides when to persist unlocks
 * (`achievements.unlock` is INSERT OR IGNORE — idempotent by contract).
 */
import type { AchievementDef, AchievementSnapshot } from './types';

/**
 * The ids of every achievement whose criteria the snapshot satisfies.
 * Deterministic — same inputs, same result.
 */
export function evaluateAchievements(
  definitions: readonly AchievementDef[],
  snapshot: AchievementSnapshot,
): string[] {
  return definitions
    .filter((definition) => isMet(definition.criteria, snapshot))
    .map((definition) => definition.id);
}

function isMet(criteria: AchievementDef['criteria'], snapshot: AchievementSnapshot): boolean {
  switch (criteria.type) {
    case 'session-count':
      return snapshot.sessionCount >= criteria.goal;
    case 'total-xp':
      return snapshot.totalXp >= criteria.goal;
  }
}
