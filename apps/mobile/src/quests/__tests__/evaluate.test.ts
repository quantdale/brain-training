import { describe, expect, it } from '@jest/globals';
import { evaluateQuest, evaluateQuests } from '../evaluate';
import type { QuestSessionSample, QuestSnapshot } from '../evaluate';
import { QUEST_DEFINITIONS_V1 } from '../definitions';
import type { QuestDefinition } from '../types';

// Fixed clock: Sunday 2026-08-16 local noon, ISO week 2026-W33.
const NOW = new Date(2026, 7, 16, 12, 0, 0);
const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month - 1, day, hour, 0, 0).getTime();

const memory = (completedAt: number, xp = 50): QuestSessionSample => ({
  completedAt,
  gameId: 'memory',
  domain: 'Memory',
  xp,
});
const math = (completedAt: number, xp = 50): QuestSessionSample => ({
  completedAt,
  gameId: 'math-fast-math',
  domain: 'Math',
  xp,
});

// Sessions: 2 today (Sun 08-16), 1 yesterday (Sat 08-15, same ISO week),
// 1 last Sunday (08-09, ISO week 2026-W32), 1 older (07-01).
const SNAPSHOT: QuestSnapshot = {
  sessions: [
    memory(at(2026, 8, 16)),
    math(at(2026, 8, 16, 8)),
    memory(at(2026, 8, 15)),
    memory(at(2026, 8, 9)),
    memory(at(2026, 7, 1), 60),
  ],
};

const byId = (definitions: readonly QuestDefinition[], id: string): QuestDefinition =>
  definitions.find((d) => d.id === id)!;

describe('evaluateQuests', () => {
  it('evaluates every definition in order with matching period keys', () => {
    const results = evaluateQuests(QUEST_DEFINITIONS_V1, SNAPSHOT, NOW);
    expect(results.map((r) => r.questId)).toEqual([
      'qd3',
      'qdx',
      'qw-memory',
      'qt100',
    ]);
    expect(results.map((r) => r.periodKey)).toEqual([
      '2026-08-16',
      '2026-08-16',
      '2026-W33',
      'all',
    ]);
  });

  it('daily quest counts only sessions on the same local date', () => {
    const result = evaluateQuest(byId(QUEST_DEFINITIONS_V1, 'qd3'), SNAPSHOT, NOW);
    expect(result.progress).toBe(2); // both today's; yesterday excluded
    expect(result.goal).toBe(3);
    expect(result.completed).toBe(false);
  });

  it('daily earn-xp sums today XP across sessions', () => {
    const result = evaluateQuest(byId(QUEST_DEFINITIONS_V1, 'qdx'), SNAPSHOT, NOW);
    expect(result.progress).toBe(100); // 50 + 50 today only
    expect(result.completed).toBe(true);
  });

  it('weekly quest counts only sessions in the current ISO week', () => {
    const result = evaluateQuest(byId(QUEST_DEFINITIONS_V1, 'qw-memory'), SNAPSHOT, NOW);
    expect(result.progress).toBe(2); // 08-16 + 08-15; 08-09 is W32
    expect(result.goal).toBe(10);
    expect(result.completed).toBe(false);
  });

  it('longterm quest counts the whole snapshot', () => {
    const result = evaluateQuest(byId(QUEST_DEFINITIONS_V1, 'qt100'), SNAPSHOT, NOW);
    expect(result.progress).toBe(5);
    expect(result.completed).toBe(false);
  });

  it('domain-sessions counts only matching domain sessions', () => {
    const def = byId(QUEST_DEFINITIONS_V1, 'qw-memory');
    const mixed: QuestSnapshot = {
      sessions: [
        memory(at(2026, 8, 15)),
        math(at(2026, 8, 15)),
        memory(at(2026, 8, 16)),
      ],
    };
    const result = evaluateQuest(def, mixed, NOW);
    expect(result.progress).toBe(2); // the Math session does not count
  });

  it('marks completed exactly when progress reaches the goal', () => {
    const def = byId(QUEST_DEFINITIONS_V1, 'qd3');
    const threeToday: QuestSnapshot = { sessions: [memory(at(2026, 8, 16)), math(at(2026, 8, 16)), memory(at(2026, 8, 16, 19))] };
    expect(evaluateQuest(def, threeToday, NOW).completed).toBe(true);
    expect(evaluateQuest(def, SNAPSHOT, NOW).completed).toBe(false);
  });

  it('empty snapshot yields zero progress and incomplete evaluations', () => {
    const results = evaluateQuests(QUEST_DEFINITIONS_V1, { sessions: [] }, NOW);
    for (const result of results) {
      expect(result.progress).toBe(0);
      expect(result.completed).toBe(false);
    }
  });

  it('is deterministic for the same inputs (no hidden state)', () => {
    expect(evaluateQuests(QUEST_DEFINITIONS_V1, SNAPSHOT, NOW)).toEqual(
      evaluateQuests(QUEST_DEFINITIONS_V1, SNAPSHOT, NOW),
    );
  });

  it('daily boundary: a session at 23:59 and one at 00:01 on the same date both count', () => {
    const def = byId(QUEST_DEFINITIONS_V1, 'qdx');
    const edge: QuestSnapshot = {
      sessions: [
        memory(at(2026, 8, 16, 23), 25),
        memory(at(2026, 8, 16, 0), 25),
        memory(at(2026, 8, 15, 23), 100), // yesterday: must not count
      ],
    };
    const result = evaluateQuest(def, edge, NOW);
    expect(result.progress).toBe(50);
    expect(result.completed).toBe(false);
  });
});
