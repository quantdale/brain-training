/**
 * Quest evaluation A/B probe — campaign 012 W13 (OPT-IN).
 *
 * Skipped unless PERF_PROBE=1:
 *   PERF_PROBE=1 npx jest src/__tests__/perf-quest-eval-ab.test.ts --runInBand
 *
 * Times the REAL quest-evaluation paths over an in-memory sample array (no DB
 * involved) so their relative cost is compared within ONE quiet process,
 * min-of-5 after explicit JIT warmup:
 *
 * - `engineScan`: `evaluateQuests(active, { sessions })` — the untouched
 *   quests-engine entry point (per-definition full scans).
 * - `partitioned`: `evaluateActiveQuestsByPeriod` (progression/sync) — the
 *   single period-key pass variant.
 * - `keysOnly`: just the per-sample day+week key computation — the floor for
 *   any single-pass approach.
 *
 * Measurements, not gates. Prints PERF_QUEST_AB_JSON for capture.
 */
import { describe, expect, it } from '@jest/globals';

import {
  currentPeriodKey,
  evaluateQuest,
  evaluateQuests,
  isoWeekKey,
  localDateKey,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
  type QuestDefinition,
  type QuestEvaluation,
  type QuestKind,
  type QuestSessionSample,
} from '@/quests';

const enabled = process.env.PERF_PROBE === '1';
const d = enabled ? describe : describe.skip;

const NOW = new Date(2026, 7, 21, 12, 0, 0);
const N = 5000;

/**
 * Local replica of the single-pass partition variant explored in W13: one
 * period-key pass over the samples, then per-definition evaluation against
 * pre-filtered buckets. Kept HERE (not in production code) because measured
 * evidence rejected it for `progression/sync.ts` under this project's
 * babel/jest toolchain — see `scripts/perf/baselines/sync-scan-baselines.md`.
 */
function partitionedByPeriod(
  definitions: readonly QuestDefinition[],
  samples: readonly QuestSessionSample[],
  now: Date,
): QuestEvaluation[] {
  const todayKey = currentPeriodKey('daily', now);
  const weekKey = currentPeriodKey('weekly', now);
  const todays: QuestSessionSample[] = [];
  const weeks: QuestSessionSample[] = [];
  for (const sample of samples) {
    const date = new Date(sample.completedAt);
    if (localDateKey(date) === todayKey) {
      todays.push(sample);
    }
    if (isoWeekKey(date) === weekKey) {
      weeks.push(sample);
    }
  }
  const buckets: Record<QuestKind, QuestSessionSample[]> = {
    daily: todays,
    weekly: weeks,
    longterm: [...samples],
  };
  return definitions.map((definition) =>
    evaluateQuest(definition, { sessions: buckets[definition.kind] }, now),
  );
}

function timeMinOf(fn: () => unknown, reps = 5, warmup = 3): number {
  for (let i = 0; i < warmup; i++) {
    fn();
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms < best) {
      best = ms;
    }
  }
  return best;
}

d('perf quest eval A/B (opt-in via PERF_PROBE=1)', () => {
  it('compares engine scan vs partitioned single pass in-process', () => {
    const active = selectActiveQuests(QUEST_DEFINITIONS_V1, NOW);
    expect(active.length).toBeGreaterThan(0);

    // Same spread as perf-sync-scan-probe: one minute apart ending at NOW.
    const samples: QuestSessionSample[] = [];
    for (let i = 0; i < N; i++) {
      samples.push({
        completedAt: NOW.getTime() - (N - 1 - i) * 60_000,
        gameId: 'memory-grid-recall',
        domain: 'Memory',
        xp: 10 + (i % 20),
      });
    }

    const todayKey = localDateKey(NOW);
    const weekKey = isoWeekKey(NOW);
    const engine = () => evaluateQuests(active, { sessions: samples }, NOW);
    const partitioned = () => partitionedByPeriod(active, samples, NOW);

    // Run BOTH orders plus an interleaved series: single-order timings can be
    // polluted by JIT state and heap/GC debt left by whichever path ran first.
    const results = {
      platform: `${process.platform} node ${process.version}`,
      measuredAt: new Date().toISOString(),
      activeQuests: active.length,
      engineFirst_ms: timeMinOf(engine),
      partitionedAfterEngine_ms: timeMinOf(() => partitionedByPeriod(active, samples, NOW)),
      partitionedFirst_ms: timeMinOf(() => partitionedByPeriod(active, samples, NOW)),
      engineAfterPartitioned_ms: timeMinOf(engine),
      interleavedEngine_ms: (() => {
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i < 9; i++) {
          const t0 = process.hrtime.bigint();
          engine();
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          partitioned(); // keep heap/JIT pressure symmetric between samples
          if (ms < best) {
            best = ms;
          }
        }
        return best;
      })(),
      interleavedPartitioned_ms: (() => {
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i < 9; i++) {
          engine(); // symmetric pressure
          const t0 = process.hrtime.bigint();
          partitioned();
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          if (ms < best) {
            best = ms;
          }
        }
        return best;
      })(),
      keysOnlySinglePass_ms: timeMinOf(() => {
        let days = 0;
        let weeks = 0;
        for (const sample of samples) {
          const date = new Date(sample.completedAt);
          if (localDateKey(date) === todayKey) {
            days++;
          }
          if (isoWeekKey(date) === weekKey) {
            weeks++;
          }
        }
        return days + weeks;
      }),
    };

    console.log(`PERF_QUEST_AB_JSON:${JSON.stringify(results)}`);

    expect(results.engineFirst_ms).toBeGreaterThan(0);
    expect(results.partitionedFirst_ms).toBeGreaterThan(0);
    expect(results.interleavedEngine_ms).toBeGreaterThan(0);
  }, 120_000);
});
