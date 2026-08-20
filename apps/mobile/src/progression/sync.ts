/**
 * Progression sync — evaluates quests/achievements against persisted history
 * and records progress/unlocks (campaign 003 convergence).
 *
 * All functions are offline-safe (db + registry only) and idempotent:
 * quest progress rows are monotonic-MAX by repo contract, achievement
 * unlocks are INSERT OR IGNORE.
 */
import { evaluateAchievements, ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';
import type { AppDatabase } from '@/db';
import { getGameDefinition } from '@/registry/registry';
import { reconstructStreak } from '@/streaks';
import {
  evaluateQuests,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
  type QuestSessionSample,
} from '@/quests';
import { localDateString } from '@/workout/today';

/**
 * Cap on how many recent sessions are scanned for evaluation. Realistically
 * far above any player's history in the foundations phase; longterm goals
 * (e.g. 100 sessions) evaluate correctly below this. Documented rather than
 * silently unbounded.
 */
const SYNC_SESSION_SCAN_LIMIT = 5000;

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
  const sessions = await db.sessions.listRecent(SYNC_SESSION_SCAN_LIMIT);
  const samples: QuestSessionSample[] = sessions.map((session) => ({
    completedAt: session.completedAt,
    gameId: session.gameId,
    domain: getGameDefinition(session.gameId)?.primaryCategory ?? 'Unknown',
    xp: session.xp,
  }));
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
 * Re-evaluate every achievement definition and unlock any whose criteria are
 * met. Lifetime XP = sessions + xp_awards (quest/achievement rewards flow
 * through xp_awards, so this never double-counts). The richer snapshot also
 * carries per-domain lifetime sessions, longest streak, and perfect-session
 * counts so category/streak/perfect achievements evaluate correctly.
 */
export async function syncAchievements(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<void> {
  const [sessions, xpAwardsTotal] = await Promise.all([
    db.sessions.listRecent(SYNC_SESSION_SCAN_LIMIT),
    db.xpAwards.getTotalAwardedXp(),
  ]);
  const sessionXp = await db.sessions.getTotalXp();

  const today = localDateString(now);
  const activityDates = sessions.map((session) =>
    localDateString(new Date(session.completedAt)),
  );
  const longestStreak = reconstructStreak(activityDates, today).longest;

  const domainSessions: Record<string, number> = {};
  let perfectSessions = 0;
  for (const session of sessions) {
    const domain = getGameDefinition(session.gameId)?.primaryCategory;
    if (domain) {
      domainSessions[domain] = (domainSessions[domain] ?? 0) + 1;
    }
    if (session.normalizedResult >= 0.9) {
      perfectSessions += 1;
    }
  }

  const snapshot = {
    sessionCount: sessions.length,
    totalXp: sessionXp + xpAwardsTotal,
    domainSessions,
    longestStreak,
    perfectSessions,
  };
  for (const id of evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot)) {
    await db.achievements.unlock(id);
  }
}
