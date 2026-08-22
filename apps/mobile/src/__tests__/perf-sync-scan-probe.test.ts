/**
 * Sync-path performance probes — campaign 012 W13 (OPT-IN).
 *
 * Skipped in normal CI (`PERF_PROBE=1` enables). Run from apps/mobile:
 *
 *   PERF_PROBE=1 npx jest src/__tests__/perf-sync-scan-probe.test.ts --runInBand
 *
 * Measures the progression sync scan surfaces (`progression/sync.ts`) at
 * realistic (100) and stress (1k / 5k / 20k) history sizes:
 *
 * - `buildQuestSamples` — the projection read behind quest evaluation
 *   (bounded by SYNC_SESSION_SCAN_LIMIT = 5000).
 * - `evaluateQuests` — pure in-memory filter/reduce over the samples.
 * - `syncQuestProgress` — end-to-end incl. monotonic-MAX progress writes.
 * - `buildAchievementSnapshot` — the SQL-aggregate snapshot.
 * - `syncAchievements` — snapshot + INSERT OR IGNORE unlocks.
 * - `getDistinctActivityDates` — the streak input inside the snapshot.
 *
 * These are MEASUREMENTS, not gates: absolute numbers vary by machine.
 * Compare baselines from the SAME machine only. Results print as a
 * `PERF_SYNC_JSON:{...}` line for capture into scripts/perf/baselines/.
 */
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';

import type { SQLiteAdapter } from '@/db';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  buildAchievementSnapshot,
  buildQuestSamples,
  syncAchievements,
  syncQuestProgress,
} from '@/progression/sync';
import {
  evaluateQuests,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
  toDbQuestDefinition,
} from '@/quests';
import { toDbAchievementDefinition, ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';

const enabled = process.env.PERF_PROBE === '1';
const d = enabled ? describe : describe.skip;

const SIZES = [100, 1_000, 5_000, 20_000] as const;
/** Fixed clock for evaluation so period membership is stable across sizes. */
const NOW = new Date('2026-08-21T12:00:00');

/** Realistic blob sizes: difficulty ~150B, rawResult ~450B of JSON. */
const DIFFICULTY_BLOB = JSON.stringify({
  level: 'normal',
  rounds: 5,
  gridSize: 16,
  targetCells: 4,
  studyMs: 1800,
});
const RAW_RESULT_BLOB = JSON.stringify({
  schemaVersion: 1,
  gameVersion: 1,
  generatorVersion: 1,
  scoringVersion: 1,
  difficulty: 'normal',
  seed: '123456789',
  stats: {
    score: 320,
    roundsPlayed: 5,
    roundsPassed: 4,
    bestRecall: 4,
    bestStreak: 3,
    wrongTaps: 2,
    tapsByIndex: [11, 4, 7, 9],
  },
  timing: { startedAtMs: 0, activeDurationMs: 95000, pausedDurationMs: 1200 },
});

/** Games spanning several domains so domain filters do real work. */
const GAMES = [
  'memory-grid-recall',
  'math-fast-math',
  'speed-reaction-time',
  'attention-visual-search',
];

async function seedSessions(
  adapter: SQLiteAdapter,
  count: number,
  start: number,
): Promise<void> {
  const insert = `INSERT INTO game_sessions (
      id, game_id, game_version, generator_version, scoring_version, seed,
      difficulty_json, raw_result_json, normalized_result, xp,
      started_at, completed_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  // One minute apart ending at NOW: a realistic spread where a small slice
  // falls in today's daily period and this ISO week (quest period filters).
  const endMs = NOW.getTime();
  await adapter.transaction(async (txn) => {
    for (let i = start; i < start + count; i++) {
      const completedAt = endMs - (start + count - 1 - i) * 60_000;
      await txn.run(insert, [
        `sess-${i}`,
        GAMES[i % GAMES.length],
        1,
        1,
        1,
        1000 + i,
        DIFFICULTY_BLOB,
        RAW_RESULT_BLOB,
        0.4 + ((i % 6) / 10),
        10 + (i % 20),
        completedAt - 95_000,
        completedAt,
        30_000 + (i % 7) * 1000,
      ]);
    }
  });
}

/**
 * Time one operation as the MIN of 3 runs. All probed operations are
 * idempotent (monotonic-MAX upserts / INSERT OR IGNORE / pure reads), so
 * repeating them is safe; min-of-3 filters scheduler/GC spikes that otherwise
 * swamp sub-100ms single shots.
 */
async function measure(fn: () => unknown): Promise<number> {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms < best) {
      best = ms;
    }
  }
  return best;
}

d('perf sync scans (opt-in via PERF_PROBE=1)', () => {
  it('measures quest/achievement sync costs at 100 / 1k / 5k / 20k sessions', async () => {
    const adapter = await createMigratedDb();
    const bootstrap = new AppDatabase(adapter);
    // Seed versioned definitions first: quest_progress.quest_id has a FK to
    // quests.id, and achievement unlocks reference their definition row —
    // same as production `initializeProgression`.
    for (const definition of QUEST_DEFINITIONS_V1) {
      await bootstrap.quests.upsertDefinition(toDbQuestDefinition(definition));
    }
    for (const definition of ACHIEVEMENT_DEFINITIONS_V1) {
      await bootstrap.achievements.upsertDefinition(
        toDbAchievementDefinition(definition),
      );
    }
    const results: Record<string, unknown> = {
      platform: `${process.platform} node ${process.version}`,
      measuredAt: new Date().toISOString(),
      scenarios: {} as Record<string, number>,
    };
    const scenarios = results.scenarios as Record<string, number>;

    let seeded = 0;
    let db!: AppDatabase;
    for (const n of SIZES) {
      await seedSessions(adapter, n - seeded, seeded);
      seeded = n;
      db = new AppDatabase(adapter);

      // Warmup + sanity.
      expect((await buildQuestSamples(db)).length).toBe(Math.min(n, 5000));
      const active = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW);
      expect(active.length).toBeGreaterThan(0);

      scenarios[`buildQuestSamples_${n}_ms`] = await measure(() =>
        buildQuestSamples(db),
      );
      const samples = await buildQuestSamples(db);
      scenarios[`evaluateQuests_${n}_inmemory_ms`] = await measure(() =>
        evaluateQuests(active, { sessions: samples }, NOW),
      );
      // NOTE (W13): a single-pass partitioned variant was explored and REJECTED
      // on measured evidence — see src/__tests__/perf-quest-eval-ab.test.ts and
      // scripts/perf/baselines/sync-scan-baselines.md.
      scenarios[`syncQuestProgress_${n}_total_ms`] = await measure(() =>
        syncQuestProgress(db, NOW),
      );
      scenarios[`buildAchievementSnapshot_${n}_ms`] = await measure(() =>
        buildAchievementSnapshot(db, NOW),
      );
      scenarios[`syncAchievements_${n}_total_ms`] = await measure(() =>
        syncAchievements(db, NOW),
      );
      scenarios[`getDistinctActivityDates_${n}_ms`] = await measure(() =>
        db.sessions.getDistinctActivityDates(),
      );
    }

    console.log(`PERF_SYNC_JSON:${JSON.stringify(results)}`);

    if (process.env.PERF_OUT) {
      fs.writeFileSync(process.env.PERF_OUT, JSON.stringify(results, null, 2));
    }

    // Soft sanity only — never a timing gate.
    expect(scenarios['syncQuestProgress_20000_total_ms']).toBeGreaterThan(0);
  }, 600_000);
});
