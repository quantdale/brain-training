import { describe, expect, it } from '@jest/globals';
import {
  levelForXp,
  levelProgress,
  xpForLevel,
  xpForNextLevel,
  xpIntoLevel,
} from '../levels';

describe('xpForLevel', () => {
  it('follows the documented quadratic curve: 50 * L * (L - 1)', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
    expect(xpForLevel(5)).toBe(1000);
    expect(xpForLevel(10)).toBe(4500);
  });

  it('rejects non-positive or non-integer levels', () => {
    expect(() => xpForLevel(0)).toThrow(/level/);
    expect(() => xpForLevel(-3)).toThrow(/level/);
    expect(() => xpForLevel(1.5)).toThrow(/level/);
  });
});

describe('levelForXp', () => {
  it('inverts xpForLevel at every boundary', () => {
    for (let level = 1; level <= 50; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      // One XP below the next level's requirement is still this level.
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it('handles the boundaries and large totals', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(1499)).toBe(5);
    expect(levelForXp(1500)).toBe(6);
    // No hard cap: a huge XP total yields a huge level (approx 4472 for 1e9).
    expect(levelForXp(1_000_000_000)).toBe(4472);
    expect(levelForXp(-50)).toBe(1); // never below level 1
  });
});

describe('level progress helpers', () => {
  it('xpIntoLevel is the offset within the current level', () => {
    expect(xpIntoLevel(0)).toBe(0);
    expect(xpIntoLevel(100)).toBe(0);
    expect(xpIntoLevel(150)).toBe(50);
    expect(xpIntoLevel(300)).toBe(0);
    expect(xpIntoLevel(1499)).toBe(499);
  });

  it('xpForNextLevel is the gap to the next level', () => {
    expect(xpForNextLevel(0)).toBe(100);
    expect(xpForNextLevel(100)).toBe(200);
    expect(xpForNextLevel(300)).toBe(300);
    expect(xpForNextLevel(1000)).toBe(500);
    expect(xpForNextLevel(1499)).toBe(500);
  });

  it('levelProgress is the fraction within the current level', () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(150)).toBeCloseTo(0.25); // level 2 spans [100, 300), 50/200
    expect(levelProgress(200)).toBeCloseTo(0.5);
    expect(levelProgress(299)).toBeCloseTo(0.995);
    expect(levelProgress(300)).toBe(0);
    expect(levelProgress(1000)).toBe(0);
  });
});
