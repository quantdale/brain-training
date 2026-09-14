/**
 * Progression sync tests (campaign 003 convergence): definition seeding,
 * quest progress recording from persisted sessions, achievement unlocks,
 * and the lifetime-XP composition (sessions + xp_awards).
 */
import { describe, expect, it, jest } from '@jest/globals';

import { AppDatabase, type CompleteSessionInput } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';
import {
  buildAchievementSnapshot,
  buildQuestSamples,
  initializeProgression,
  refreshProgression,
  syncAchievements,
  syncQuestProgress,
} from '@/progression';
import { QUEST_DEFINITIONS_V1, currentPeriodKey } from '@/quests';
import { collectClaimableRewards } from '@/rewards/inbox';
import { wipeLocalData } from '@/data-portability';

const T0 = 1_700_000_000_000;
const SESSION_NOW = new Date(T0 + 60_000);

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
    await initializeProgression(db, SESSION_NOW);

    const quests = await db.quests.listDefinitions();
    const achievements = await db.achievements.listDefinitions();
    expect(quests.length).toBeGreaterThanOrEqual(4);
    expect(achievements.length).toBeGreaterThanOrEqual(4);
    // Idempotent: a second run upserts, never duplicates.
    await initializeProgression(db, new Date(T0));
    expect(await db.quests.listDefinitions()).toHaveLength(quests.length);
    expect(await db.achievements.listDefinitions()).toHaveLength(achievements.length);
  });

  it('skips definition upserts on a steady-state boot and re-seeds on a fingerprint change', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);

    const questUpsert = jest.spyOn(db.quests, 'upsertDefinition');
    const achievementUpsert = jest.spyOn(db.achievements, 'upsertDefinition');
    await initializeProgression(db, SESSION_NOW);
    // Steady state: the fingerprint matches, so the ~50 upserts are skipped.
    expect(questUpsert).not.toHaveBeenCalled();
    expect(achievementUpsert).not.toHaveBeenCalled();

    // A stale fingerprint (definitions bumped in code) re-runs the full seed.
    await db.profile.update({ settings: { progressionSeedVersion: 'stale' } });
    await initializeProgression(db, SESSION_NOW);
    expect(questUpsert).toHaveBeenCalledTimes(QUEST_DEFINITIONS_V1.length);
    expect(achievementUpsert).toHaveBeenCalledTimes(
      ACHIEVEMENT_DEFINITIONS_V1.length,
    );
  });
});

describe('syncQuestProgress', () => {
  it('records progress from completed sessions for the current period', async () => {
    const db = await makeDb();
    await initializeProgression(db, new Date(T0));
    await db.sessions.completeSession({ session: makeSession(), });

    await syncQuestProgress(db, SESSION_NOW);
    const now = SESSION_NOW;
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
    await initializeProgression(db, SESSION_NOW);
    await db.sessions.completeSession({ session: makeSession(), });

    await syncQuestProgress(db, SESSION_NOW);
    await syncQuestProgress(db, SESSION_NOW);
    const now = SESSION_NOW;
    const rows = await db.quests.listProgressForPeriod(currentPeriodKey('daily', now));
    expect(rows.find((row) => row.questId === 'qd3')?.progress).toBe(1);
  });
});

describe('syncAchievements', () => {
  it('unlocks achievements when criteria are met (session count + lifetime XP)', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);

    // One session → ach-first (1 session). Not enough XP for ach-xp-5000 yet.
    await db.sessions.completeSession({ session: makeSession({ xp: 50 }), });
    await syncAchievements(db, SESSION_NOW);
    expect((await db.achievements.getUnlock('ach-first'))?.claimedAt).toBeNull();
    expect(await db.achievements.getUnlock('ach-25')).toBeNull();

    // Award enough XP through xp_awards (e.g. a quest reward) to reach 5000.
    await db.xpAwards.award(4950, 'test reward', 'system');
    await syncAchievements(db, SESSION_NOW);
    expect(await db.achievements.getUnlock('ach-xp-5000')).not.toBeNull();
    // Unlocks are once-only; re-sync adds nothing.
    await syncAchievements(db, SESSION_NOW);
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

  it('excludes future-dated sessions from quest and achievement snapshots', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);
    await db.sessions.completeSession({
      session: makeSession({
        id: 'future-session',
        xp: 50_000,
        startedAt: T0 + 86_340_000,
        completedAt: T0 + 86_400_000,
      }),
    });

    const snapshot = await buildAchievementSnapshot(db, SESSION_NOW);
    expect(snapshot.sessionCount).toBe(0);
    expect(snapshot.totalXp).toBe(0);
    expect(snapshot.distinctGames).toBe(0);
    expect(await buildQuestSamples(db, Number.MAX_SAFE_INTEGER, SESSION_NOW.getTime())).toEqual([]);

    await syncQuestProgress(db, SESSION_NOW);
    await syncAchievements(db, SESSION_NOW);
    expect(await db.achievements.getUnlock('ach-first')).toBeNull();
    expect(
      (await db.quests.listProgressForPeriod(currentPeriodKey('longterm', SESSION_NOW)))
        .find((row) => row.questId === 'qt-xp-50000')?.progress,
    ).toBe(0);
  });

  it('evaluates lifetime quest history beyond the former 5,000-row sample cap', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter, { now: () => T0 });
    await initializeProgression(db, SESSION_NOW);

    // Put the only qualifying XP row just outside the newest-5,000 window;
    // the remaining rows are valid completed sessions with zero XP.
    await adapter.transaction(async (txn) => {
      for (let i = 0; i < 5_001; i += 1) {
        const completedAt = T0 - (5_001 - i) * 1_000;
        await txn.run(
          `INSERT INTO game_sessions (
             id, game_id, game_version, generator_version, scoring_version, seed,
             difficulty_json, raw_result_json, normalized_result, xp,
             started_at, completed_at, duration_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `history-${i}`,
            'memory',
            1,
            1,
            1,
            i,
            '{}',
            '{}',
            0.5,
            i === 0 ? 50_000 : 0,
            completedAt - 1,
            completedAt,
            1,
          ],
        );
      }
    });

    expect((await buildQuestSamples(db)).length).toBe(5_000);
    await syncQuestProgress(db, SESSION_NOW);
    const progress = await db.quests.listProgressForPeriod(
      currentPeriodKey('longterm', SESSION_NOW),
    );
    expect(progress.find((row) => row.questId === 'qt-xp-50000')?.progress).toBe(50_000);
  });
});

describe('refreshProgression (claimable surfaces)', () => {
  it('makes a quest completed in-process claimable without a Profile visit', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);
    // Two 60 XP sessions finish the always-active daily "Daily XP" quest.
    await db.sessions.completeSession({ session: makeSession({ id: 's1', xp: 60 }) });
    await db.sessions.completeSession({ session: makeSession({ id: 's2', xp: 60 }) });

    // Rewards/Home load path: refresh is the only sync, no Profile focus.
    await refreshProgression(db, SESSION_NOW);

    const inbox = await collectClaimableRewards(db, SESSION_NOW);
    expect(inbox.some((item) => item.key.startsWith('quest:qdx:'))).toBe(true);
  });

  it('is monotonic across repeated loads (no double-grant)', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);
    await db.sessions.completeSession({ session: makeSession({ id: 's1', xp: 60 }) });
    await db.sessions.completeSession({ session: makeSession({ id: 's2', xp: 60 }) });

    await refreshProgression(db, SESSION_NOW);
    const first = await collectClaimableRewards(db, SESSION_NOW);
    await refreshProgression(db, SESSION_NOW);
    const second = await collectClaimableRewards(db, SESSION_NOW);

    expect(second.map((item) => item.key)).toEqual(first.map((item) => item.key));
  });

  it('re-seeds a usable empty catalog after a wipe in the same db instance', async () => {
    const db = await makeDb();
    await initializeProgression(db, SESSION_NOW);
    await db.sessions.completeSession({ session: makeSession({ id: 's1' }) });
    await wipeLocalData(db);

    // Engine's pure-clear semantics: catalog and profile are gone.
    expect(await db.quests.listDefinitions()).toHaveLength(0);
    expect(await db.profile.get()).toBeNull();

    await refreshProgression(db, SESSION_NOW);

    // Same process: profile + catalogs restored, history stays empty.
    expect((await db.quests.listDefinitions()).length).toBeGreaterThanOrEqual(4);
    expect((await db.achievements.listDefinitions()).length).toBeGreaterThanOrEqual(4);
    expect(await db.profile.get()).not.toBeNull();
    expect(await db.sessions.countSessions()).toBe(0);
    expect(await collectClaimableRewards(db, SESSION_NOW)).toEqual([]);
  });
});
