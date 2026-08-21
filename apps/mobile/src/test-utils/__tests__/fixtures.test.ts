/** Tests for the deterministic record factories in `src/test-utils/fixtures.ts`. */
import { describe, expect, it } from '@jest/globals';

import { makeSessionRecord, FIXED_TEST_NOW } from '../fixtures';

describe('makeSessionRecord', () => {
  it('is fully deterministic with no overrides', () => {
    expect(makeSessionRecord()).toEqual(makeSessionRecord());
  });

  it('produces a complete, valid record shape', () => {
    const record = makeSessionRecord();
    expect(record.id).toBe('session-test-0001');
    expect(record.gameId).toBe('test-game');
    expect(record.completedAt).toBeGreaterThan(record.startedAt);
    expect(record.durationMs).toBe(record.completedAt - record.startedAt);
    expect(record.normalizedResult).toBeGreaterThanOrEqual(0);
    expect(record.normalizedResult).toBeLessThanOrEqual(1);
  });

  it('applies overrides over the deterministic defaults', () => {
    const record = makeSessionRecord({
      id: 'custom-id',
      gameId: 'memory-grid-recall',
      xp: 42,
      normalizedResult: 1,
    });
    expect(record.id).toBe('custom-id');
    expect(record.gameId).toBe('memory-grid-recall');
    expect(record.xp).toBe(42);
    expect(record.normalizedResult).toBe(1);
    // Untouched fields keep their defaults.
    expect(record.seed).toBe(42);
    expect(record.startedAt).toBe(FIXED_TEST_NOW);
  });
});
