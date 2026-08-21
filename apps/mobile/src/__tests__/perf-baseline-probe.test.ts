/**
 * Performance baseline probes — campaign 009 W13 (OPT-IN).
 *
 * Skipped in normal CI (`PERF_PROBE=1` enables). Run via
 * `node scripts/perf/run-probes.mjs` from the repo root, which executes this
 * spec under jest and writes a JSON baseline into `scripts/perf/baselines/`.
 *
 * These are MEASUREMENTS, not gates: absolute numbers vary by machine. They
 * exist to quantify the W13 audit findings so the parent can prioritize fixes
 * and re-measure after applying them:
 *
 * - F1 `rewards.tsx` / F2 `profile.tsx`: `listRecent(5000)` materializes full
 *   session rows (2× JSON.parse per row) where projection/aggregate reads
 *   would do — measured by listRecent vs listLightweight vs distinct-dates.
 * - F3 `analytics/queries.ts`: Progress snapshot loads EVERY session with
 *   parsed JSON blobs on every tab focus — measured by loadProgressSnapshot.
 * - F4 `data-portability`: backup export canonicalizes the whole envelope
 *   twice (checksum pass + serialize pass), synchronously on the JS thread —
 *   measured by exportLocalData vs serializeBackup.
 */
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';

import type { SQLiteAdapter } from '@/db';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { loadProgressSnapshot } from '@/analytics/queries';
import {
  exportLocalData,
  serializeBackup,
} from '@/data-portability';

const enabled = process.env.PERF_PROBE === '1';
const d = enabled ? describe : describe.skip;

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
  const games = ['memory-grid-recall', 'math-fast-math', 'speed-reaction-time'];
  await adapter.transaction(async (txn) => {
    for (let i = start; i < start + count; i++) {
      await txn.run(insert, [
        `sess-${i}`,
        games[i % games.length],
        1,
        1,
        1,
        1000 + i,
        DIFFICULTY_BLOB,
        RAW_RESULT_BLOB,
        0.4 + ((i % 6) / 10),
        10 + (i % 20),
        i * 1000,
        1_700_000_000_000 + i * 60_000,
        30_000 + (i % 7) * 1000,
      ]);
    }
  });
}

/** Time one async operation (single shot, after caller-side warmup). */
async function measure(fn: () => unknown): Promise<number> {
  const t0 = process.hrtime.bigint();
  await fn();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

d('perf baselines (opt-in via PERF_PROBE=1)', () => {
  it('measures history-read costs at 5k and 20k sessions', async () => {
    const adapter = await createMigratedDb();
    const results: Record<string, unknown> = {
      platform: `${process.platform} node ${process.version}`,
      measuredAt: new Date().toISOString(),
      scenarios: {} as Record<string, number>,
    };
    const scenarios = results.scenarios as Record<string, number>;

    for (const n of [5_000, 20_000]) {
      await seedSessions(adapter, n === 5_000 ? n : n - 5_000, n === 5_000 ? 0 : 5_000);
      const db = new AppDatabase(adapter);

      // Warmup + sanity.
      expect((await db.sessions.listRecent(10)).length).toBe(10);

      scenarios[`listRecent_${n}_full_rows_ms`] = await measure(() =>
        db.sessions.listRecent(n),
      );
      scenarios[`listLightweight_${n}_projection_ms`] = await measure(() =>
        db.sessions.listLightweight(n),
      );
      scenarios[`getDistinctActivityDates_${n}_ms`] = await measure(() =>
        db.sessions.getDistinctActivityDates(),
      );
      scenarios[`loadProgressSnapshot_${n}_ms`] = await measure(() =>
        loadProgressSnapshot(db),
      );
    }

    // F4: export double-canonicalization at 5k sessions.
    const db = new AppDatabase(adapter);
    let envelope!: Awaited<ReturnType<typeof exportLocalData>>;
    scenarios[`exportLocalData_5000_incl_checksum_canonical_ms`] = await measure(
      async () => {
        envelope = await exportLocalData(db);
      },
    );
    scenarios[`serializeBackup_5000_second_canonical_ms`] = await measure(() =>
      serializeBackup(envelope),
    );

    console.log(`PERF_BASELINE_JSON:${JSON.stringify(results)}`);

    if (process.env.PERF_OUT) {
      fs.writeFileSync(process.env.PERF_OUT, JSON.stringify(results, null, 2));
    }

    // Soft sanity only — never a timing gate.
    expect(scenarios['listRecent_20000_full_rows_ms']).toBeGreaterThan(0);
  }, 300_000);
});
