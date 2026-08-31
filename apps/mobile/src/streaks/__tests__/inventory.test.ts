import { describe, expect, it } from '@jest/globals';
import { addCoveredDates, consumeItem, grantItems, readCoveredDates, readInventory } from '../inventory';

describe('readInventory', () => {
  it('returns all zeros when the streaks block is missing', () => {
    expect(readInventory({})).toEqual({ freeze: 0, shield: 0, recovery: 0 });
    expect(readInventory({ theme: 'dark', coins: 3 })).toEqual({ freeze: 0, shield: 0, recovery: 0 });
    expect(readInventory({ streaks: 'oops' })).toEqual({ freeze: 0, shield: 0, recovery: 0 });
    expect(readInventory({ streaks: null })).toEqual({ freeze: 0, shield: 0, recovery: 0 });
  });

  it('reads partial blocks with missing keys as 0', () => {
    expect(readInventory({ streaks: { freeze: 2 } })).toEqual({
      freeze: 2,
      shield: 0,
      recovery: 0,
    });
  });

  it('normalizes garbage, negative and fractional counts to 0/floor', () => {
    const settings = { streaks: { freeze: -1, shield: 'x', recovery: 2.9, extra: 99 } };
    expect(readInventory(settings)).toEqual({ freeze: 0, shield: 0, recovery: 2 });
  });
});

describe('grantItems', () => {
  it('adds counts to an existing block and preserves unrelated keys', () => {
    const settings = { theme: 'dark', streaks: { freeze: 1, shield: 0, recovery: 2 } };
    const next = grantItems(settings, { freeze: 2, recovery: 1 });
    expect(next).toEqual({
      theme: 'dark',
      streaks: { freeze: 3, shield: 0, recovery: 3 },
    });
  });

  it('creates the block when missing', () => {
    expect(grantItems({ theme: 'dark' }, { freeze: 1 })).toEqual({
      theme: 'dark',
      streaks: { freeze: 1, shield: 0, recovery: 0 },
    });
  });

  it('preserves the freezeUsed sub-key', () => {
    const settings = { streaks: { freeze: 1, shield: 0, recovery: 0, freezeUsed: { period: '2026-08', count: 1 } } };
    const next = grantItems(settings, { freeze: 1 });
    expect(next.streaks).toEqual({
      freeze: 2,
      shield: 0,
      recovery: 0,
      freezeUsed: { period: '2026-08', count: 1 },
    });
  });

  it('clamps garbage item values to 0 and ignores unknown keys', () => {
    const next = grantItems({}, { freeze: 3.7, shield: -2, recovery: Number.NaN } as never);
    expect(next.streaks).toEqual({ freeze: 3, shield: 0, recovery: 0 });
  });

  it('returns a new object and never mutates the input', () => {
    const settings = { theme: 'dark', streaks: { freeze: 1, shield: 0, recovery: 0 } };
    const before = JSON.stringify(settings);
    const next = grantItems(settings, { freeze: 1 });
    expect(next).not.toBe(settings);
    expect(JSON.stringify(settings)).toBe(before);
  });
});

describe('consumeItem', () => {
  it('decrements the requested kind only', () => {
    const settings = { streaks: { freeze: 2, shield: 1, recovery: 3 } };
    expect(consumeItem(settings, 'freeze')).toEqual({
      streaks: { freeze: 1, shield: 1, recovery: 3 },
    });
    expect(consumeItem(settings, 'shield')).toEqual({
      streaks: { freeze: 2, shield: 0, recovery: 3 },
    });
  });

  it('floors at 0 and preserves unrelated settings keys', () => {
    const settings = { theme: 'dark', streaks: { freeze: 0, shield: 0, recovery: 1 } };
    expect(consumeItem(settings, 'freeze')).toEqual({
      theme: 'dark',
      streaks: { freeze: 0, shield: 0, recovery: 1 },
    });
  });

  it('preserves the freezeUsed sub-key', () => {
    const settings = { streaks: { freeze: 1, shield: 0, recovery: 0, freezeUsed: { period: '2026-08', count: 2 } } };
    expect(consumeItem(settings, 'freeze').streaks).toEqual({
      freeze: 0,
      shield: 0,
      recovery: 0,
      freezeUsed: { period: '2026-08', count: 2 },
    });
  });

  it('creates the block when missing and returns a new object', () => {
    const settings = { theme: 'dark' };
    const next = consumeItem(settings, 'recovery');
    expect(next).toEqual({ theme: 'dark', streaks: { freeze: 0, shield: 0, recovery: 0 } });
    expect(next).not.toBe(settings);
  });

  it('rejects an unknown runtime item kind before changing settings', () => {
    expect(() => consumeItem({ streaks: { freeze: 1 } }, 'potion' as never)).toThrow(
      /unknown streak item kind/,
    );
  });
});

describe('covered dates', () => {
  it('drops impossible dates, deduplicates, and returns canonical order', () => {
    const settings = {
      streaks: {
        coveredDates: ['2026-08-16', '2026-02-30', '2026-08-14', '2026-08-16', 'nope'],
      },
    };
    expect(readCoveredDates(settings)).toEqual(['2026-08-14', '2026-08-16']);
  });

  it('adds only valid dates and serializes them deterministically', () => {
    expect(
      addCoveredDates({ streaks: { coveredDates: ['2026-08-16'] } }, [
        '2026-08-15',
        '2026-02-30',
        '2026-08-15',
      ]),
    ).toEqual({ streaks: { coveredDates: ['2026-08-15', '2026-08-16'] } });
  });
});
