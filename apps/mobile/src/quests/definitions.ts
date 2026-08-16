/**
 * Versioned quest definitions (campaign 003, WP-3A, constitution §18:
 * daily/weekly quests + long-term achievements).
 *
 * IDs are canonical keys across versions — never reuse an id for a different
 * quest. The orchestrator seeds this list at startup
 * (`quests.upsertDefinition(toDbQuestDefinition(d))` per entry) and wires the
 * UI + reward claiming. Rewards: daily 15–25 xp / 5–10 coins, weekly
 * 60–100 xp / 20–40 coins, long-term achievement-style larger payouts.
 */
import type { QuestDefinition } from './types';

export const QUEST_DEFINITIONS_V1: readonly QuestDefinition[] = [
  Object.freeze({
    id: 'qd3',
    kind: 'daily',
    title: 'Play Three Games',
    description: 'Complete 3 sessions today.',
    criteria: { type: 'session-count', goal: 3 },
    reward: { xp: 20, coins: 5 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qdx',
    kind: 'daily',
    title: 'Daily XP',
    description: 'Earn 100 XP today.',
    criteria: { type: 'earn-xp', goal: 100 },
    reward: { xp: 25, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qw-memory',
    kind: 'weekly',
    title: 'Memory Week',
    description: 'Play 10 Memory sessions this week.',
    criteria: { type: 'domain-sessions', domain: 'Memory', goal: 10 },
    reward: { xp: 80, coins: 30 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qt100',
    kind: 'longterm',
    title: 'Century',
    description: 'Complete 100 sessions in total.',
    criteria: { type: 'session-count', goal: 100 },
    reward: { xp: 500, coins: 150 },
    version: 1,
  } satisfies QuestDefinition),
];
