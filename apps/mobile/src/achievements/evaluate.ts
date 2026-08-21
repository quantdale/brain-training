/**
 * Pure achievement evaluation (campaign 003 convergence). No db access: the
 * caller builds the snapshot and decides when to persist unlocks
 * (`achievements.unlock` is INSERT OR IGNORE — idempotent by contract).
 */
import type {
 AchievementDef,
 AchievementProgress,
 AchievementSnapshot,
} from "./types";

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
  case "session-count":
   return { progress: snapshot.sessionCount, goal: criteria.goal };
  case "total-xp":
   return { progress: snapshot.totalXp, goal: criteria.goal };
  case "domain-sessions":
   return {
    progress: snapshot.domainSessions?.[criteria.domain] ?? 0,
    goal: criteria.goal,
   };
  case "longest-streak":
   return { progress: snapshot.longestStreak ?? 0, goal: criteria.goal };
  case "perfect-sessions":
   return { progress: snapshot.perfectSessions ?? 0, goal: criteria.goal };
  case "distinct-games":
   return { progress: snapshot.distinctGames ?? 0, goal: criteria.goal };
  case "domain-coverage":
   return { progress: snapshot.domainCoverage ?? 0, goal: criteria.goal };
  case "active-days":
   return { progress: snapshot.activeDays ?? 0, goal: criteria.goal };
  case "accuracy-sessions":
   return { progress: snapshot.accuracySessions ?? 0, goal: criteria.goal };
  case "best-normalized":
   return { progress: snapshot.bestNormalized ?? 0, goal: criteria.goal };
  case "workout-completions":
   return { progress: snapshot.workoutsCompleted ?? 0, goal: criteria.goal };
  default: {
   // Exhaustiveness guard: when a new criteria type joins AchievementCriteria
   // (catalog growth), TypeScript forces this branch to be updated instead of
   // silently evaluating `undefined >= goal` (never met, NaN ratio).
   const unreachable: never = criteria;
   throw new Error(
    `rawProgress: unknown achievement criteria type: ${JSON.stringify(unreachable)}`,
   );
  }
 }
}

/** Default accuracy threshold for `accuracy-sessions` criteria (a 'good' session). */
const DEFAULT_ACCURACY_THRESHOLD = 0.8;

/** Normalize an `accuracy-sessions` threshold (defaults to 0.8). */
export function accuracyThreshold(criteria: { threshold?: number }): number {
 const t = criteria.threshold ?? DEFAULT_ACCURACY_THRESHOLD;
 return Number.isFinite(t) ? t : DEFAULT_ACCURACY_THRESHOLD;
}

function isMet(
 criteria: AchievementDef["criteria"],
 snapshot: AchievementSnapshot,
): boolean {
 const { progress, goal } = rawProgress(
  { criteria } as AchievementDef,
  snapshot,
 );
 return progress >= goal;
}
