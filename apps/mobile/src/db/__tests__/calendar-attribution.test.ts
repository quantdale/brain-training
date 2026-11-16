import { describe, expect, it } from '@jest/globals';

import { AppDatabase } from '../index';
import { createMigratedDb } from './helpers';
import { createNodeSqliteAdapter } from '../adapters/node';
import { initializeConnection, runMigrations } from '../migrate';
import { applyQuestReward, evaluateQuest, QUEST_DEFINITIONS_V1, toDbQuestDefinition } from '@/quests';
import { syncQuestProgress } from '@/progression/sync';
import { initializeProgression } from '@/progression/seeding';
import { applyImport, exportLocalDataBundle, parseAndValidateBackup, serializeBackup } from '@/data-portability';
import { buildEnvelope, emptyData, T0 } from '@/data-portability/__tests__/helpers';
import { clearWorkoutSessionLaunch, registerWorkoutSessionLaunch } from '@/workout/session-provenance';

function record(id: string, completedAt = T0 + 100) {
  return {
    id, gameId: 'memory', gameVersion: 1, generatorVersion: 1, scoringVersion: 1,
    seed: 1, difficulty: {}, rawResult: {}, normalizedResult: 0.5, xp: 10,
    startedAt: completedAt - 100, completedAt, durationMs: 100,
  };
}

const qd3 = QUEST_DEFINITIONS_V1.find((definition) => definition.id === 'qd3')!;

describe('immutable session calendar attribution', () => {
  it('does not count the same three sessions in a second local day or week', () => {
    const completedAt = new Date(2026, 10, 16, 0, 15).getTime();
    const sessions = ['a', 'b', 'c'].map((gameId) => ({
      gameId, completedAt, completedLocalDate: '2026-11-15', domain: 'Memory', xp: 10,
    }));
    expect(evaluateQuest(qd3, { sessions }, new Date(2026, 10, 15, 23, 50)).completed).toBe(true);
    expect(evaluateQuest(qd3, { sessions }, new Date(2026, 10, 16, 0, 50)).progress).toBe(0);
    const weekly = { ...qd3, kind: 'weekly' as const };
    expect(evaluateQuest(weekly, { sessions }, new Date(2026, 10, 16, 0, 50)).progress).toBe(0);
  });

  it('preserves an imported completion day across projections, re-export and merge', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);
    const data = emptyData();
    data.gameSessions = [{ ...record('stable-day'), completedLocalDate: '2026-11-15' }];
    await applyImport(db, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');
    expect(await db.sessions.getDistinctActivityDates()).toEqual(['2026-11-15']);
    expect(await db.sessions.getDailySessionCounts({ dayBoundary: 'local' })).toEqual([
      { day: '2026-11-15', count: 1 },
    ]);
    expect((await db.sessions.listLightweight())[0].completedLocalDate).toBe('2026-11-15');
    expect((await db.sessions.listProgressProjection(10))[0].completedLocalDate).toBe('2026-11-15');
    const exported = await exportLocalDataBundle(db);
    expect(exported.envelope.data.gameSessions[0].completedLocalDate).toBe('2026-11-15');
    expect(parseAndValidateBackup(exported.text).data.gameSessions[0].completedLocalDate).toBe('2026-11-15');
    await adapter.close();
  });

  it('does not pay a recurring quest again after its session instants move across the local date boundary', async () => {
    const adapter = await createMigratedDb();
    const now = new Date(2026, 10, 16, 0, 50);
    const db = new AppDatabase(adapter, { now: () => now.getTime() });
    const completedAt = new Date(2026, 10, 16, 0, 15).getTime();
    const backup = buildEnvelope({
      ...emptyData(),
      gameSessions: ['a', 'b', 'c'].map((id) => ({
        ...record(id, completedAt), completedLocalDate: '2026-11-15',
      })),
    });
    await applyImport(db, parseAndValidateBackup(serializeBackup(backup)), 'replace');
    for (const definition of QUEST_DEFINITIONS_V1) await db.quests.upsertDefinition(toDbQuestDefinition(definition));
    await db.quests.recordProgress({ questId: qd3.id, period: '2026-11-15', progress: 3, completedAt });
    await applyQuestReward(db, qd3, '2026-11-15', now);
    const before = await db.xpAwards.getTotalAwardedXp();
    await syncQuestProgress(db, now);
    await expect(applyQuestReward(db, qd3, '2026-11-16', now)).rejects.toThrow(/not complete/);
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(before);
    await adapter.close();
  });

  it.each(['0100-06-01', '2011-12-30'])('catches up the recorded civil day %s without rebucketing it in the current zone', async (day) => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);
    const at = day === '0100-06-01' ? Date.UTC(100, 5, 1, 12) : Date.UTC(2011, 11, 30, 12);
    const data = { ...emptyData(), gameSessions: ['a', 'b', 'c'].map((id) => ({ ...record(id, at), completedLocalDate: day })) };
    await applyImport(db, parseAndValidateBackup(serializeBackup(buildEnvelope(data))), 'replace');
    await expect(initializeProgression(db, new Date(2026, 10, 16, 12))).resolves.toBeUndefined();
    const progress = await db.quests.listProgressForPeriod(day);
    expect(progress.find((row) => row.questId === 'qd3')).toMatchObject({ progress: 3, completedAt: at });
    await adapter.close();
  });

  it('includes reward XP in the lifetime-XP quest, not only game-session XP', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter, { now: () => T0 + 1000 });
    for (const definition of QUEST_DEFINITIONS_V1) await db.quests.upsertDefinition(toDbQuestDefinition(definition));
    await db.sessions.completeSession({ session: { ...record('earned-xp'), xp: 50 } });
    await db.xpAwards.award(49_950, 'bonus', 'system');
    await syncQuestProgress(db, new Date(T0 + 2000));
    const progress = await db.quests.listProgressForPeriod('all');
    expect(progress.find((row) => row.questId === 'qt-xp-50000')?.progress).toBe(50_000);
    await adapter.close();
  });

  it('infers legacy completion days once, without rewriting stored instants on migration replay', async () => {
    const adapter = createNodeSqliteAdapter(':memory:');
    await initializeConnection(adapter);
    await runMigrations(adapter, { targetVersion: 13 });
    await adapter.run(
      `INSERT INTO game_sessions (id,game_id,game_version,generator_version,scoring_version,seed,
       difficulty_json,raw_result_json,normalized_result,xp,started_at,completed_at,duration_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['legacy', 'memory', 1, 1, 1, 1, '{}', '{}', 0.5, 10, T0, T0 + 100, 100],
    );
    await runMigrations(adapter);
    const first = await adapter.get<{ completed_at: number; completed_local_date: string }>(
      'SELECT completed_at, completed_local_date FROM game_sessions WHERE id = ?', ['legacy'],
    );
    expect(first?.completed_local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await adapter.exec('PRAGMA user_version = 13');
    await runMigrations(adapter);
    expect(await adapter.get('SELECT completed_at, completed_local_date FROM game_sessions WHERE id = ?', ['legacy'])).toEqual(first);
    expect(first?.completed_at).toBe(T0 + 100);
    await adapter.close();
  });
});

describe('workout provenance matches the physical session game', () => {
  it.each(['explicit', 'embedded', 'launch'] as const)('rejects mismatched %s ownership before completion', async (source) => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);
    const provenance = { instanceKey: '2026-11-16', legIndex: 0, gameId: 'speed-tap-rush' };
    const session = record(`mismatch-${source}`);
    const input = {
      ...session,
      ...(source === 'explicit' ? { workoutProvenance: provenance } : {}),
      ...(source === 'embedded' ? { rawResult: { workoutProvenance: provenance } } : {}),
    };
    if (source === 'launch') registerWorkoutSessionLaunch(session.id, provenance);
    try {
      await expect(db.sessions.completeSession({ session: input })).rejects.toThrow(/provenance|ownership/i);
      expect(await db.sessions.getCount()).toBe(0);
    } finally {
      clearWorkoutSessionLaunch(session.id);
      await adapter.close();
    }
  });
});

describe('supported calendar timestamp boundaries', () => {
  it.each([-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])('rejects unrepresentable session instants %s before import or completion', async (instant) => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);
    const invalid = { ...record('invalid-date'), startedAt: instant, completedAt: instant };
    const text = serializeBackup(buildEnvelope({ ...emptyData(), gameSessions: [invalid] }));
    expect(() => parseAndValidateBackup(text)).toThrow(/invalid|calendar|timestamp/i);
    await expect(db.sessions.completeSession({ session: invalid })).rejects.toThrow(/calendar|timestamp|date/i);
    expect(await db.sessions.getCount()).toBe(0);
    await adapter.close();
  });

  it('does not brick progression when a preexisting corrupt timestamp is encountered', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);
    for (const definition of QUEST_DEFINITIONS_V1) await db.quests.upsertDefinition(toDbQuestDefinition(definition));
    await adapter.run(
      `INSERT INTO game_sessions (id,game_id,game_version,generator_version,scoring_version,seed,
       difficulty_json,raw_result_json,normalized_result,xp,started_at,completed_at,duration_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['old-corruption', 'memory', 1, 1, 1, 1, '{}', '{}', 0.5, 0, -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 0],
    );
    await expect(syncQuestProgress(db, new Date(2026, 10, 16, 12))).resolves.toBeDefined();
    expect(await db.sessions.getDistinctActivityDates()).toEqual([]);
    await adapter.close();
  });
});
