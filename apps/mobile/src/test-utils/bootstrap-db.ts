/**
 * Bootstrap-aware fake `AppDatabase` for screen tests (Campaign 053).
 *
 * Before Campaign 053 the root layout ran registry registration, progression
 * seeding, and preference reads inside one catch-all block: a partial test
 * double missing `quests.upsertDefinition` failed that block, the failure was
 * logged, and the shell still rendered — so fixtures never had to satisfy the
 * progression contract. The classified bootstrap now treats that same failure
 * as foundational and withholds the shell, which is exactly the product
 * behavior the campaign requires.
 *
 * This helper keeps those fixtures honest without weakening the contract: it
 * wraps a partial fake with no-op progression/achievement repositories and a
 * profile whose `get` returns an empty settings object, so the REAL
 * `initializeProgression` pipeline runs successfully against the fake. Tests
 * still inject the failures they actually intend to exercise (for example a
 * rejecting `profile.update` for the settings-persist suites) through
 * `overrides`.
 */
import type { AppDatabase } from '@/db';

/** Partial fake shape accepted by {@link withBootstrapContract}. */
export type PartialAppDatabase = Record<string, unknown>;

/**
 * Return a fake db that can complete the classified bootstrap: every
 * progression write is a no-op and profile reads/writes degrade safely.
 * Explicit fields on `fake` always win over the bootstrap defaults.
 */
export function withBootstrapContract(
  fake: PartialAppDatabase,
): AppDatabase {
  const bootstrapDefaults: Record<string, unknown> = {
    profile: {
      ensureExists: async () => ({ settings: {} }),
      get: async () => ({ settings: {} }),
      update: async () => undefined,
    },
    quests: {
      upsertDefinition: async () => undefined,
      listDefinitions: async () => [],
      recordProgress: async () => ({ questId: '', period: '', progress: 0, completedAt: null }),
      listProgressForPeriod: async () => [],
      listProgressForQuest: async () => [],
      listAllProgress: async () => [],
      claim: async () => false,
    },
    achievements: {
      upsertDefinition: async () => undefined,
      listDefinitions: async () => [],
      listUnlocks: async () => [],
      unlock: async () => false,
    },
    workouts: {
      countCompleted: async () => 0,
      getByDate: async () => null,
      reconcile: async () => null,
      // Progress-tab overview path (`useWorkout`): the fixture has no workout
      // row, so create-on-read degrades to an empty active instance and the
      // screen renders its honest empty state.
      getOrCreate: async (date: string, seed: { gameIds: string[]; seedVersion?: number }) => ({
        date,
        gameIds: [...seed.gameIds],
        status: 'active' as const,
        currentIndex: 0,
        rerollAttempt: 0,
        seedVersion: seed.seedVersion ?? 0,
        createdAt: 0,
        updatedAt: 0,
      }),
      listRecent: async () => [],
      listRecentSummaries: async () => [],
    },
    sessions: {
      listLightweight: async () => [],
      listSummaries: async () => [],
      listRecent: async () => [],
      countSessions: async () => 0,
      getTotalXp: async () => 0,
      getCount: async () => 0,
      getDistinctGameCount: async () => 0,
      getDistinctActivityDateCount: async () => 0,
      getAccuracySessionCount: async () => 0,
      getBestNormalized: async () => 0,
      getGameIdCounts: async () => ({}),
      getDistinctActivityDates: async () => [],
    },
    xpAwards: {
      getTotalAwardedXp: async () => 0,
    },
  };

  const merged: Record<string, unknown> = { ...bootstrapDefaults };
  for (const [key, value] of Object.entries(fake)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof merged[key] === 'object' &&
      merged[key] !== null
    ) {
      merged[key] = { ...(merged[key] as object), ...(value as object) };
    } else {
      merged[key] = value;
    }
  }
  return merged as unknown as AppDatabase;
}
