/** Tests for the in-memory DB fixture in `src/test-utils/db.ts`. */
import { describe, expect, it } from '@jest/globals';
import { SCHEMA_VERSION, getSchemaVersion } from '@/db';

import { createMigratedDb } from '../db';

describe('createMigratedDb', () => {
  it('returns an adapter migrated to SCHEMA_VERSION', async () => {
    const adapter = await createMigratedDb();
    expect(await getSchemaVersion(adapter)).toBe(SCHEMA_VERSION);
  });

  it('has the canonical session tables in place', async () => {
    const adapter = await createMigratedDb();
    const tables = await adapter.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = new Set(tables.map((t) => t.name));
    for (const expected of [
      'game_sessions',
      'currency_ledger',
      'domain_ratings',
      'rating_history',
    ]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it('creates independent databases per call', async () => {
    const a = await createMigratedDb();
    const b = await createMigratedDb();
    await a.run(
      'INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['s1', 'g', 1, 1, 1, 1, '{}', '{}', 0.5, 0, 0, 0, 0],
    );
    const fromA = await a.all<{ id: string }>('SELECT id FROM game_sessions');
    const fromB = await b.all<{ id: string }>('SELECT id FROM game_sessions');
    expect(fromA).toHaveLength(1);
    expect(fromB).toHaveLength(0);
  });
});
