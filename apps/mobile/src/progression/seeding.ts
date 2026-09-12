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
import {
  QUEST_DEFINITIONS_V1,
  toDbQuestDefinition,
  type QuestDefinition,
} from '@/quests';
import { syncAchievements, syncQuestProgress } from './sync';

/** Settings key holding the fingerprint of the last applied definition seed. */
const PROGRESSION_SEED_VERSION_KEY = 'progressionSeedVersion';

/**
 * Deterministic fingerprint of the versioned definition catalogs. Bumping any
 * definition's `version` (or adding/removing one) changes the fingerprint and
 * forces the upsert pass; a steady-state boot skips the ~50 upserts and only
 * reads the fingerprint (Campaign 027 startup work). Fail-closed: an
 * unreadable/corrupt settings value runs the full seeding path.
 */
export function progressionSeedVersion(
  quests: readonly QuestDefinition[] = QUEST_DEFINITIONS_V1,
  achievements: readonly { id: string; version: number }[] = ACHIEVEMENT_DEFINITIONS_V1,
): string {
  const questKey = quests.map((d) => `${d.id}@${d.version}`).join(',');
  const achievementKey = achievements.map((d) => `${d.id}@${d.version}`).join(',');
  return `q${quests.length}[${questKey}]a${achievements.length}[${achievementKey}]`;
}

/** Seed versioned definitions (idempotent upserts) + sync current state. */
export async function initializeProgression(
  db: AppDatabase,
  now: Date = new Date(),
): Promise<void> {
  const target = progressionSeedVersion();
  let stored: unknown;
  try {
    stored = (await db.profile.ensureExists()).settings[PROGRESSION_SEED_VERSION_KEY];
  } catch {
    // Fail-closed: an unreadable profile must not skip the seed pass.
    stored = undefined;
  }
  if (stored !== target) {
    for (const definition of QUEST_DEFINITIONS_V1) {
      await db.quests.upsertDefinition(toDbQuestDefinition(definition));
    }
    for (const definition of ACHIEVEMENT_DEFINITIONS_V1) {
      await db.achievements.upsertDefinition(toDbAchievementDefinition(definition));
    }
    await db.profile.update({
      settings: { [PROGRESSION_SEED_VERSION_KEY]: target },
    });
  }
  await syncQuestProgress(db, now);
  await syncAchievements(db, now);
}
