/**
 * Export: read the authoritative local snapshot from the live database and
 * wrap it in a versioned, checksummed backup envelope.
 *
 * Reads run inside one read transaction so the snapshot is internally
 * consistent. Raw SQL is used (not the repository accessors) so we capture
 * every column the export needs — notably the ledger `operation_id`, which the
 * repository's `LedgerEntry` omits but which import deduplication relies on.
 */

import { SCHEMA_VERSION, type AppDatabase } from '@/db';
import { canonicalString } from './canonical-json';
import { CHECKSUM_ALGORITHM, computeChecksum } from './checksum';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupAchievementDefinition,
  type BackupAchievementUnlock,
  type BackupData,
  type BackupDomainRating,
  type BackupEnvelope,
  type BackupFavorite,
  type BackupGameSession,
  type BackupLedgerEntry,
  type BackupProfile,
  type BackupQuestDefinition,
  type BackupQuestProgress,
  type BackupRatingHistory,
  type BackupTutorialState,
  type BackupWorkoutInstance,
  type BackupXpAward,
} from './types';

export interface ExportOptions {
  /** Source app version string for provenance (optional). */
  appVersion?: string;
  /** Injectable clock (Unix epoch ms) for deterministic tests. */
  now?: () => number;
}

const RAW_SELECT = {
  profile: `SELECT id, display_name, settings_json, created_at, updated_at FROM profile`,
  sessions: `SELECT * FROM game_sessions ORDER BY completed_at ASC, id ASC`,
  domainRatings: `SELECT domain, rating, sessions, updated_at FROM domain_ratings ORDER BY domain ASC`,
  ratingHistory: `SELECT session_id, domain, delta, rating_after, created_at FROM rating_history ORDER BY id ASC`,
  ledger: `SELECT amount, reason, session_id, created_at, operation_id FROM currency_ledger ORDER BY id ASC`,
  favorites: `SELECT game_id, created_at FROM game_favorites ORDER BY created_at ASC, game_id ASC`,
  xpAwards: `SELECT amount, reason, source, created_at FROM xp_awards ORDER BY id ASC`,
  tutorial: `SELECT game_id, completed, replay_requested, version, updated_at FROM tutorial_state ORDER BY game_id ASC`,
  workouts: `SELECT date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at FROM workout_instances ORDER BY date ASC`,
  quests: `SELECT id, kind, title, description, criteria_json, reward_xp, reward_currency, version FROM quests ORDER BY id ASC`,
  questProgress: `SELECT quest_id, period, progress, completed_at, claimed_at FROM quest_progress ORDER BY quest_id ASC, period ASC`,
  achievements: `SELECT id, title, description, criteria_json, reward_xp, reward_currency, version FROM achievements ORDER BY id ASC`,
  achievementUnlocks: `SELECT achievement_id, unlocked_at, claimed_at FROM achievement_unlocks ORDER BY achievement_id ASC`,
};

function parseJson(text: string | null | undefined, fallback: unknown): unknown {
  if (text == null) {
    return fallback;
  }
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function parseGameIds(text: string | null): string[] {
  const parsed = parseJson(text, []);
  if (Array.isArray(parsed)) {
    return parsed.filter((g): g is string => typeof g === 'string');
  }
  return [];
}

interface RawProfileRow {
  id: string;
  display_name: string;
  settings_json: string;
  created_at: number;
  updated_at: number;
}
interface RawSessionRow {
  id: string;
  game_id: string;
  game_version: number;
  generator_version: number;
  scoring_version: number;
  seed: number;
  difficulty_json: string;
  raw_result_json: string;
  normalized_result: number;
  xp: number;
  started_at: number;
  completed_at: number;
  duration_ms: number;
}

/**
 * Capture the full authoritative snapshot from `db`. Runs inside a read
 * transaction so the returned data is a consistent point-in-time view.
 */
export async function readSnapshot(db: AppDatabase): Promise<BackupData> {
  return db.transaction(async (txn) => {
    const profileRow = await txn.get<RawProfileRow>(RAW_SELECT.profile);
    const profile: BackupProfile | null = profileRow
      ? {
          id: profileRow.id,
          displayName: profileRow.display_name,
          settings: parseJson(profileRow.settings_json, {}) as Record<string, unknown>,
          createdAt: profileRow.created_at,
          updatedAt: profileRow.updated_at,
        }
      : null;

    const sessionRows = await txn.all<RawSessionRow>(RAW_SELECT.sessions);
    const gameSessions: BackupGameSession[] = sessionRows.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      gameVersion: r.game_version,
      generatorVersion: r.generator_version,
      scoringVersion: r.scoring_version,
      seed: r.seed,
      difficulty: parseJson(r.difficulty_json, null),
      rawResult: parseJson(r.raw_result_json, null),
      normalizedResult: r.normalized_result,
      xp: r.xp,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      durationMs: r.duration_ms,
    }));

    const domainRatings: BackupDomainRating[] = (
      await txn.all<{ domain: string; rating: number; sessions: number; updated_at: number }>(
        RAW_SELECT.domainRatings,
      )
    ).map((r) => ({
      domain: r.domain,
      rating: r.rating,
      sessions: r.sessions,
      updatedAt: r.updated_at,
    }));

    const ratingHistory: BackupRatingHistory[] = (
      await txn.all<{
        session_id: string;
        domain: string;
        delta: number;
        rating_after: number;
        created_at: number;
      }>(RAW_SELECT.ratingHistory)
    ).map((r) => ({
      sessionId: r.session_id,
      domain: r.domain,
      delta: r.delta,
      ratingAfter: r.rating_after,
      createdAt: r.created_at,
    }));

    const currencyLedger: BackupLedgerEntry[] = (
      await txn.all<{
        amount: number;
        reason: string;
        session_id: string | null;
        created_at: number;
        operation_id: string | null;
      }>(RAW_SELECT.ledger)
    ).map((r) => ({
      amount: r.amount,
      reason: r.reason,
      sessionId: r.session_id,
      createdAt: r.created_at,
      operationId: r.operation_id,
    }));

    const gameFavorites: BackupFavorite[] = (
      await txn.all<{ game_id: string; created_at: number }>(RAW_SELECT.favorites)
    ).map((r) => ({ gameId: r.game_id, createdAt: r.created_at }));

    const xpAwards: BackupXpAward[] = (
      await txn.all<{ amount: number; reason: string; source: string; created_at: number }>(
        RAW_SELECT.xpAwards,
      )
    ).map((r) => ({
      amount: r.amount,
      reason: r.reason,
      source: r.source,
      createdAt: r.created_at,
    }));

    const tutorialState: BackupTutorialState[] = (
      await txn.all<{
        game_id: string;
        completed: number;
        replay_requested: number;
        version: string | null;
        updated_at: number;
      }>(RAW_SELECT.tutorial)
    ).map((r) => ({
      gameId: r.game_id,
      completed: r.completed === 1,
      replayRequested: r.replay_requested === 1,
      version: r.version,
      updatedAt: r.updated_at,
    }));

    const workoutInstances: BackupWorkoutInstance[] = (
      await txn.all<{
        date: string;
        game_ids_json: string;
        status: string;
        current_index: number;
        reroll_attempt: number;
        seed_version: number;
        created_at: number;
        updated_at: number;
      }>(RAW_SELECT.workouts)
    ).map((r) => ({
      date: r.date,
      gameIds: parseGameIds(r.game_ids_json),
      status: r.status,
      currentIndex: r.current_index,
      rerollAttempt: r.reroll_attempt,
      seedVersion: r.seed_version,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const questDefinitions: BackupQuestDefinition[] = (
      await txn.all<{
        id: string;
        kind: string;
        title: string;
        description: string;
        criteria_json: string;
        reward_xp: number;
        reward_currency: number;
        version: number;
      }>(RAW_SELECT.quests)
    ).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      criteria: parseJson(r.criteria_json, null),
      rewardXp: r.reward_xp,
      rewardCurrency: r.reward_currency,
      version: r.version,
    }));

    const questProgress: BackupQuestProgress[] = (
      await txn.all<{
        quest_id: string;
        period: string;
        progress: number;
        completed_at: number | null;
        claimed_at: number | null;
      }>(RAW_SELECT.questProgress)
    ).map((r) => ({
      questId: r.quest_id,
      period: r.period,
      progress: r.progress,
      completedAt: r.completed_at,
      claimedAt: r.claimed_at,
    }));

    const achievementDefinitions: BackupAchievementDefinition[] = (
      await txn.all<{
        id: string;
        title: string;
        description: string;
        criteria_json: string;
        reward_xp: number;
        reward_currency: number;
        version: number;
      }>(RAW_SELECT.achievements)
    ).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      criteria: parseJson(r.criteria_json, null),
      rewardXp: r.reward_xp,
      rewardCurrency: r.reward_currency,
      version: r.version,
    }));

    const achievementUnlocks: BackupAchievementUnlock[] = (
      await txn.all<{ achievement_id: string; unlocked_at: number; claimed_at: number | null }>(
        RAW_SELECT.achievementUnlocks,
      )
    ).map((r) => ({
      achievementId: r.achievement_id,
      unlockedAt: r.unlocked_at,
      claimedAt: r.claimed_at,
    }));

    return {
      schemaVersion: SCHEMA_VERSION,
      profile,
      gameSessions,
      domainRatings,
      ratingHistory,
      currencyLedger,
      gameFavorites,
      xpAwards,
      tutorialState,
      workoutInstances,
      questDefinitions,
      questProgress,
      achievementDefinitions,
      achievementUnlocks,
    };
  });
}

function buildPayload(
  fields: Omit<BackupEnvelope, 'checksum'>,
): Omit<BackupEnvelope, 'checksum'> {
  return fields;
}

/**
 * Produce a complete, checksummed backup envelope from the live database.
 * The returned object is JSON-serializable; `serializeBackup` turns it into
 * the on-disk text form with a deterministic layout.
 */
export async function exportLocalData(
  db: AppDatabase,
  options: ExportOptions = {},
): Promise<BackupEnvelope> {
  const now = options.now ?? (() => Date.now());
  const data = await readSnapshot(db);

  const withoutChecksum = buildPayload({
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    createdAt: now(),
    ...(options.appVersion ? { appVersion: options.appVersion } : {}),
    schemaVersion: SCHEMA_VERSION,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    data,
  });

  const checksum = computeChecksum(canonicalString(withoutChecksum as unknown as Record<string, unknown>));

  return { ...withoutChecksum, checksum, checksumAlgorithm: CHECKSUM_ALGORITHM };
}

/** Serialize an envelope to deterministic, stable text (sorted keys, no extra whitespace). */
export function serializeBackup(envelope: BackupEnvelope): string {
  return canonicalString(envelope as unknown as Record<string, unknown>);
}
