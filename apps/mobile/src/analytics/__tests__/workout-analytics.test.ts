import { describe, expect, it } from '@jest/globals';
import type { WorkoutInstance } from '@/db';
import { buildWorkoutAnalytics } from '../workout-analytics';

function instance(date: string, currentIndex = 4, status: WorkoutInstance['status'] = 'completed', skippedIndices: number[] = []): WorkoutInstance {
  return { date, gameIds: ['a', 'b', 'c', 'd'], currentIndex, status, skippedIndices,
    rerollAttempt: 0, seedVersion: 1, createdAt: 1, updatedAt: 1 };
}

describe('workout analytics settled legs and civil days', () => {
  it.each<[WorkoutInstance['status'], number, number]>([['active', 3, 0], ['completed', 4, 1]])('excludes skipped positions from %s games finished', (status, index, played) => {
    const result = buildWorkoutAnalytics([instance('2026-11-16', index, status, [0, 1, 2])], 1);
    expect(result.gamesCompleted).toBe(played);
    expect(result.gamesAssigned).toBe(4);
  });

  it('counts only distinct valid skipped indices inside the settled prefix', () => {
    expect(buildWorkoutAnalytics([instance('2026-11-16', 2, 'active', [-1, 0, 0, 1.5, 2, 99])], 0).gamesCompleted).toBe(1);
  });

  it('deduplicates completed civil days, not daily/template instances', () => {
    const result = buildWorkoutAnalytics([
      instance('2026-11-15'), instance('2026-11-16'), instance('2026-11-17'),
      instance('2026-11-16::focus-memory::short'),
      instance('2026-11-17::focus-memory::short', 1, 'active'),
    ], 4);
    expect(result).toMatchObject({ loadedInstances: 5, completedInstances: 4, activeInstances: 1,
      gamesAssigned: 20, gamesCompleted: 17, completionRate: 0.8,
      currentCompletedRun: 3, longestCompletedRun: 3 });
  });
});
