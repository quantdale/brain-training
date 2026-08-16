/**
 * Quests/achievements engine (campaign 003, WP-3A, constitution §18).
 *
 * Pure evaluation + reward application; no UI. The orchestrator seeds
 * `QUEST_DEFINITIONS_V1` at startup (`quests.upsertDefinition(
 * toDbQuestDefinition(d))`), builds session snapshots from the session repo,
 * persists progress via `quests.recordProgress` when it changes, and calls
 * `applyQuestReward` when the player claims.
 */
export type {
  QuestId,
  QuestKind,
  QuestCriteria,
  QuestReward,
  QuestDefinition,
  QuestEvaluation,
} from './types';
export { QUEST_DEFINITIONS_V1 } from './definitions';
export {
  periodKeyFor,
  currentPeriodKey,
  localDateKey,
  isoWeekKey,
  isoWeekOf,
  LONGTERM_PERIOD_KEY,
} from './period';
export type { IsoWeek } from './period';
export { evaluateQuests, evaluateQuest } from './evaluate';
export type { QuestSnapshot, QuestSessionSample } from './evaluate';
export { applyQuestReward, toDbQuestDefinition, QuestNotCompleteError } from './rewards';
export type { QuestRewardResult } from './rewards';
