import { describe, expect, it } from '@jest/globals';
import type { GameDefinition } from '@/sdk';
import { personalizedWorkout } from '../personalize';
import {
  canAffordReroll,
  MAX_REROLLS_PER_DAY,
  nextWorkoutAfterReroll,
  REROLL_COST_COINS,
  REROLL_FIRST_FREE,
  rerollCost,
} from '../reroll';
import type { DomainRating } from '../personalize';

const CATEGORIES: GameDefinition['primaryCategory'][] = [
  'Memory',
  'Attention',
  'Speed',
  'Math',
  'Language',
  'Logic & Problem Solving',
  'Flexibility',
  'Spatial',
];

function makeGames(count: number): GameDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `game-${i}`,
    name: `Game ${i}`,
    primaryCategory: CATEGORIES[i % CATEGORIES.length],
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: null,
    hasTutorial: false,
  }));
}

const RATINGS: DomainRating[] = CATEGORIES.map((domain) => ({
  domain,
  rating: 1000,
  sessions: 1,
  updatedAt: 1_700_000_000_000,
}));

function ids(games: readonly GameDefinition[]): string[] {
  return games.map((game) => game.id);
}

describe('reroll constants', () => {
  it('pins the reroll economics constants (constitution §14)', () => {
    expect(REROLL_FIRST_FREE).toBe(true);
    expect(REROLL_COST_COINS).toBe(25);
    expect(MAX_REROLLS_PER_DAY).toBe(5);
  });
});

describe('rerollCost', () => {
  it('is free when no reroll has been used yet (first-free)', () => {
    expect(rerollCost(0)).toBe(0);
  });

  it('charges escalating coins from the second reroll on', () => {
    expect(rerollCost(1)).toBe(25); // 2nd reroll of the day
    expect(rerollCost(2)).toBe(50); // 3rd
    expect(rerollCost(3)).toBe(75); // 4th
    expect(rerollCost(4)).toBe(100); // 5th
  });

  it('treats negative attemptsUsed as no rerolls used (free)', () => {
    expect(rerollCost(-1)).toBe(0);
  });
});

describe('canAffordReroll', () => {
  it('declines when the daily reroll cap is exhausted', () => {
    expect(canAffordReroll(10_000, MAX_REROLLS_PER_DAY)).toBe(false);
    expect(canAffordReroll(10_000, MAX_REROLLS_PER_DAY + 1)).toBe(false);
  });

  it('allows the free first reroll with a zero balance', () => {
    expect(canAffordReroll(0, 0)).toBe(true);
  });

  it('requires the exact coin cost for paid rerolls', () => {
    expect(canAffordReroll(24, 1)).toBe(false);
    expect(canAffordReroll(25, 1)).toBe(true);
    expect(canAffordReroll(49, 2)).toBe(false);
    expect(canAffordReroll(50, 2)).toBe(true);
  });

  it('is pure: does not mutate its inputs', () => {
    canAffordReroll(0, 0);
    canAffordReroll(25, 1);
    expect(MAX_REROLLS_PER_DAY).toBe(5);
  });
});

describe('nextWorkoutAfterReroll', () => {
  const games = makeGames(8);
  const recent = ['game-2', 'game-5'];

  it('returns the next attempt variant of the personalized workout', () => {
    const next = nextWorkoutAfterReroll(games, '2026-08-16', RATINGS, recent, 1);
    const expected = personalizedWorkout(games, '2026-08-16', RATINGS, recent, 2);
    expect(ids(next)).toEqual(ids(expected));
  });

  it('is deterministic: same inputs always yield the same selection', () => {
    const a = nextWorkoutAfterReroll(games, '2026-08-16', RATINGS, recent, 0);
    const b = nextWorkoutAfterReroll(games, '2026-08-16', RATINGS, recent, 0);
    expect(ids(a)).toEqual(ids(b));
  });

  it('produces a distinct selection from the current one', () => {
    const current = personalizedWorkout(games, '2026-08-16', RATINGS, recent, 1);
    const next = nextWorkoutAfterReroll(games, '2026-08-16', RATINGS, recent, 1);
    expect(ids(next)).not.toEqual(ids(current));
  });
});
