/**
 * Database integrity tests (006R task 8.1-8.2).
 *
 * These tests verify:
 * - CHECK constraints for normalized_result, xp, rating
 * - Rejection of newer schema versions
 */
import { describe, expect, it, beforeEach } from '@jest/globals';

import { createMigratedDb } from '@/db/__tests__/helpers';
import { getSchemaVersion, runMigrations } from '@/db/migrate';
import { SCHEMA_VERSION } from '@/db/schema';
import type { SQLiteAdapter } from '@/db/adapter';

describe('Database integrity — CHECK constraints (task 8.1)', () => {
  let adapter: SQLiteAdapter;

  beforeEach(async () => {
    adapter = await createMigratedDb();
  });

  it('rejects normalized_result outside [0, 1]', async () => {
    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-1', 'memory', 1, 1, 1, 42, '{}', '{}', 1.5, 50, 1000, 2000, 1000]
      )
    ).rejects.toThrow(/normalized_result must be in \[0, 1\]/);

    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-2', 'memory', 1, 1, 1, 42, '{}', '{}', -0.1, 50, 1000, 2000, 1000]
      )
    ).rejects.toThrow(/normalized_result must be in \[0, 1\]/);
  });

  it('accepts normalized_result in [0, 1]', async () => {
    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-3', 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, 50, 1000, 2000, 1000]
      )
    ).resolves.toBeDefined();

    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-4', 'memory', 1, 1, 1, 42, '{}', '{}', 0, 50, 1000, 2000, 1000]
      )
    ).resolves.toBeDefined();

    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-5', 'memory', 1, 1, 1, 42, '{}', '{}', 1, 50, 1000, 2000, 1000]
      )
    ).resolves.toBeDefined();
  });

  it('rejects negative xp', async () => {
    await expect(
      adapter.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['test-6', 'memory', 1, 1, 1, 42, '{}', '{}', 0.5, -10, 1000, 2000, 1000]
      )
    ).rejects.toThrow(/xp must be nonnegative/);
  });

  it('rejects negative rating', async () => {
    await expect(
      adapter.run(
        `INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)`,
        ['Memory', -100, 1, 1000]
      )
    ).rejects.toThrow(/rating must be nonnegative/);

    // Also test UPDATE
    await adapter.run(
      `INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)`,
      ['Memory', 1000, 1, 1000]
    );

    await expect(
      adapter.run(
        `UPDATE domain_ratings SET rating = -100 WHERE domain = 'Memory'`
      )
    ).rejects.toThrow(/rating must be nonnegative/);
  });
});

describe('Database integrity — newer schema rejection (task 8.2)', () => {
  it('rejects database with newer schema version', async () => {
    const adapter = await createMigratedDb();
    
    // Simulate a newer schema version
    await adapter.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    
    // Try to run migrations - should fail
    await expect(runMigrations(adapter)).rejects.toThrow(/newer than supported version/);
  });

  it('allows database with same schema version', async () => {
    const adapter = await createMigratedDb();
    
    // Run migrations again - should be a no-op
    await runMigrations(adapter);
    // If it throws, the test fails
  });

  it('allows database with older schema version', async () => {
    const adapter = await createMigratedDb();
    
    // Simulate an older schema version
    await adapter.exec(`PRAGMA user_version = ${SCHEMA_VERSION - 1}`);
    
    // Run migrations - should succeed
    await runMigrations(adapter);
    
    // Verify version is updated
    const version = await getSchemaVersion(adapter);
    expect(version).toBe(SCHEMA_VERSION);
  });
});
