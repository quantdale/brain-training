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
import { currentPeriodKey, periodKeyFor } from './period';
import { activityLocalDate } from '@/platform/local-calendar';
import type { QuestDefinition, QuestEvaluation } from './types';

export interface QuestSessionSample {
  /** Unix epoch ms. */
  completedAt: number;
  /** Fixed completion-day attribution; old callers may omit it. */
  completedLocalDate?: string | null;
  gameId: string;
  /** Cognitive domain (game's primary category), see `GAME_CATEGORIES`. */
  domain: string;
  /** XP earned by the session. */
  xp: number;
}

export interface QuestSnapshot {
  sessions: readonly QuestSessionSample[];
  /**
   * Lifetime totals for longterm quests. When present, longterm
   * session-count / earn-xp quests are evaluated from these aggregates
   * instead of the (possibly bounded) sample, so a capped recent window can
   * never under-report lifetime progress (Campaign 027 performance work).
   */
  lifetime?: {
    sessionCount: number;
    totalXp: number;
  };
}

/** Evaluate every definition against the snapshot for `now`'s period. */
export function evaluateQuests(
  definitions: readonly QuestDefinition[],
  snapshot: QuestSnapshot,
  now: Date,
): QuestEvaluation[] {
  const calendar = createCalendarLookup();
  return definitions.map((definition) => evaluateQuestForPeriod(
    definition, snapshot, currentPeriodKey(definition.kind, now), calendar,
  ));
}

/** Historical evaluation must not convert a valid civil date into today's zone. */
export function evaluateQuestsForDate(
  definitions: readonly QuestDefinition[],
  snapshot: QuestSnapshot,
  day: string,
): QuestEvaluation[] {
  const calendar = createCalendarLookup();
  return definitions.map((definition) => evaluateQuestForPeriod(
    definition, snapshot, periodKeyFor(definition.kind, day), calendar,
  ));
}

/** Evaluate one definition (result keeps the definition's order/semantics). */
export function evaluateQuest(
  definition: QuestDefinition,
  snapshot: QuestSnapshot,
  now: Date,
): QuestEvaluation {
  return evaluateQuestForPeriod(definition, snapshot, currentPeriodKey(definition.kind, now));
}

function evaluateQuestForPeriod(
  definition: QuestDefinition,
  snapshot: QuestSnapshot,
  periodKey: string,
  calendar: CalendarLookup = createCalendarLookup(),
): QuestEvaluation {
  const inPeriod = periodFilter(definition, periodKey, calendar);
  const sessions = snapshot.sessions.filter(inPeriod);
  const criteria = definition.criteria; // const so the union narrows inside closures

  let progress = 0;
  const lifetime = definition.kind === 'longterm' ? snapshot.lifetime : undefined;
  switch (criteria.type) {
    case 'session-count':
      progress = lifetime ? lifetime.sessionCount : sessions.length;
      break;
    case 'domain-sessions':
      progress = sessions.filter((s) => s.domain === criteria.domain).length;
      break;
    case 'earn-xp':
      progress = lifetime
        ? lifetime.totalXp
        : sessions.reduce((sum, s) => sum + s.xp, 0);
      break;
  }

  const goal = criteria.goal;
  return { questId: definition.id, periodKey, progress, goal, completed: progress >= goal };
}

/** Period membership test; `now`'s period key is derived from the same helper. */
function periodFilter(
  definition: QuestDefinition,
  periodKey: string,
  calendar: CalendarLookup,
): (sample: QuestSessionSample) => boolean {
  switch (definition.kind) {
    case 'daily':
      return (s) => calendar(s, 'daily') === periodKey;
    case 'weekly':
      return (s) => calendar(s, 'weekly') === periodKey;
    case 'longterm':
      return () => true;
  }
}

type CalendarLookup = (sample: QuestSessionSample, kind: 'daily' | 'weekly') => string | null;

/** Evaluation-local only: a global cache would freeze legacy timezone inference.
 * Calendar validation and ISO week arithmetic need not repeat for every quest.
 * Work stays lazy so lifetime-only evaluation does not inspect session dates. */
function createCalendarLookup(): CalendarLookup {
  const days = new Map<QuestSessionSample, string | null>();
  const weeks = new Map<string, string>();
  return (sample, kind) => {
    let day = days.get(sample);
    if (day === undefined) {
      day = activityLocalDate(sample);
      days.set(sample, day);
    }
    if (kind === 'daily' || day === null) return day;
    let week = weeks.get(day);
    if (week === undefined) {
      week = periodKeyFor('weekly', day);
      weeks.set(day, week);
    }
    return week;
  };
}
