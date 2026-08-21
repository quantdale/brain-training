/**
 * Pure unit tests for the campaign 010 W11 query helpers (db/query.ts,
 * db/batch.ts, session cursor guard). No database involved — these pin the
 * deterministic normalization/builder contracts the repository projection
 * APIs rely on.
 */
import { describe, expect, it } from '@jest/globals';

import { executeBatch } from '../batch';
import {
  buildInPlaceholders,
  chunk,
  clampLimit,
  joinAnd,
  normalizeOffset,
  requireFiniteNumber,
} from '../query';
import { isValidSessionCursor } from '../sessions';

describe('chunk', () => {
  it('splits evenly, keeps a shorter tail, and handles empty input', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(chunk(['a', 'b'], 5)).toEqual([['a', 'b']]);
  });

  it('rejects a non-positive or non-integer size', () => {
    expect(() => chunk([1], 0)).toThrow(/positive integer/);
    expect(() => chunk([1], 1.5)).toThrow(/positive integer/);
  });
});

describe('buildInPlaceholders', () => {
  it('produces one ? per count and rejects negative counts', () => {
    expect(buildInPlaceholders(0)).toBe('');
    expect(buildInPlaceholders(1)).toBe('?');
    expect(buildInPlaceholders(3)).toBe('?,?,?');
    expect(() => buildInPlaceholders(-1)).toThrow(/non-negative/);
  });
});

describe('limit/offset normalization', () => {
  it('clampLimit falls back on missing/invalid values and clamps the ceiling', () => {
    expect(clampLimit(undefined, 50, 10_000)).toBe(50);
    expect(clampLimit(Number.NaN, 50, 10_000)).toBe(50);
    expect(clampLimit(0, 50, 10_000)).toBe(50);
    expect(clampLimit(-5, 50, 10_000)).toBe(50);
    expect(clampLimit(25, 50, 10_000)).toBe(25);
    expect(clampLimit(999_999, 50, 10_000)).toBe(10_000);
  });

  it('normalizeOffset floors to 0 for missing/invalid/negative offsets', () => {
    expect(normalizeOffset(undefined)).toBe(0);
    expect(normalizeOffset(Number.NaN)).toBe(0);
    expect(normalizeOffset(-10)).toBe(0);
    expect(normalizeOffset(7.9)).toBe(7);
  });
});

describe('joinAnd / requireFiniteNumber', () => {
  it('joinAnd returns empty string for no conditions', () => {
    expect(joinAnd([])).toBe('');
    expect(joinAnd(['a = ?', 'b > ?'])).toBe('WHERE a = ? AND b > ?');
  });

  it('requireFiniteNumber passes finite numbers through and rejects NaN/Infinity', () => {
    expect(requireFiniteNumber(undefined, 'x')).toBeUndefined();
    expect(requireFiniteNumber(1.5, 'x')).toBe(1.5);
    expect(() => requireFiniteNumber(Number.NaN, 'fromMs')).toThrow(/fromMs/);
    expect(() => requireFiniteNumber(Number.POSITIVE_INFINITY, 'toMs')).toThrow(/toMs/);
  });
});

describe('isValidSessionCursor', () => {
  it('accepts well-formed cursors and rejects malformed ones', () => {
    expect(isValidSessionCursor({ completedAt: 123, id: 'sess-1' })).toBe(true);
    expect(isValidSessionCursor(null)).toBe(false);
    expect(isValidSessionCursor('nope')).toBe(false);
    expect(isValidSessionCursor({ completedAt: Number.NaN, id: 'x' })).toBe(false);
    expect(isValidSessionCursor({ completedAt: 123, id: '' })).toBe(false);
    expect(isValidSessionCursor({ completedAt: 123 })).toBe(false);
  });
});

describe('executeBatch', () => {
  it('short-circuits an empty batch without touching the adapter', async () => {
    const boom = {
      transaction: () => Promise.reject(new Error('must not open a transaction')),
    };
    await expect(executeBatch(boom as never, [])).resolves.toEqual({
      changes: 0,
      lastInsertRowId: 0,
      statementCount: 0,
    });
  });

  it('rejects statements with empty sql before opening a transaction', async () => {
    const boom = {
      transaction: () => Promise.reject(new Error('must not open a transaction')),
    };
    await expect(
      executeBatch(boom as never, [{ sql: '   ', params: [] }]),
    ).rejects.toThrow(/non-empty sql/);
  });
});
