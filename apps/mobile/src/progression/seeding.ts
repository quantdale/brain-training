/**
 * Progression bootstrap — orchestrator convergence seam (campaign 003).
 *
 * Seeds the versioned quest + achievement definitions into the db and syncs
 * current progress/unlocks from persisted history. Called once at app
 * startup after `initDatabase()`; the Profile screen also re-syncs on focus
 * so newly completed sessions update quests/achievements without a restart.
 *
 * All persistence goes through the `AppDatabase` facade; nothing here can
 * touch the network (offline-first, constitution §5 — enforced by the
 * offline-boundary suite).
 */
import type { AppDatabase } from '@/db';
import { ACHIEVEMENT_DEFINITIONS_V1, toDbAchievementDefinition } from '@/achievements';
import { QUEST_DEFINITIONS_V1, toDbQuestDefinition } from '@/quests';
import { syncAchievements, syncQuestProgress } from './sync';

/** Seed versioned definitions (idempotent upserts) + sync current state. */
export async function initializeProgression(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<void> {
  for (const definition of QUEST_DEFINITIONS_V1) {
    await db.quests.upsertDefinition(toDbQuestDefinition(definition));
  }
  for (const definition of ACHIEVEMENT_DEFINITIONS_V1) {
    await db.achievements.upsertDefinition(toDbAchievementDefinition(definition));
  }
  await syncQuestProgress(db, now);
  await syncAchievements(db, now);
}
