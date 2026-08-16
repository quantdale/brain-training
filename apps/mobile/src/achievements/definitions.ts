/**
 * Versioned long-term achievement definitions (campaign 003 convergence,
 * constitution §18). IDs are canonical keys — never reuse an id for a
 * different achievement. The orchestrator seeds this list at startup
 * (`achievements.upsertDefinition(toDbAchievementDefinition(a))`) and the
 * Profile screen surfaces unlock/claim states.
 */
import type { AchievementDef } from './types';

export const ACHIEVEMENT_DEFINITIONS_V1: readonly AchievementDef[] = [
  Object.freeze({
    id: 'ach-first',
    title: 'First Steps',
    description: 'Complete your first training session.',
    criteria: { type: 'session-count', goal: 1 },
    rewardXp: 50,
    rewardCurrency: 25,
    version: 1,
  } satisfies AchievementDef),
  Object.freeze({
    id: 'ach-25',
    title: 'Getting Regular',
    description: 'Complete 25 sessions in total.',
    criteria: { type: 'session-count', goal: 25 },
    rewardXp: 250,
    rewardCurrency: 100,
    version: 1,
  } satisfies AchievementDef),
  Object.freeze({
    id: 'ach-100',
    title: 'Century Club',
    description: 'Complete 100 sessions in total.',
    criteria: { type: 'session-count', goal: 100 },
    rewardXp: 600,
    rewardCurrency: 250,
    version: 1,
  } satisfies AchievementDef),
  Object.freeze({
    id: 'ach-xp-5000',
    title: 'XP Voyager',
    description: 'Earn 5,000 lifetime XP.',
    criteria: { type: 'total-xp', goal: 5000 },
    rewardXp: 1000,
    rewardCurrency: 500,
    version: 1,
  } satisfies AchievementDef),
];
