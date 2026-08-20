/**
 * Achievement evaluation + progress tests (engagement-cosmetics wave): richer
 * criteria (domain-sessions, longest-streak, perfect-sessions) and the
 * presentational progress evaluator. The baseline four keep their original
 * met-set so the older evaluation test remains valid.
 */
import { describe, expect, it } from '@jest/globals';

import { ACHIEVEMENT_DEFINITIONS_V1, evaluateAchievements, evaluateAchievementProgress } from '@/achievements';
import type { AchievementSnapshot } from '@/achievements';

describe('evaluateAchievements (baseline stability)', () => {
  it('still reports exactly the original met set for the baseline snapshot', () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, { sessionCount: 25, totalXp: 6000 });
    expect(met).toEqual(['ach-first', 'ach-25', 'ach-xp-5000']);
  });
});

describe('evaluateAchievementProgress', () => {
  const snapshot: AchievementSnapshot = {
    sessionCount: 120,
    totalXp: 30000,
    domainSessions: { Memory: 55, Speed: 12 },
    longestStreak: 40,
    perfectSessions: 20,
  };

  it('computes progress and a clamped ratio for every criteria type', () => {
    const sessions = evaluateAchievementProgress(
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-100')!,
      snapshot,
    );
    expect(sessions).toMatchObject({ progress: 120, goal: 100, completed: true, ratio: 1 });

    const memory = evaluateAchievementProgress(
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-domain-memory')!,
      snapshot,
    );
    expect(memory).toMatchObject({ progress: 55, goal: 50, completed: true, ratio: 1 });

    const streak = evaluateAchievementProgress(
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-streak-30')!,
      snapshot,
    );
    expect(streak).toMatchObject({ progress: 40, goal: 30, completed: true, ratio: 1 });

    const perfect = evaluateAchievementProgress(
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-perfect-50')!,
      snapshot,
    );
    expect(perfect).toMatchObject({ progress: 20, goal: 50, completed: false });
    expect(perfect.ratio).toBeCloseTo(0.4);
  });

  it('treats missing richer fields as zero progress', () => {
    const streak = evaluateAchievementProgress(
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === 'ach-streak-7')!,
      { sessionCount: 0, totalXp: 0 },
    );
    expect(streak).toMatchObject({ progress: 0, goal: 7, completed: false, ratio: 0 });
  });
});
