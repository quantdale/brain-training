import { describe, expect, it } from '@jest/globals';
import type { GameDefinition } from '@/sdk';
import {
  dailyWorkout,
  localDateString,
  MAX_OVERLAP_WITH_YESTERDAY,
  pickWorkoutGames,
  previousDate,
  WORKOUT_SIZE,
} from '../today';

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
    contentVersion: null,
    hasTutorial: false,
  }));
}

describe('pickWorkoutGames', () => {
  it('returns an empty workout for an empty catalog', () => {
    expect(pickWorkoutGames([], '2026-08-16')).toEqual([]);
  });

  it('returns every game when the catalog is at or below the workout size', () => {
    const three = makeGames(3);
    expect(pickWorkoutGames(three, '2026-08-16')).toHaveLength(3);
    const four = makeGames(4);
    expect(pickWorkoutGames(four, '2026-08-16')).toHaveLength(4);
  });

  it('picks exactly WORKOUT_SIZE distinct games from a larger catalog', () => {
    const games = makeGames(8);
    for (const date of ['2026-08-16', '2026-08-17', '2026-01-01', '2025-12-31']) {
      const picked = pickWorkoutGames(games, date);
      expect(picked).toHaveLength(WORKOUT_SIZE);
      expect(new Set(picked.map((g) => g.id)).size).toBe(WORKOUT_SIZE);
    }
  });

  it('is deterministic: same date always yields the same selection', () => {
    const games = makeGames(8);
    const a = pickWorkoutGames(games, '2026-08-16');
    const b = pickWorkoutGames(games, '2026-08-16');
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
  });

  it('changes selection when the date changes', () => {
    const games = makeGames(8);
    const a = pickWorkoutGames(games, '2026-08-16');
    const b = pickWorkoutGames(games, '2026-08-17');
    expect(a.map((g) => g.id)).not.toEqual(b.map((g) => g.id));
  });

  it('soft-avoids previous-day games within the overlap cap', () => {
    const games = makeGames(8);
    for (const date of ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']) {
      const picked = pickWorkoutGames(games, date, pickWorkoutGames(games, previousDate(date)));
      const overlap = picked.filter((g) =>
        pickWorkoutGames(games, previousDate(date)).includes(g),
      ).length;
      expect(overlap).toBeLessThanOrEqual(MAX_OVERLAP_WITH_YESTERDAY);
    }
  });

  it('attempt yields a different deterministic selection (reroll)', () => {
    const games = makeGames(8);
    const first = pickWorkoutGames(games, '2026-08-16', [], 0);
    const reroll = pickWorkoutGames(games, '2026-08-16', [], 1);
    expect(first.map((g) => g.id)).not.toEqual(reroll.map((g) => g.id));
    expect(pickWorkoutGames(games, '2026-08-16', [], 1).map((g) => g.id)).toEqual(
      reroll.map((g) => g.id),
    );
  });
});

describe('dailyWorkout', () => {
  it('selects 4 games with at most one same-game consecutive-day overlap', () => {
    const games = makeGames(8);
    let previous: string[] = [];
    for (let day = 1; day <= 14; day++) {
      const date = `2026-08-${String(day).padStart(2, '0')}`;
      const workout = dailyWorkout(games, date);
      expect(workout).toHaveLength(WORKOUT_SIZE);
      if (previous.length > 0) {
        const overlap = workout.filter((g) => previous.includes(g.id)).length;
        expect(overlap).toBeLessThanOrEqual(MAX_OVERLAP_WITH_YESTERDAY);
      }
      previous = workout.map((g) => g.id);
    }
  });
});

describe('previousDate', () => {
  it('handles month, year and leap-year boundaries', () => {
    expect(previousDate('2026-08-16')).toBe('2026-08-15');
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(previousDate('2024-03-01')).toBe('2024-02-29'); // leap year
    expect(previousDate('2026-01-01')).toBe('2025-12-31');
  });
});

describe('localDateString', () => {
  it('formats local calendar date as YYYY-MM-DD', () => {
    // Local-time construction: Jan 5, 2026, 10:30 local.
    const d = new Date(2026, 0, 5, 10, 30);
    expect(localDateString(d)).toBe('2026-01-05');
  });
});
