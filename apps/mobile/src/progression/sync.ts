/**
 * Progression sync — evaluates quests/achievements against persisted history
 * and records progress/unlocks (campaign 003 convergence).
 *
 * All functions are offline-safe (db + registry only) and idempotent:
 * quest progress rows are monotonic-MAX by repo contract, achievement
 * unlocks are INSERT OR IGNORE.
 *
 * Engagement-wave-02: snapshot/quest-sample builders use O(1) aggregation
 * queries instead of materializing the whole session history, so evaluation
 * scales to large histories without the documented `SYNC_SESSION_SCAN_LIMIT`
 * scan (section F).
 */
import {
  evaluateAchievements,
  ACHIEVEMENT_DEFINITIONS_V1,
} from "@/achievements";
import type { AchievementSnapshot } from "@/achievements";
import type { AppDatabase } from "@/db";
import { getGameDefinition } from "@/registry/registry";
import { reconstructStreak, readCoveredDates } from "@/streaks";
import {
  evaluateQuests,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
  type QuestSessionSample,
} from "@/quests";
import { localDateString } from "@/workout/today";

/**
 * Cap on how many recent sessions are scanned for evaluation. Realistically
 * far above any player's history in the foundations phase; longterm goals
 * (e.g. 100 sessions) evaluate correctly below this. Documented rather than
 * silently unbounded. Only used for the lightweight projection now.
 */
const SYNC_SESSION_SCAN_LIMIT = 5000;

/** Default accuracy threshold for the `accuracy-sessions` achievement family. */
export const ACCURACY_SESSIONS_THRESHOLD = 0.8;
/** Accuracy threshold for the legacy `perfect-sessions` achievement family. */
export const PERFECT_SESSIONS_THRESHOLD = 0.9;

/**
 * Build the lightweight quest-evaluation samples from history. Uses a
 * projection-only query (no JSON blobs) so large histories don't materialize
 * every heavy session row (scalability, §F). `gameId` → domain mapping uses the
 * in-code registry, which is fine: the catalog is small (one row per game).
 */
export async function buildQuestSamples(
  db: AppDatabase,
  limit = SYNC_SESSION_SCAN_LIMIT,
): Promise<QuestSessionSample[]> {
  const rows = await db.sessions.listLightweight(limit);
  return rows.map((row) => ({
    completedAt: row.completedAt,
    gameId: row.gameId,
    domain: getGameDefinition(row.gameId)?.primaryCategory ?? "Unknown",
    xp: row.xp,
  }));
}

/**
 * Re-evaluate the ACTIVE quest pool against the session history and record
 * progress for the current period of each active quest. Only the active
 * subset (deterministic per date/week) is synced so stale pool members keep
 * their last-progressed rows without being re-synced every period. Passing
 * `completedAt: null` for unfinished quests is safe: the row's completed_at
 * only sticks once set (COALESCE in the upsert).
 */
export async function syncQuestProgress(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<void> {
  const samples = await buildQuestSamples(db);
  const active = selectActiveQuests(QUEST_DEFINITIONS_V1, now);
  const evaluations = evaluateQuests(active, { sessions: samples }, now);
  for (const evaluation of evaluations) {
    await db.quests.recordProgress({
      questId: evaluation.questId,
      period: evaluation.periodKey,
      progress: evaluation.progress,
      completedAt: evaluation.completed ? now.getTime() : null,
    });
  }
}

/**
 * Build the full achievement snapshot from aggregation queries instead of
 * loading the whole session history into memory. Every field is a single O(1)
 * SQL aggregate (or a tiny per-game GROUP BY), so evaluation scales to large
 * histories without the documented `SYNC_SESSION_SCAN_LIMIT` scan (§F). The
 * `longestStreak` still requires the distinct active-day list, which is one
 * small row per active day — not one row per session.
 */
export async function buildAchievementSnapshot(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<AchievementSnapshot> {
  const [
    sessionCount,
    sessionXp,
    xpAwardsTotal,
    distinctGames,
    activeDays,
    accuracySessions,
    perfectSessions,
    bestNormalized,
    workoutsCompleted,
    gameIdCounts,
    activityDates,
  ] = await Promise.all([
    db.sessions.getCount(),
    db.sessions.getTotalXp(),
    db.xpAwards.getTotalAwardedXp(),
    db.sessions.getDistinctGameCount(),
    db.sessions.getDistinctActivityDateCount(),
    db.sessions.getAccuracySessionCount(ACCURACY_SESSIONS_THRESHOLD),
    db.sessions.getAccuracySessionCount(PERFECT_SESSIONS_THRESHOLD),
    db.sessions.getBestNormalized(),
    db.workouts.countCompleted(),
    db.sessions.getGameIdCounts(),
    db.sessions.getDistinctActivityDates(),
  ]);

  // Per-domain lifetime counts (for the `domain-sessions` achievements) and the
  // distinct-domain count (for `domain-coverage`). Both derive from the
  // at-most-24-row per-game aggregate, mapping each game to its primary
  // category via the registry.
  const domainSessions: Record<string, number> = {};
  const domainSet = new Set<string>();
  for (const [gameId, count] of Object.entries(gameIdCounts)) {
    const domain = getGameDefinition(gameId)?.primaryCategory;
    if (!domain) {
      continue;
    }
    domainSessions[domain] = (domainSessions[domain] ?? 0) + count;
    domainSet.add(domain);
  }

  const today = localDateString(now);
  // Longest streak reflects the reconstructed streak INCLUDING any covered
  // (freeze/recovery) dates, matching the displayed streak so achievement
  // progress and the Home/Profile streak number stay in agreement.
  const coveredDates = readCoveredDates((await db.profile.get())?.settings ?? {});
  const longestStreak = reconstructStreak(activityDates, today, coveredDates).longest;

  return {
    sessionCount,
    totalXp: sessionXp + xpAwardsTotal,
    domainSessions,
    longestStreak,
    perfectSessions,
    distinctGames,
    domainCoverage: domainSet.size,
    activeDays,
    accuracySessions,
    bestNormalized,
    workoutsCompleted,
  };
}

/**
 * Re-evaluate every achievement definition and unlock any whose criteria are
 * met. The snapshot is built from aggregation queries (see
 * `buildAchievementSnapshot`), so this scales to large histories. Lifetime XP
 * = sessions + xp_awards (quest/achievement rewards flow through xp_awards, so
 * this never double-counts).
 */
export async function syncAchievements(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<void> {
  const snapshot = await buildAchievementSnapshot(db, now);
  for (const id of evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot)) {
    await db.achievements.unlock(id);
  }
}
