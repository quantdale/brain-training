/**
 * Deterministic domain-record factories for tests.
 *
 * Every field has a fixed default so tests only specify the fields they
 * assert on; records built with no overrides are byte-identical across runs
 * (no `Date.now()` / `Math.random()` anywhere in fixture construction).
 */
import type { GameSessionRecord } from '@/db';

/** Fixed epoch reference used by fixtures (2023-11-14T22:13:20Z). */
export const FIXED_TEST_NOW = 1_700_000_000_000;

/** A fully valid persisted-session record with deterministic defaults. */
export function makeSessionRecord(
  overrides: Partial<GameSessionRecord> = {},
): GameSessionRecord {
  return {
    id: 'session-test-0001',
    gameId: 'test-game',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5 },
    rawResult: { score: 0 },
    normalizedResult: 0.5,
    xp: 10,
    startedAt: FIXED_TEST_NOW,
    completedAt: FIXED_TEST_NOW + 30_000,
    durationMs: 30_000,
    ...overrides,
  };
}
