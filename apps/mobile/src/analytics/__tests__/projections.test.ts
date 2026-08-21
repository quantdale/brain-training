/**
 * Determinism/parity tests for the campaign 010 projection layer
 * (`analytics/projections.ts`). Pure only — no database — so they pin the
 * shim↔extractor contract that keeps the JSON1 fast path behaviorally
 * identical to the legacy full-blob path. SQL execution itself is exercised
 * indirectly by `src/__tests__/perf-db-query-patterns.test.ts` (statement
 * guards) and NOT VALIDATED on-device within this packet.
 */
import { describe, expect, it } from '@jest/globals';

import {
  DIFFICULTY_LEVEL_PARAMS,
  PROJECTED_SESSIONS_ALL_SQL,
  PROJECTED_SESSIONS_BY_GAME_SQL,
  sessionRecordFromProjection,
  type ProjectedSessionRow,
} from '../projections';
import { extractAccuracy, extractDifficultyRating, extractReactionMs, extractScore } from '../metrics-map';
import { DIFFICULTY_LEVELS } from '@/sdk';

function row(over: Partial<ProjectedSessionRow>): ProjectedSessionRow {
  return {
    id: 'sess-1',
    gameId: 'memory-grid-recall',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 42,
    normalizedResult: 0.75,
    xp: 12,
    startedAt: 1000,
    completedAt: 2000,
    durationMs: 95_000,
    mScore: null,
    mAccuracy: null,
    mReactionMs: null,
    mDifficultyRating: null,
    mDifficultyLevel: null,
    ...over,
  };
}

describe('projection → record mapping', () => {
  it('maps scalar columns 1:1 onto GameSessionRecord', () => {
    const record = sessionRecordFromProjection(row({}));
    expect(record.id).toBe('sess-1');
    expect(record.gameId).toBe('memory-grid-recall');
    expect(record.gameVersion).toBe(1);
    expect(record.generatorVersion).toBe(1);
    expect(record.scoringVersion).toBe(1);
    expect(record.seed).toBe(42);
    expect(record.normalizedResult).toBe(0.75);
    expect(record.xp).toBe(12);
    expect(record.startedAt).toBe(1000);
    expect(record.completedAt).toBe(2000);
    expect(record.durationMs).toBe(95_000);
  });

  it('all-null metric columns yield blob-free records the extractors report as unavailable', () => {
    const record = sessionRecordFromProjection(row({}));
    expect(record.rawResult).toBeNull();
    expect(record.difficulty).toBeNull();
    expect(extractScore(record.rawResult)).toBeNull();
    expect(extractAccuracy(record.rawResult)).toBeNull();
    expect(extractReactionMs(record.rawResult)).toBeNull();
    expect(extractDifficultyRating(record.difficulty)).toBeNull();
  });

  it('score shim preserves the shared extractor result (priority resolved in SQL)', () => {
    // The SQL COALESCE already picked the first present field per metrics-map
    // priority (score > points > totalScore); whatever won is exposed as
    // `score`, so the extractor must return exactly that number.
    const record = sessionRecordFromProjection(row({ mScore: 320 }));
    expect(extractScore(record.rawResult)).toBe(320);
  });

  it('accuracy shim stays unclamped so the shared extractor applies its own clamp', () => {
    const high = sessionRecordFromProjection(row({ mAccuracy: 1.5 }));
    const low = sessionRecordFromProjection(row({ mAccuracy: -0.2 }));
    expect(extractAccuracy(high.rawResult)).toBe(1);
    expect(extractAccuracy(low.rawResult)).toBe(0);
  });

  it('reaction shim exposes the winning value under a mean-field name', () => {
    // Means beat bests in metrics-map; the SQL COALESCE encodes that order and
    // the shim stores the winner as avgResponseMs (a mean name checked first).
    const record = sessionRecordFromProjection(row({ mReactionMs: 412 }));
    expect(extractReactionMs(record.rawResult)).toBe(412);
  });

  it('difficulty shim prefers challengeRating and maps named levels like the real blob', () => {
    const rating = sessionRecordFromProjection(row({ mDifficultyRating: 0.65 }));
    expect(extractDifficultyRating(rating.difficulty)).toBe(0.65);

    const level = sessionRecordFromProjection(row({ mDifficultyLevel: 'hard' }));
    expect(extractDifficultyRating(level.difficulty)).toBe(0.8); // DEFAULT_CHALLENGE_RATINGS.hard
  });
});

describe('projection SQL determinism', () => {
  it('keeps corruption guards, ordering and level bindings stable', () => {
    for (const sql of [PROJECTED_SESSIONS_ALL_SQL, PROJECTED_SESSIONS_BY_GAME_SQL]) {
      // Malformed blobs must degrade to nulls, never error the scan.
      expect(sql).toContain('json_valid(raw_result_json)');
      expect(sql).toContain('json_valid(difficulty_json)');
      // Newest-first, matching the legacy listRecent/listByGame order.
      expect(sql).toContain('ORDER BY completed_at DESC');
      // Exactly two difficulty-level IN-groups (object form + bare-string form).
      const placeholders = sql.match(/\?/g)?.length ?? 0;
      expect(placeholders).toBeGreaterThanOrEqual(2 * DIFFICULTY_LEVELS.length);
    }
    expect(PROJECTED_SESSIONS_BY_GAME_SQL).toContain('WHERE game_id = ?');
    expect(DIFFICULTY_LEVEL_PARAMS).toEqual([...DIFFICULTY_LEVELS]);
  });
});
