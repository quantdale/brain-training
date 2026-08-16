/**
 * Pure quest evaluation (campaign 003, WP-3A). No db access by design: the
 * caller (app wiring) builds the session snapshot from the session repo and
 * passes an injectable clock; the orchestrator decides when to persist
 * progress rows (`recordProgress` is monotonic-MAX by repo contract).
 *
 * Period semantics: daily counts only sessions on the same local calendar
 * date as `now`; weekly only sessions in the same ISO week; longterm counts
 * the whole snapshot. `periodKey` in each evaluation matches the db progress
 * row key (`periodKeyFor`), so persisted rows and evaluations always agree.
 */
import { currentPeriodKey, isoWeekKey, localDateKey } from './period';
import type { QuestDefinition, QuestEvaluation } from './types';

export interface QuestSessionSample {
  /** Unix epoch ms. */
  completedAt: number;
  gameId: string;
  /** Cognitive domain (game's primary category), see `GAME_CATEGORIES`. */
  domain: string;
  /** XP earned by the session. */
  xp: number;
}

export interface QuestSnapshot {
  sessions: readonly QuestSessionSample[];
}

/** Evaluate every definition against the snapshot for `now`'s period. */
export function evaluateQuests(
  definitions: readonly QuestDefinition[],
  snapshot: QuestSnapshot,
  now: Date,
): QuestEvaluation[] {
  return definitions.map((definition) => evaluateQuest(definition, snapshot, now));
}

/** Evaluate one definition (result keeps the definition's order/semantics). */
export function evaluateQuest(
  definition: QuestDefinition,
  snapshot: QuestSnapshot,
  now: Date,
): QuestEvaluation {
  const periodKey = currentPeriodKey(definition.kind, now);
  const inPeriod = periodFilter(definition, periodKey);
  const sessions = snapshot.sessions.filter(inPeriod);
  const criteria = definition.criteria; // const so the union narrows inside closures

  let progress = 0;
  switch (criteria.type) {
    case 'session-count':
      progress = sessions.length;
      break;
    case 'domain-sessions':
      progress = sessions.filter((s) => s.domain === criteria.domain).length;
      break;
    case 'earn-xp':
      progress = sessions.reduce((sum, s) => sum + s.xp, 0);
      break;
  }

  const goal = criteria.goal;
  return { questId: definition.id, periodKey, progress, goal, completed: progress >= goal };
}

/** Period membership test; `now`'s period key is derived from the same helper. */
function periodFilter(
  definition: QuestDefinition,
  periodKey: string,
): (sample: QuestSessionSample) => boolean {
  switch (definition.kind) {
    case 'daily':
      return (s) => localDateKey(new Date(s.completedAt)) === periodKey;
    case 'weekly':
      return (s) => isoWeekKey(new Date(s.completedAt)) === periodKey;
    case 'longterm':
      return () => true;
  }
}
