/**
 * Versioned quest definitions (campaign 003, WP-3A, constitution §18:
 * daily/weekly quests + long-term achievements).
 *
 * IDs are canonical keys across versions — never reuse an id for a different
 * quest. The orchestrator seeds this list at startup
 * (`quests.upsertDefinition(toDbQuestDefinition(d))` per entry) and wires the
 * UI + reward claiming. Rewards: daily 15–25 xp / 5–10 coins, weekly
 * 60–100 xp / 20–40 coins, long-term achievement-style larger payouts.
 *
 * This wave adds a richer daily/weekly POOL. The app surfaces a deterministic
 * subset each period via `selectActiveQuests` (see `active.ts`): the same date
 * always yields the same quests, so the daily/weekly set varies without
 * randomness-from-state and without storing any selection. The baseline four
 * (`qd3`, `qdx`, `qw-memory`, `qt100`) keep their exact original criteria and
 * order so existing evaluation tests remain stable.
 */
import type { QuestDefinition } from './types';

export const QUEST_DEFINITIONS_V1: readonly QuestDefinition[] = [
  // ---- Baseline (unchanged criteria / order) ----
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

  // ---- Daily pool additions (deterministic subset surfaced each day) ----
  Object.freeze({
    id: 'qd5',
    kind: 'daily',
    title: 'High Five',
    description: 'Complete 5 sessions today.',
    criteria: { type: 'session-count', goal: 5 },
    reward: { xp: 30, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qdx250',
    kind: 'daily',
    title: 'Big XP Day',
    description: 'Earn 250 XP today.',
    criteria: { type: 'earn-xp', goal: 250 },
    reward: { xp: 40, coins: 15 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qd-memory',
    kind: 'daily',
    title: 'Memory Moment',
    description: 'Play 3 Memory sessions today.',
    criteria: { type: 'domain-sessions', domain: 'Memory', goal: 3 },
    reward: { xp: 25, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qd-math',
    kind: 'daily',
    title: 'Math Minute',
    description: 'Play 3 Math sessions today.',
    criteria: { type: 'domain-sessions', domain: 'Math', goal: 3 },
    reward: { xp: 25, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qd-speed',
    kind: 'daily',
    title: 'Speed Burst',
    description: 'Play 3 Speed sessions today.',
    criteria: { type: 'domain-sessions', domain: 'Speed', goal: 3 },
    reward: { xp: 25, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qd-logic',
    kind: 'daily',
    title: 'Logic Loop',
    description: 'Play 3 Logic & Problem Solving sessions today.',
    criteria: { type: 'domain-sessions', domain: 'Logic & Problem Solving', goal: 3 },
    reward: { xp: 25, coins: 10 },
    version: 1,
  } satisfies QuestDefinition),

  // ---- Weekly pool additions (deterministic subset surfaced each ISO week) ----
  Object.freeze({
    id: 'qw-math',
    kind: 'weekly',
    title: 'Math Week',
    description: 'Play 10 Math sessions this week.',
    criteria: { type: 'domain-sessions', domain: 'Math', goal: 10 },
    reward: { xp: 80, coins: 30 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qw-speed',
    kind: 'weekly',
    title: 'Speed Week',
    description: 'Play 10 Speed sessions this week.',
    criteria: { type: 'domain-sessions', domain: 'Speed', goal: 10 },
    reward: { xp: 80, coins: 30 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qw-sessions-15',
    kind: 'weekly',
    title: 'Weekly Grind',
    description: 'Complete 15 sessions this week.',
    criteria: { type: 'session-count', goal: 15 },
    reward: { xp: 90, coins: 40 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qw-xp-1000',
    kind: 'weekly',
    title: 'Weekly Scholar',
    description: 'Earn 1,000 XP this week.',
    criteria: { type: 'earn-xp', goal: 1000 },
    reward: { xp: 100, coins: 50 },
    version: 1,
  } satisfies QuestDefinition),

  // ---- Long-term additions ----
  Object.freeze({
    id: 'qt500',
    kind: 'longterm',
    title: 'Half Millennium',
    description: 'Complete 500 sessions in total.',
    criteria: { type: 'session-count', goal: 500 },
    reward: { xp: 1500, coins: 500 },
    version: 1,
  } satisfies QuestDefinition),
  Object.freeze({
    id: 'qt-xp-50000',
    kind: 'longterm',
    title: 'XP Legend',
    description: 'Earn 50,000 lifetime XP.',
    criteria: { type: 'earn-xp', goal: 50000 },
    reward: { xp: 2000, coins: 750 },
    version: 1,
  } satisfies QuestDefinition),
] as const;
