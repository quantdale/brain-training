/**
 * Progression sync tests (campaign 003 convergence): definition seeding,
 * quest progress recording from persisted sessions, achievement unlocks,
 * and the lifetime-XP composition (sessions + xp_awards).
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, type CompleteSessionInput } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { initializeProgression, syncAchievements, syncQuestProgress } from '@/progression';
import { currentPeriodKey } from '@/quests';

const T0 = 1_700_000_000_000;

function makeSession(overrides: Partial<CompleteSessionInput['session']> = {}) {
  return {
    id: 'session-1',
    gameId: 'memory',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { mode: 'normal' },
    rawResult: { score: 10, accuracy: 1 },
    normalizedResult: 0.8,
    xp: 50,
    startedAt: T0,
    completedAt: T0 + 60_000,
    durationMs: 60_000,
    ...overrides,
  };
}

async function makeDb() {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

describe('initializeProgression', () => {
  it('seeds versioned quest + achievement definitions', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));

    const quests = await db.quests.listDefinitions();
    const achievements = await db.achievements.listDefinitions();
    expect(quests.length).toBeGreaterThanOrEqual(4);
    expect(achievements.length).toBeGreaterThanOrEqual(4);
    // Idempotent: a second run upserts, never duplicates.
    await initializeProgression(db, new Date(T0));
    expect(await db.quests.listDefinitions()).toHaveLength(quests.length);
    expect(await db.achievements.listDefinitions()).toHaveLength(achievements.length);
  });
});

describe('syncQuestProgress', () => {
  it('records progress from completed sessions for the current period', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));
    await db.sessions.completeSession({ session: makeSession(), });

    await syncQuestProgress(db, new Date(T0));
    const now = new Date(T0);
    for (const kind of ['daily', 'weekly', 'longterm'] as const) {
      const rows = await db.quests.listProgressForPeriod(currentPeriodKey(kind, now));
      expect(rows.length).toBeGreaterThan(0);
    }
    // Daily session-count quest (qd3): 1 of 3 after one session.
    const daily = await db.quests.listProgressForPeriod(currentPeriodKey('daily', now));
    const qd3 = daily.find((row) => row.questId === 'qd3');
    expect(qd3?.progress).toBe(1);
    expect(qd3?.completedAt).toBeNull();
  });

  it('is idempotent: repeated syncs keep monotonic progress', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));
    await db.sessions.completeSession({ session: makeSession(), });

    await syncQuestProgress(db, new Date(T0));
    await syncQuestProgress(db, new Date(T0));
    const now = new Date(T0);
    const rows = await db.quests.listProgressForPeriod(currentPeriodKey('daily', now));
    expect(rows.find((row) => row.questId === 'qd3')?.progress).toBe(1);
  });
});

describe('syncAchievements', () => {
  it('unlocks achievements when criteria are met (session count + lifetime XP)', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));

    // One session → ach-first (1 session). Not enough XP for ach-xp-5000 yet.
    await db.sessions.completeSession({ session: makeSession({ xp: 50 }), });
    await syncAchievements(db, new Date(T0));
    expect((await db.achievements.getUnlock('ach-first'))?.claimedAt).toBeNull();
    expect(await db.achievements.getUnlock('ach-25')).toBeNull();

    // Award enough XP through xp_awards (e.g. a quest reward) to reach 5000.
    await db.xpAwards.award(4950, 'test reward', 'system');
    await syncAchievements(db, new Date(T0));
    expect(await db.achievements.getUnlock('ach-xp-5000')).not.toBeNull();
    // Unlocks are once-only; re-sync adds nothing.
    await syncAchievements(db, new Date(T0));
    expect(await db.achievements.listUnlocks()).toHaveLength(2);
  });

  it('lifetime XP = session XP + xp_awards (no double counting)', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));
    await db.sessions.completeSession({ session: makeSession({ xp: 50 }), });
    await db.xpAwards.award(25, 'quest reward', 'quest:test');

    const [sessionXp, awards] = await Promise.all([
      db.sessions.getTotalXp(),
      db.xpAwards.getTotalAwardedXp(),
    ]);
    expect(sessionXp + awards).toBe(75);
  });
});
