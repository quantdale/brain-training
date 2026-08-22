/**
 * Large-backup memory behavior (campaign 011, packet W12 §19).
 *
 * OPT-IN measurement — skipped in normal CI (`LARGE_BACKUP_PROBE=1` enables),
 * mirroring `src/__tests__/perf-baseline-probe.test.ts` conventions: these are
 * MEASUREMENTS plus structural gates, not timing gates.
 *
 * What it pins:
 *   - a 20k-session envelope still verifies end-to-end (checksum + validation);
 *   - the streaming chunk stream joins to exactly the canonical text;
 *   - the single-pass bundle text is byte-identical to the legacy writer;
 *   - measured peak-adjacent numbers (heap/RSS deltas, text bytes, chunks) are
 *     logged as one JSON line for the campaign packet ("measure, don't guess").
 *
 * Run: `NODE_OPTIONS=--expose-gc npx jest src/data-portability/__tests__/large-backup-memory.test.ts --maxWorkers=1`
 * (with --expose-gc, heapUsed deltas are post-GC and therefore meaningful;
 * without it they are reported but flagged as uncontrolled-GC).
 */
import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter } from '@/db';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { exportLocalDataBundle } from '../serialize';
import { serializeBackup, parseAndValidateBackup } from '../index';
import { serializeEnvelopeWithChecksum, buildBackupManifest } from '../serialize';
import { T0 } from './helpers';

const enabled = process.env.LARGE_BACKUP_PROBE === '1';
const d = enabled ? describe : describe.skip;

const N_SESSIONS = 20_000;

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

async function seedSessions(adapter: SQLiteAdapter, count: number): Promise<void> {
  const insert =
    `INSERT INTO game_sessions (
      id, game_id, game_version, generator_version, scoring_version, seed,
      difficulty_json, raw_result_json, normalized_result, xp,
      started_at, completed_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const ledgerInsert =
    `INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id)
     VALUES (?, ?, ?, ?, ?)`;
  const games = ['memory-grid-recall', 'math-fast-math', 'speed-reaction-time'];
  await adapter.transaction(async (txn) => {
    for (let i = 0; i < count; i++) {
      const startedAt = T0 + i * 60_000;
      const completedAt = startedAt + 95_000;
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
        startedAt,
        completedAt,
        30_000 + (i % 7) * 1000,
      ]);
      await txn.run(ledgerInsert, [
        10 + (i % 20),
        'gameplay',
        `sess-${i}`,
        completedAt,
        `gameplay:sess-${i}`,
      ]);
    }
  });
}

interface GcCapableGlobal {
  gc?: () => void;
}

function measureMemory(): { heapUsed: number; rss: number; postGc: boolean } {
  const g = globalThis as GcCapableGlobal;
  if (typeof g.gc === 'function') {
    g.gc();
    return { heapUsed: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss, postGc: true };
  }
  return { heapUsed: process.memoryUsage().heapUsed, rss: process.memoryUsage().rss, postGc: false };
}

d('20k-session large-backup behavior', () => {
  it(
    'verifies at scale and reports measured footprint',
    async () => {
      const adapter = await createMigratedDb();
      const db = new AppDatabase(adapter);

      const seedStart = Date.now();
      await seedSessions(adapter, N_SESSIONS);
      const seedMs = Date.now() - seedStart;

      // Structural gate independent of GC noise: manifest counts match reality.
      const memBefore = measureMemory();

      const t0 = Date.now();
      const { envelope, text } = await exportLocalDataBundle(db);
      const exportMs = Date.now() - t0;

      // Chunk-granularity evidence for the bounded-peak claim: the single-pass
      // writer streams many small chunks rather than one monolithic string.
      const { checksum, chunks: writerChunks } = serializeEnvelopeWithChecksum(
        envelope as unknown as Parameters<typeof serializeEnvelopeWithChecksum>[0],
      );

      const memAfter = measureMemory();

      const legacyText = serializeBackup(envelope); // two-pass writer reference
      const parsed = parseAndValidateBackup(text);

      const report = {
        sessions: N_SESSIONS,
        seedMs,
        exportMs,
        textUtf16Units: text.length,
        approximateTextBytes: Buffer.byteLength(text, 'utf8'),
        chunkCount: writerChunks.length,
        heapUsedDeltaMb: Math.round(((memAfter.heapUsed - memBefore.heapUsed) / 1048576) * 10) / 10,
        rssDeltaMb: Math.round(((memAfter.rss - memBefore.rss) / 1048576) * 10) / 10,
        postGcHeap: memBefore.postGc && memAfter.postGc,
        node: process.version,
      };
      console.log(`LARGE_BACKUP_MEMORY_JSON:${JSON.stringify(report)}`);

      // Deterministic correctness gates at scale (never timing-based):
      expect(parsed.data.gameSessions).toHaveLength(N_SESSIONS);
      expect(parsed.envelope.checksum).toBe(envelope.checksum);
      expect(checksum).toBe(envelope.checksum); // writer reproduces the digest
      expect(writerChunks.join('')).toBe(text); // streamed chunks ARE the text
      expect(text).toBe(legacyText); // single-pass == legacy two-pass bytes
      expect(envelope.manifest?.totalRecords ?? 0).toBeGreaterThanOrEqual(N_SESSIONS * 2);
      expect(buildBackupManifest(parsed.data).sections.gameSessions).toBe(N_SESSIONS);
    },
    300_000,
  );
});
