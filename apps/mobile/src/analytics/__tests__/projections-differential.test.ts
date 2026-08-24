/**
 * W10 differential-equivalence suite (campaign 011).
 *
 * Proves the JSON1 projection paths return byte-identical business results to
 * the legacy full-row reference reads, over seeded randomized fixtures
 * (1k/5k/20k sessions) plus a fixed adversarial row set:
 *
 * - malformed JSON (`json_valid=0`), valid-but-non-object docs (`null`,
 *   arrays, bare strings, numbers), NULL metrics, wrong-typed metrics,
 *   old-version field shapes (`points`/`hitRate`/`fastestReactionMs`),
 *   extractor-invisible nested blobs (`stats.score`), duplicate timestamps,
 *   same-millisecond completions.
 *
 * Matrix legs per fixture:
 * 1. JSON1 available (repository fast path) vs legacy full-row reads.
 * 2. Repository primitive forced unavailable → `db.transaction()` seam path.
 * 3. JSON1 forced unavailable (probe override) → legacy full-row fallback via
 *    `loadProgressSnapshot` / `loadGameSessions`.
 *
 * Equivalence is asserted at three levels:
 * - per row: scalar columns + the four shared `metrics-map` extractions,
 *   aligned by id AND element-wise order (pins ordering stability under equal
 *   `completed_at` keys between the two SQL statements);
 * - aggregates: representative Progress V2 pure analytics (accuracy trend,
 *   difficulty progression, session volume, score personal bests, training
 *   balance) computed from both arrays must match exactly;
 * - snapshot: `loadProgressSnapshot` on every leg equals the explicitly
 *   legacy-built snapshot.
 *
 * Boundary contracts (pagination keyset edges, inclusive window bounds,
 * aggregate-pushdown and daily-count differentials, EXPLAIN QUERY PLAN index
 * usage) live in the lower describes with small deterministic databases.
 *
 * Everything here is deterministic: fixed PRNG seeds, no clocks, no retries.
 */
import { describe, expect, it } from '@jest/globals';

import type {
  GameSessionRecord,
  SessionCursor,
  SessionFilterQuery,
  SQLiteAdapter,
  SQLiteValue,
} from '@/db';
import { AppDatabase, isValidSessionCursor } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  PROJECTED_SESSIONS_ALL_SQL,
  PROJECTED_SESSIONS_BY_GAME_SQL,
  sessionRecordFromProjection,
  tryLoadProjectedSessionRows,
} from '../projections';
import { ALL_SESSIONS_LIMIT, loadGameSessions, loadProgressSnapshot } from '../queries';
import {
  extractAccuracy,
  extractDifficultyRating,
  extractReactionMs,
  extractScore,
} from '../metrics-map';
import { buildAccuracyTrend } from '../metric-trends';
import { buildDifficultyProgression } from '../difficulty-progression';
import { buildSessionVolume } from '../volume-view';
import { buildScoreBestHistory } from '../personal-best';
import { buildTrainingBalance } from '../training-balance';
import { DIFFICULTY_LEVELS } from '@/sdk';

// ---------------------------------------------------------------------------
// Seeded PRNG + fixture generator
// ---------------------------------------------------------------------------

/** mulberry32 — tiny seeded PRNG; identical sequence for identical seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rnd = () => number;

const randInt = (rnd: Rnd, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1));

const pick = <T>(rnd: Rnd, items: readonly T[]): T =>
  items[Math.floor(rnd() * items.length)];

const GAMES = [
  'memory-grid-recall',
  'math-fast-math',
  'speed-reaction-time',
  'language-word-match',
  'logic-number-sequence',
] as const;

const GAME_DOMAINS: Record<string, string | null> = {
  'memory-grid-recall': 'Memory',
  'math-fast-math': 'Math',
  'speed-reaction-time': 'Speed',
  'language-word-match': 'Language',
  'logic-number-sequence': 'Logic',
};

const KNOWN_LEVELS = DIFFICULTY_LEVELS as readonly string[];

/** One raw session row exactly as it lands in `game_sessions`. */
interface FixtureRow {
  id: string;
  gameId: string;
  gameVersion: number;
  generatorVersion: number;
  scoringVersion: number;
  seed: number;
  difficultyJson: string;
  rawResultJson: string;
  normalizedResult: number;
  xp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

/**
 * Fixed adversarial rows (always present, independent of the RNG): each class
 * from the W10 adversarial matrix appears at least once. Ids sort apart from
 * the random rows so alignment failures are immediately attributable.
 */
function adversarialRows(baseMs: number): FixtureRow[] {
  const doc = (
    gameId: string,
    difficultyJson: string,
    rawResultJson: string,
    i: number,
  ): FixtureRow => ({
    id: `adv-${String(i).padStart(2, '0')}`,
    gameId,
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1000 + i,
    difficultyJson,
    rawResultJson,
    normalizedResult: 0.5,
    xp: 10,
    startedAt: baseMs + i * 60_000 - 60_000,
    completedAt: baseMs + i * 60_000,
    durationMs: 60_000,
  });

  return [
    // Malformed JSON on either blob (json_valid=0 → nulls, never an error).
    doc('memory-grid-recall', '{"level":"hard"}', '{"score": 12', 1),
    doc('memory-grid-recall', '{"level":', '{"score": 12}', 2),
    // Valid JSON but not objects.
    doc('memory-grid-recall', 'null', 'null', 3),
    doc('math-fast-math', '"hard"', '"just a string"', 4),
    doc('math-fast-math', '[1,2,3]', '[{"score":9}]', 5),
    doc('math-fast-math', '123', '45.75', 6),
    // Empty blobs (json_valid('')=0; JSON.parse throws → null).
    doc('speed-reaction-time', '', '', 7),
    // NULL / wrong-typed metric values inside otherwise valid objects.
    doc('speed-reaction-time', '{"challengeRating":null}', '{"score":null,"accuracy":null}', 8),
    doc('speed-reaction-time', '{}', '{"score":"320","accuracy":true,"avgResponseMs":[120]}', 9),
    // Old-version shapes: legacy field names the extractors must still find.
    doc('language-word-match', '"easy"', '{"points":42,"hitRate":0.6,"fastestReactionMs":300}', 10),
    doc('language-word-match', '{"level":"impossible"}', '{"totalScore":7,"precision":1.5,"medianReactionMs":480}', 11),
    // Extractor-invisible nested shapes (stats.score is NOT read by metrics-map).
    doc('logic-number-sequence', '{"level":"normal","rounds":5}', '{"stats":{"score":999},"timing":{"activeDurationMs":100}}', 12),
    // Out-of-range numerics: stored unclamped; the shared extractor clamps.
    doc('logic-number-sequence', '{"challengeRating":1.7}', '{"accuracy":2.5,"score":-10}', 13),
    // Same-millisecond completions with ids whose lexicographic order differs
    // from insertion order (tie-break stress).
    { ...doc('memory-grid-recall', '"hard"', '{"score":1}', 15), id: 'adv-z-last' },
    { ...doc('memory-grid-recall', '"hard"', '{"score":2}', 15), id: 'adv-a-first' },
    { ...doc('math-fast-math', '"easy"', '{"score":3}', 15), id: 'adv-m-mid' },
  ];
}

/**
 * Build a deterministic fixture of `count` randomized rows plus the fixed
 * adversarial prefix. Duplicate-timestamp clusters appear every ~97 rows
 * (same-ms completions inserted alongside ordinary traffic).
 */
function buildFixture(count: number, rngSeed: number): FixtureRow[] {
  const rnd = mulberry32(rngSeed);
  const baseMs = Date.UTC(2026, 0, 1, 12, 0, 0);
  const rows: FixtureRow[] = [...adversarialRows(baseMs)];

  const versions = [1, 2, 3];

  const rawDoc = (): string => {
    switch (randInt(rnd, 0, 11)) {
      case 0: { // modern shape, fields randomly present
        const fields: string[] = ['"score":320'];
        if (rnd() < 0.7) fields.push('"accuracy":0.87');
        if (rnd() < 0.5) fields.push('"avgResponseMs":412');
        return `{${fields.join(',')}}`;
      }
      case 1: // legacy names
        return '{"points":42,"hitRate":0.6}';
      case 2: // other legacy names
        return '{"totalScore":77,"precision":0.55,"bestReactionMs":210}';
      case 3: // nested (extractor-invisible)
        return '{"schemaVersion":1,"stats":{"score":320},"timing":{"activeDurationMs":95000}}';
      case 4:
        return '{"score":null,"avgResponseMs":null}';
      case 5:
        return '{"score":"320","accuracy":false}';
      case 6:
        return '{}';
      case 7:
        return '[]';
      case 8:
        return 'null';
      case 9:
        return ''; // empty blob
      case 10:
        return '{"score": 12'; // truncated / malformed
      default:
        return `{"score":${randInt(rnd, 0, 5000)},"avgResponseMs":${randInt(rnd, 180, 1400)}}`;
    }
  };

  const difficultyDoc = (): string => {
    switch (randInt(rnd, 0, 7)) {
      case 0:
        return `{"level":"${pick(rnd, KNOWN_LEVELS)}","rounds":5}`;
      case 1:
        return `{"challengeRating":${(rnd() * 1.4 - 0.2).toFixed(3)}}`;
      case 2:
        return `"${pick(rnd, KNOWN_LEVELS)}"`; // bare-string form
      case 3:
        return '{"level":"impossible"}'; // unknown level string
      case 4:
        return '{}';
      case 5:
        return 'null';
      case 6:
        return '{"level":'; // malformed
      default:
        return `"${pick(rnd, KNOWN_LEVELS)}"`;
    }
  };

  for (let i = 0; i < count; i++) {
    const durationMs = randInt(rnd, 15_000, 180_000);
    const completedAt = baseMs + i * 60_000 + randInt(rnd, -30_000, 30_000);

    // Duplicate-timestamp cluster: five rows share one completion ms.
    if (i % 97 === 0 && i + 5 <= count) {
      const clusterCompleted = baseMs + 5_000_000 + i;
      for (let k = 0; k < 5; k++) {
        const d = randInt(rnd, 15_000, 180_000);
        rows.push({
          id: `c-${String(i).padStart(6, '0')}-${String(k).padStart(2, '0')}`,
          gameId: pick(rnd, GAMES),
          gameVersion: pick(rnd, versions),
          generatorVersion: 2,
          scoringVersion: pick(rnd, versions),
          seed: 900_000 + i * 10 + k,
          difficultyJson: difficultyDoc(),
          rawResultJson: rawDoc(),
          normalizedResult: Number(rnd().toFixed(4)),
          xp: randInt(rnd, 0, 120),
          startedAt: clusterCompleted - d,
          completedAt: clusterCompleted,
          durationMs: d,
        });
      }
      continue;
    }

    rows.push({
      id: `s-${String(i).padStart(8, '0')}`,
      gameId: pick(rnd, GAMES),
      gameVersion: pick(rnd, versions),
      generatorVersion: 2,
      scoringVersion: pick(rnd, versions),
      seed: 700_000 + i,
      difficultyJson: difficultyDoc(),
      rawResultJson: rawDoc(),
      normalizedResult: Number(rnd().toFixed(4)),
      xp: randInt(rnd, 0, 120),
      startedAt: completedAt - durationMs,
      completedAt,
      durationMs,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Insertion + comparison helpers
// ---------------------------------------------------------------------------

const INSERT_SESSION = `INSERT INTO game_sessions (
    id, game_id, game_version, generator_version, scoring_version, seed,
    difficulty_json, raw_result_json, normalized_result, xp,
    started_at, completed_at, duration_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

async function insertRows(adapter: SQLiteAdapter, rows: readonly FixtureRow[]): Promise<void> {
  await adapter.transaction(async (txn) => {
    for (const r of rows) {
      await txn.run(INSERT_SESSION, [
        r.id,
        r.gameId,
        r.gameVersion,
        r.generatorVersion,
        r.scoringVersion,
        r.seed,
        r.difficultyJson,
        r.rawResultJson,
        r.normalizedResult,
        r.xp,
        r.startedAt,
        r.completedAt,
        r.durationMs,
      ]);
    }
  });
}

/** The business-visible view of one session: scalars + shared extractions. */
interface MetricView {
  id: string;
  gameId: string;
  gameVersion: number;
  generatorVersion: number;
  scoringVersion: number;
  seed: number;
  normalizedResult: number;
  xp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  score: number | null;
  accuracy: number | null;
  reactionMs: number | null;
  difficultyRating: number | null;
}

function metricView(rec: GameSessionRecord): MetricView {
  return {
    id: rec.id,
    gameId: rec.gameId,
    gameVersion: rec.gameVersion,
    generatorVersion: rec.generatorVersion,
    scoringVersion: rec.scoringVersion,
    seed: rec.seed,
    normalizedResult: rec.normalizedResult,
    xp: rec.xp,
    startedAt: rec.startedAt,
    completedAt: rec.completedAt,
    durationMs: rec.durationMs,
    score: extractScore(rec.rawResult),
    accuracy: extractAccuracy(rec.rawResult),
    reactionMs: extractReactionMs(rec.rawResult),
    difficultyRating: extractDifficultyRating(rec.difficulty),
  };
}

function views(records: readonly GameSessionRecord[]): MetricView[] {
  return records.map(metricView);
}

/** Compare two view arrays element-wise; fail with the first divergent row. */
function expectViewsIdentical(fast: MetricView[], legacy: MetricView[], label: string): void {
  expect(fast.length).toBe(legacy.length);
  for (let i = 0; i < fast.length; i++) {
    if (JSON.stringify(fast[i]) !== JSON.stringify(legacy[i])) {
      throw new Error(
        `${label}: divergence at index ${i}\n  projection: ${JSON.stringify(fast[i])}\n` +
          `  legacy:     ${JSON.stringify(legacy[i])}`,
      );
    }
  }
}

/**
 * Adapter wrapper forcing projection-path availability states without
 * touching production code:
 * - `breakRepositoryOnce`: first projected SELECT throws (→ transaction seam);
 * - `breakRepositoryAlways`: every projected SELECT throws;
 * - `breakJsonProbe`: the `SELECT json_valid('{}')` probe throws (the seam
 *   then reports JSON1 unavailable → loaders fall back to full-row reads).
 */
function withBreakers(
  adapter: SQLiteAdapter,
  opts: { breakRepositoryOnce?: boolean; breakRepositoryAlways?: boolean; breakJsonProbe?: boolean },
): SQLiteAdapter {
  // Shared across the outer adapter AND every transaction-scoped adapter it
  // hands out: better-sqlite3's transaction() passes its own raw connection
  // to the callback, so without re-wrapping, the fallback seam (and its
  // json_valid probe) would silently bypass these breakers.
  const state = { brokenOnce: false };
  const isProjectedSql = (sql: string): boolean =>
    sql.includes('FROM game_sessions') && sql.includes('json_type(');
  const wrap = (target: SQLiteAdapter): SQLiteAdapter => ({
    async exec(sql) {
      return target.exec(sql);
    },
    async run(sql, params) {
      return target.run(sql, params);
    },
    async get(sql: string, params?: SQLiteValue[]) {
      if (opts.breakJsonProbe && /json_valid\('\{\}'\)/.test(sql)) {
        throw new Error('forced: JSON1 unavailable');
      }
      return target.get(sql, params);
    },
    async all(sql: string, params?: SQLiteValue[]) {
      if (
        isProjectedSql(sql) &&
        (opts.breakRepositoryAlways || (opts.breakRepositoryOnce && !state.brokenOnce))
      ) {
        state.brokenOnce = true;
        throw new Error('forced: repository projection primitive unavailable');
      }
      return target.all(sql, params);
    },
    transaction: (fn) => target.transaction((txn) => fn(wrap(txn))),
    close: () => target.close(),
  });
  return wrap(adapter);
}

/** Explicitly legacy-built snapshot (what the loaders must reproduce). */
async function buildLegacySnapshot(adapter: SQLiteAdapter): Promise<{
  ratings: unknown;
  ratingHistory: unknown;
  sessions: GameSessionRecord[];
  aggregates: unknown;
  totalXp: number;
  balance: number;
}> {
  const app = new AppDatabase(adapter);
  return {
    ratings: await app.ratings.getRatings(),
    ratingHistory: await app.ratings.getHistory(ALL_SESSIONS_LIMIT),
    sessions: await app.sessions.listRecent(ALL_SESSIONS_LIMIT),
    aggregates: await app.sessions.getAggregates(),
    totalXp: await app.sessions.getTotalXp(),
    balance: await app.ledger.getBalance(),
  };
}

/** Compare snapshots: non-session fields deeply; sessions via metric views. */
function expectSnapshotsIdentical(
  actual: Awaited<ReturnType<typeof loadProgressSnapshot>>,
  legacy: Awaited<ReturnType<typeof buildLegacySnapshot>>,
  label: string,
): void {
  expect(actual.ratings).toEqual(legacy.ratings);
  expect(actual.ratingHistory).toEqual(legacy.ratingHistory);
  expect(actual.aggregates).toEqual(legacy.aggregates);
  expect(actual.totalXp).toBe(legacy.totalXp);
  expect(actual.balance).toBe(legacy.balance);
  expect(actual.sessions.map((s) => s.id)).toEqual(legacy.sessions.map((s) => s.id));
  expectViewsIdentical(
    views(actual.sessions),
    views(legacy.sessions),
    `${label} snapshot sessions`,
  );
}

// ---------------------------------------------------------------------------
// Differential matrix over seeded fixtures
// ---------------------------------------------------------------------------

describe.each([
  [1_000, 0xa110],
  [5_000, 0x5e00],
  [20_000, 0x20d0],
])('differential equivalence @%i sessions (projection vs legacy)', (count, rngSeed) => {
  it(
    'returns identical rows, order, extracted metrics and analytics on every path',
    async () => {
      const adapter = await createMigratedDb();
      const rows = buildFixture(count, rngSeed);
      await insertRows(adapter, rows);

      // --- Leg 1: repository fast path (JSON1 available) -------------------
      const db = new AppDatabase(adapter);
      const fastRows = await tryLoadProjectedSessionRows(db, null, ALL_SESSIONS_LIMIT);
      // A silent fallback would be a perf regression, not a correctness one:
      // the fast path must actually engage on a healthy database.
      expect(fastRows).not.toBeNull();
      const legacyAll = await db.sessions.listRecent(ALL_SESSIONS_LIMIT);
      const fastRecords = fastRows!.map(sessionRecordFromProjection);

      // Ordering pin: element-wise id equality, including duplicate-ms ties.
      expect(fastRecords.map((r) => r.id)).toEqual(legacyAll.map((r) => r.id));
      expectViewsIdentical(views(fastRecords), views(legacyAll), `all-games @${count}`);

      // Projection rows never materialize blob columns (shape guard).
      const keys = Object.keys(fastRows![0]).sort();
      expect(keys).toEqual(
        [
          'completedAt',
          'durationMs',
          'gameId',
          'gameVersion',
          'generatorVersion',
          'id',
          'mAccuracy',
          'mDifficultyLevel',
          'mDifficultyRating',
          'mReactionMs',
          'mScore',
          'normalizedResult',
          'seed',
          'scoringVersion',
          'startedAt',
          'xp',
        ].sort(),
      );

      // Per-game leg: projection vs listByGame for every fixture game.
      const byGameIds = [...new Set(rows.map((r) => r.gameId))];
      for (const gameId of byGameIds) {
        const fastGame = await loadGameSessions(db, gameId);
        const legacyGame = await db.sessions.listByGame(gameId, ALL_SESSIONS_LIMIT);
        expect(fastGame.map((r) => r.id)).toEqual(legacyGame.map((r) => r.id));
        expectViewsIdentical(views(fastGame), views(legacyGame), `by-game ${gameId} @${count}`);
      }

      // --- Business-level aggregate equivalence ----------------------------
      // Representative Progress V2 analytics computed from both arrays must
      // match exactly (same inputs ⇒ same visible numbers).
      const nowMs = Math.max(...rows.map((r) => r.completedAt)) + 86_400_000;
      const resolveDomain = (gameId: string): string | null => GAME_DOMAINS[gameId] ?? null;
      const knownDomains = [
        ...new Set(Object.values(GAME_DOMAINS).filter((d): d is string => d !== null)),
      ];

      expect(buildAccuracyTrend(fastRecords)).toEqual(buildAccuracyTrend(legacyAll));
      expect(buildDifficultyProgression(fastRecords)).toEqual(
        buildDifficultyProgression(legacyAll),
      );
      expect(buildSessionVolume(fastRecords, nowMs, '30d')).toEqual(
        buildSessionVolume(legacyAll, nowMs, '30d'),
      );
      expect(buildScoreBestHistory(fastRecords, nowMs)).toEqual(
        buildScoreBestHistory(legacyAll, nowMs),
      );
      expect(buildTrainingBalance(fastRecords, resolveDomain, knownDomains, nowMs, '30d')).toEqual(
        buildTrainingBalance(legacyAll, resolveDomain, knownDomains, nowMs, '30d'),
      );

      // --- Leg 2: repository primitive fails once → transaction seam -------
      const seamAdapter = withBreakers(adapter, { breakRepositoryOnce: true });
      const seamDb = new AppDatabase(seamAdapter);
      const seamRows = await tryLoadProjectedSessionRows(seamDb, null, ALL_SESSIONS_LIMIT);
      expect(seamRows).not.toBeNull(); // seam must rescue, not fall back
      const seamRecords = seamRows!.map(sessionRecordFromProjection);
      expect(seamRecords.map((r) => r.id)).toEqual(legacyAll.map((r) => r.id));
      expectViewsIdentical(views(seamRecords), views(legacyAll), `seam @${count}`);

      // --- Leg 3: JSON1 forced unavailable → legacy fallback ---------------
      const deadAdapter = withBreakers(adapter, {
        breakRepositoryAlways: true,
        breakJsonProbe: true,
      });
      const deadDb = new AppDatabase(deadAdapter);
      expect(await tryLoadProjectedSessionRows(deadDb, null, ALL_SESSIONS_LIMIT)).toBeNull();

      const legacySnapshot = await buildLegacySnapshot(adapter);
      expectSnapshotsIdentical(await loadProgressSnapshot(db), legacySnapshot, `fast @${count}`);
      expectSnapshotsIdentical(
        await loadProgressSnapshot(deadDb),
        legacySnapshot,
        `fallback @${count}`,
      );
      expectSnapshotsIdentical(
        await loadProgressSnapshot(seamDb),
        legacySnapshot,
        `seam-snapshot @${count}`,
      );

      // Forced-fallback per-game loader matches listByGame too.
      const fallbackGame = await loadGameSessions(deadDb, GAMES[0]);
      const legacyGame = await db.sessions.listByGame(GAMES[0], ALL_SESSIONS_LIMIT);
      expect(fallbackGame.map((r) => r.id)).toEqual(legacyGame.map((r) => r.id));
    },
    count >= 20_000 ? 240_000 : count >= 5_000 ? 120_000 : 60_000,
  );
});

// ---------------------------------------------------------------------------
// Boundary contracts (small deterministic databases)
// ---------------------------------------------------------------------------

function simpleRow(
  id: string,
  completedAt: number,
  overrides: Partial<FixtureRow> = {},
): FixtureRow {
  return {
    id,
    gameId: 'memory-grid-recall',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1,
    difficultyJson: '{"level":"normal"}',
    rawResultJson: '{"score":10,"accuracy":0.5}',
    normalizedResult: 0.5,
    xp: 10,
    startedAt: completedAt - 1000,
    completedAt,
    durationMs: 1000,
    ...overrides,
  };
}

async function boundaryDb(
  rows: readonly FixtureRow[],
): Promise<{ adapter: SQLiteAdapter; db: AppDatabase }> {
  const adapter = await createMigratedDb();
  await insertRows(adapter, rows);
  return { adapter, db: new AppDatabase(adapter) };
}

describe('keyset pagination boundaries (pageSummaries)', () => {
  it('walks the whole table newest-first with no gaps or duplicates across tie groups', async () => {
    // 40 rows; eight tie groups of five identical stamps straddle pages.
    const rows: FixtureRow[] = [];
    for (let i = 0; i < 40; i++) {
      const cluster = Math.floor(i / 5);
      rows.push(simpleRow(`k-${String(i).padStart(2, '0')}`, 1_700_000_000_000 + cluster * 1000));
    }
    // Reverse insertion order so insertion order ≠ keyset order.
    const { db } = await boundaryDb([...rows].reverse());

    const canonical = [...rows]
      .sort((a, b) => b.completedAt - a.completedAt || (a.id < b.id ? 1 : -1))
      .map((r) => r.id);

    for (const pageSize of [1, 3, 7, 40]) {
      const walked: string[] = [];
      let cursor: SessionCursor | null = null;
      let pages = 0;
      for (;;) {
        const page = await db.sessions.pageSummaries(cursor, pageSize);
        walked.push(...page.items.map((s) => s.id));
        pages++;
        if (!page.hasMore) {
          expect(page.nextCursor).toBeNull();
          break;
        }
        expect(isValidSessionCursor(page.nextCursor)).toBe(true);
        cursor = page.nextCursor;
        expect(pages).toBeLessThan(200); // runaway guard
      }
      expect(`pageSize=${pageSize}: ${walked.join(',')}`).toBe(
        `pageSize=${pageSize}: ${canonical.join(',')}`,
      );
    }
  });

  it('hasMore uses the limit+1 probe: exact multiples end cleanly, one-extra spills', async () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      simpleRow(`m-${i}`, 1_700_000_000_000 + i * 1000),
    );
    const { adapter, db } = await boundaryDb(rows);

    // 9 rows, pageSize 3 → exactly 3 pages; the last must NOT claim hasMore.
    const p1 = await db.sessions.pageSummaries(null, 3);
    expect(p1.items).toHaveLength(3);
    expect(p1.hasMore).toBe(true);
    const p2 = await db.sessions.pageSummaries(p1.nextCursor, 3);
    expect(p2.items).toHaveLength(3);
    expect(p2.hasMore).toBe(true);
    const p3 = await db.sessions.pageSummaries(p2.nextCursor, 3);
    expect(p3.items).toHaveLength(3);
    expect(p3.hasMore).toBe(false);
    expect(p3.nextCursor).toBeNull();

    // One extra older row → a fourth page carrying exactly the remainder.
    await insertRows(adapter, [simpleRow('m-extra', 1_000_000)]);
    const pageSizes: number[] = [];
    let cursor: SessionCursor | null = null;
    for (;;) {
      const page = await db.sessions.pageSummaries(cursor, 3);
      pageSizes.push(page.items.length);
      if (!page.hasMore) break;
      cursor = page.nextCursor;
    }
    expect(pageSizes).toEqual([3, 3, 3, 1]);
  });

  it('rejects malformed cursors instead of silently mis-seeking', async () => {
    const { db } = await boundaryDb([simpleRow('x', 1)]);
    for (const bad of [
      {},
      { completedAt: '1700000000000', id: 'x' },
      { completedAt: Number.NaN, id: 'x' },
      { completedAt: Infinity, id: 'x' },
      { completedAt: 1 },
      { id: '', completedAt: 1 },
      'string',
      17,
    ]) {
      await expect(db.sessions.pageSummaries(bad as never, 5)).rejects.toThrow(/cursor/i);
    }
    // null is the documented "first page" input, distinct from garbage.
    const page = await db.sessions.pageSummaries(null, 5);
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });

  it('empty database yields one empty terminal page', async () => {
    const { db } = await boundaryDb([]);
    const page = await db.sessions.pageSummaries(null, 10);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

describe('window filter boundaries (inclusive semantics)', () => {
  const T = Date.UTC(2026, 2, 15, 12, 0, 0);

  async function windowDb(): Promise<{ db: AppDatabase }> {
    return boundaryDb([
      simpleRow('lo', T, { normalizedResult: 0.25, xp: 1, durationMs: 10_000 }),
      simpleRow('mid', T + 1000, { normalizedResult: 0.5, xp: 2, durationMs: 20_000 }),
      simpleRow('hi', T + 2000, { normalizedResult: 0.75, xp: 4, durationMs: 40_000 }),
    ]);
  }

  it('fromMs/toMs are inclusive on both ends', async () => {
    const { db } = await windowDb();
    const lo = await db.sessions.listSummaries({ fromMs: T, limit: 100 });
    expect(lo.map((r) => r.id)).toEqual(['hi', 'mid', 'lo']);
    const hi = await db.sessions.listSummaries({ toMs: T, limit: 100 });
    expect(hi.map((r) => r.id)).toEqual(['lo']);
    const point = await db.sessions.listSummaries({
      fromMs: T + 1000,
      toMs: T + 1000,
      limit: 100,
    });
    expect(point.map((r) => r.id)).toEqual(['mid']);
    expect(await db.sessions.countSessions({ fromMs: T, toMs: T + 2000 })).toBe(3);
    expect(await db.sessions.countSessions({ fromMs: T + 1, toMs: T + 1999 })).toBe(1);
  });

  it('minNormalized/maxNormalized are inclusive; asc/desc orderings are stable', async () => {
    const { db } = await windowDb();
    expect(
      (await db.sessions.listSummaries({ minNormalized: 0.5, limit: 100 })).map((r) => r.id),
    ).toEqual(['hi', 'mid']);
    expect(
      (await db.sessions.listSummaries({ maxNormalized: 0.5, limit: 100 })).map((r) => r.id),
    ).toEqual(['mid', 'lo']);
    const asc = await db.sessions.listSummaries({ order: 'asc', limit: 100 });
    expect(asc.map((r) => r.id)).toEqual(['lo', 'mid', 'hi']);
    const desc = await db.sessions.listSummaries({ limit: 100 });
    expect(desc.map((r) => r.id)).toEqual(['hi', 'mid', 'lo']);
  });

  it('equal completed_at keys tie-break on id DESC for listSummaries (documented order)', async () => {
    const { db } = await boundaryDb([
      simpleRow('aaa', T),
      simpleRow('zzz', T),
      simpleRow('mmm', T),
      simpleRow('other', T + 1),
    ]);
    const rows = await db.sessions.listSummaries({ limit: 100 });
    expect(rows.map((r) => r.id)).toEqual(['other', 'zzz', 'mmm', 'aaa']);
    const asc = await db.sessions.listSummaries({ order: 'asc', limit: 100 });
    expect(asc.map((r) => r.id)).toEqual(['aaa', 'mmm', 'zzz', 'other']);
  });
});

describe('aggregate pushdown differential (getSessionWindowAggregate / counts)', () => {
  it('matches a JS reference over randomized filter combinations', async () => {
    const rnd = mulberry32(0xc0ffee);
    const rows: FixtureRow[] = [];
    for (let i = 0; i < 300; i++) {
      const completedAt = Date.UTC(2026, 0, 1) + i * 3_600_000 + randInt(rnd, 0, 3_599_000);
      const durationMs = randInt(rnd, 5_000, 300_000);
      rows.push(
        simpleRow(`w-${String(i).padStart(3, '0')}`, completedAt, {
          gameId: GAMES[i % GAMES.length],
          normalizedResult: Number(rnd().toFixed(4)),
          xp: randInt(rnd, 0, 80),
          durationMs,
          startedAt: completedAt - durationMs,
          rawResultJson: '{"score":10}',
        }),
      );
    }
    const { db } = await boundaryDb(rows);

    for (let trial = 0; trial < 25; trial++) {
      const query: SessionFilterQuery = {
        ...(rnd() < 0.5 ? { gameIds: [pick(rnd, GAMES), pick(rnd, GAMES)] } : {}),
        ...(rnd() < 0.5 ? { fromMs: Date.UTC(2026, 0, 1) + randInt(rnd, 1, 200) * 3_600_000 } : {}),
        ...(rnd() < 0.5 ? { toMs: Date.UTC(2026, 0, 3) + randInt(rnd, 1, 200) * 3_600_000 } : {}),
        ...(rnd() < 0.5 ? { minNormalized: Number((0.05 + rnd() * 0.45).toFixed(3)) } : {}),
        ...(rnd() < 0.5 ? { maxNormalized: Number((0.55 + rnd() * 0.44).toFixed(3)) } : {}),
      };
      const ref = rows.filter(
        (r) =>
          (!query.gameIds || query.gameIds.includes(r.gameId)) &&
          (!query.fromMs || r.completedAt >= query.fromMs) &&
          (!query.toMs || r.completedAt <= query.toMs) &&
          (!query.minNormalized || r.normalizedResult >= query.minNormalized) &&
          (!query.maxNormalized || r.normalizedResult <= query.maxNormalized),
      );
      const agg = await db.sessions.getSessionWindowAggregate(query);
      const totalXp = ref.reduce((s, r) => s + r.xp, 0);
      const totalDuration = ref.reduce((s, r) => s + r.durationMs, 0);
      expect(`trial=${trial} count`).toBe(`trial=${trial} count`); // stable label anchor
      expect(agg.count).toBe(ref.length);
      expect(agg.totalXp).toBe(totalXp);
      expect(agg.totalDurationMs).toBe(totalDuration);
      expect(agg.bestNormalized).toBe(ref.length ? Math.max(...ref.map((r) => r.normalizedResult)) : 0);
      expect(agg.firstCompletedAt).toBe(ref.length ? Math.min(...ref.map((r) => r.completedAt)) : 0);
      expect(agg.lastCompletedAt).toBe(ref.length ? Math.max(...ref.map((r) => r.completedAt)) : 0);
      if (ref.length > 0) {
        const mean = ref.reduce((s, r) => s + r.normalizedResult, 0) / ref.length;
        expect(agg.avgNormalized).toBeCloseTo(mean, 12);
      } else {
        expect(agg.avgNormalized).toBe(0);
      }
      expect(await db.sessions.countSessions(query)).toBe(ref.length);
    }
  });

  it('daily counts (utc boundary) group by UTC calendar day, including midnight edges', async () => {
    const day = Date.UTC(2026, 0, 10);
    const { db } = await boundaryDb([
      simpleRow('before-midnight', day - 1), // 2026-01-09 23:59:59.999 UTC
      simpleRow('at-midnight', day), // 2026-01-10 00:00:00.000
      simpleRow('in-day', day + 3_600_000),
      simpleRow('last-ms', day + 86_399_999), // last ms of Jan 10
      simpleRow('next-day', day + 86_400_000), // first ms of Jan 11
      simpleRow('also-next-day', day + 86_400_001),
    ]);
    const counts = await db.sessions.getDailySessionCounts({});
    expect(counts).toEqual([
      { day: '2026-01-11', count: 2 },
      { day: '2026-01-10', count: 3 },
      { day: '2026-01-09', count: 1 },
    ]);
  });
});

describe('EXPLAIN QUERY PLAN: projection reads stay on their indexes', () => {
  it('all-games projection scans idx_game_sessions_completed_at', async () => {
    const adapter = await createMigratedDb();
    const plan = await adapter.all<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${PROJECTED_SESSIONS_ALL_SQL}`,
      [...Array(DIFFICULTY_LEVELS.length * 2).fill('easy'), 100],
    );
    expect(plan.some((r) => r.detail.includes('idx_game_sessions_completed_at'))).toBe(true);
  });

  it('per-game projection scans idx_game_sessions_game_id', async () => {
    const adapter = await createMigratedDb();
    const plan = await adapter.all<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${PROJECTED_SESSIONS_BY_GAME_SQL}`,
      [...Array(DIFFICULTY_LEVELS.length * 2).fill('easy'), 'memory-grid-recall', 100],
    );
    expect(plan.some((r) => r.detail.includes('idx_game_sessions_game_id'))).toBe(true);
  });

  it('pageSummaries keyset seek uses idx_game_sessions_completed_at (captured SQL)', async () => {
    const adapter = await createMigratedDb();
    await insertRows(
      adapter,
      Array.from({ length: 25 }, (_, i) => simpleRow(`p-${i}`, 1_700_000_000_000 + i)),
    );
    const captured: { sql: string; params: SQLiteValue[] }[] = [];
    const spy: SQLiteAdapter = {
      async exec(sql) {
        return adapter.exec(sql);
      },
      async run(sql, params) {
        return adapter.run(sql, params);
      },
      async get(sql, params) {
        return adapter.get(sql, params);
      },
      async all(sql: string, params?: SQLiteValue[]) {
        captured.push({ sql, params: params ?? [] });
        return adapter.all(sql, params);
      },
      transaction: (fn) => adapter.transaction(fn),
      close: () => adapter.close(),
    };
    const repo = new AppDatabase(spy).sessions;
    await repo.pageSummaries(null, 10);
    await repo.pageSummaries({ completedAt: 1_700_000_000_010, id: 'p-10' }, 10);

    const keysetCalls = captured.filter((c) => c.sql.includes('FROM game_sessions'));
    expect(keysetCalls.length).toBe(2);
    for (const call of keysetCalls) {
      const plan = await adapter.all<{ detail: string }>(
        `EXPLAIN QUERY PLAN ${call.sql}`,
        call.params.map(() => 0),
      );
      expect(plan.some((r) => r.detail.includes('idx_game_sessions_completed_at'))).toBe(true);
    }
    // The keyset predicate really is the expanded OR-form (portability contract).
    expect(keysetCalls[1].sql).toContain('(completed_at < ? OR (completed_at = ? AND id < ?))');
  });
});

describe('projection limit validation and passthrough', () => {
  it('rejects non-finite limits up front', async () => {
    const { db } = await boundaryDb([simpleRow('a', 1)]);
    await expect(db.sessions.listProgressProjection(Number.NaN)).rejects.toThrow(/finite/);
    await expect(db.sessions.listProgressProjection(Number.POSITIVE_INFINITY)).rejects.toThrow(
      /finite/,
    );
    await expect(db.sessions.listProgressProjectionByGame('g', Number.NaN)).rejects.toThrow(
      /finite/,
    );
  });

  it('limit honored exactly; negative limit means "unlimited" identically on both paths', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => simpleRow(`l-${i}`, 1_700_000_000_000 + i));
    const { db } = await boundaryDb(rows);

    const three = await db.sessions.listProgressProjection(3);
    expect(three.map((r) => r.id)).toEqual(['l-6', 'l-5', 'l-4']);

    // SQLite semantics: negative LIMIT = no limit. Projection and the legacy
    // full-row read agree, so callers see identical data on either path.
    const allProjected = await db.sessions.listProgressProjection(-1);
    const allLegacy = await db.sessions.listRecent(-1);
    expect(allProjected.map((r) => r.id)).toEqual(allLegacy.map((r) => r.id));
    expect(allLegacy).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Measurement (opt-in via PERF_PROBE=1, mirroring scripts/perf/run-probes.mjs)
// ---------------------------------------------------------------------------

/**
 * Old-vs-new measurement of the snapshot's session read at 1k/5k/20k on ONE
 * seeded database inside one process: legacy full-row `listRecent` vs the
 * JSON1 projection primitive (+ its JS mapping). Medians of 3 runs dampen
 * scheduler noise from co-tenant workers; numbers are still machine-relative
 * — compare only against runs from the same machine and load conditions
 * (scripts/perf/baselines/ holds the official captures).
 */
const perfEnabled = process.env.PERF_PROBE === '1';
const pd = perfEnabled ? describe : describe.skip;

/** Median of N single-shot hrtime timings (ms). */
async function medianMs(runs: number, fn: () => unknown): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

pd('perf: projection vs legacy read cost (opt-in via PERF_PROBE=1)', () => {
  it(
    'measures old-vs-new session read at 1k/5k/20k',
    async () => {
      // Fresh database per size: fixtures share the fixed adversarial ids, and
      // per-size isolation keeps the timing samples independent.
      for (const n of [1_000, 5_000, 20_000]) {
        const adapter = await createMigratedDb();
        await insertRows(adapter, buildFixture(n, 0xfee0 + n));
        const db = new AppDatabase(adapter);

        const report = {
          listRecent_legacy_full_rows_ms: await medianMs(3, () =>
            db.sessions.listRecent(ALL_SESSIONS_LIMIT),
          ),
          listProgressProjection_new_ms: await medianMs(3, () =>
            db.sessions.listProgressProjection(n),
          ),
          projection_plus_mapping_ms: await medianMs(3, async () => {
            const rows = await db.sessions.listProgressProjection(n);
            rows.map(sessionRecordFromProjection);
          }),
          loadProgressSnapshot_ms: await medianMs(3, () => loadProgressSnapshot(db)),
        };
         
        console.log(`PERF_W10_JSON:${JSON.stringify({ sessions: n, ...report })}`);

        // Sanity only — never a timing gate.
        expect(report.listProgressProjection_new_ms).toBeGreaterThan(0);
      }
    },
    600_000,
  );
});
