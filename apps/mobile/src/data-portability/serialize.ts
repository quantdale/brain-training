/**
 * Export: read the authoritative local snapshot from the live database and
 * wrap it in a versioned, checksummed backup envelope.
 *
 * Reads run inside one read transaction so the snapshot is internally
 * consistent. Raw SQL is used (not the repository accessors) so we capture
 * every column the export needs — notably the ledger `operation_id`, which the
 * repository's `LedgerEntry` omits but which import deduplication relies on.
 *
 * Campaign 010 (debt D2): serialization is SINGLE-PASS. The legacy pipeline
 * canonicalized the whole envelope twice (once for the checksum, once for the
 * output text — measured ~2.4s frozen JS @5k sessions) and deep-copied every
 * value along the way. `serializeEnvelopeWithChecksum` now walks the payload
 * once, streaming canonical chunks into BOTH the output text and an
 * incremental SHA-256, so export costs one walk, zero deep copies, and one
 * hash. Output bytes are identical to the legacy writer.
 */

import { SCHEMA_VERSION, type AppDatabase } from '@/db';
import { canonicalChunks, writeCanonicalJson } from './canonical-json';
import { CHECKSUM_ALGORITHM, Sha256 } from './checksum';
import {
  BACKUP_ENGINE_VERSION,
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
  type BackupManifest,
  type BackupProfile,
  type BackupQuestDefinition,
  type BackupQuestProgress,
  type BackupRatingHistory,
  type BackupSectionCounts,
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
  workouts: `SELECT date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json FROM workout_instances ORDER BY date ASC`,
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
        metadata_json: string | null;
      }>(RAW_SELECT.workouts)
    ).map((r) => {
      // Parsed Workout V2 provenance (schema v10). Malformed cells degrade to
      // null exactly like the db reader does — provenance is never load-bearing.
      const rawMetadata: unknown = parseJson(r.metadata_json, null);
      const metadata =
        rawMetadata !== null &&
        typeof rawMetadata === 'object' &&
        !Array.isArray(rawMetadata)
          ? (rawMetadata as Record<string, unknown>)
          : null;
      return {
        date: r.date,
        gameIds: parseGameIds(r.game_ids_json),
        status: r.status,
        currentIndex: r.current_index,
        rerollAttempt: r.reroll_attempt,
        seedVersion: r.seed_version,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        metadata,
      };
    });

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

/**
 * Build the checksum-protected manifest summarizing `data` (campaign 010
 * metadata improvement). Derived purely from the snapshot so it is always
 * consistent with the envelope it ships in.
 */
export function buildBackupManifest(data: BackupData): BackupManifest {
  const sections: BackupSectionCounts = {
    gameSessions: data.gameSessions.length,
    domainRatings: data.domainRatings.length,
    ratingHistory: data.ratingHistory.length,
    currencyLedger: data.currencyLedger.length,
    gameFavorites: data.gameFavorites.length,
    xpAwards: data.xpAwards.length,
    tutorialState: data.tutorialState.length,
    workoutInstances: data.workoutInstances.length,
    questDefinitions: data.questDefinitions.length,
    questProgress: data.questProgress.length,
    achievementDefinitions: data.achievementDefinitions.length,
    achievementUnlocks: data.achievementUnlocks.length,
    hasProfile: data.profile !== null,
  };
  const totalRecords =
    sections.gameSessions +
    sections.domainRatings +
    sections.ratingHistory +
    sections.currencyLedger +
    sections.gameFavorites +
    sections.xpAwards +
    sections.tutorialState +
    sections.workoutInstances +
    sections.questDefinitions +
    sections.questProgress +
    sections.achievementDefinitions +
    sections.achievementUnlocks +
    (sections.hasProfile ? 1 : 0);
  return {
    generatedBy: `data-portability/${BACKUP_ENGINE_VERSION}`,
    sections,
    totalRecords,
  };
}

/** Envelope minus its `checksum` — the exact input the checksum is defined over. */
export type BackupEnvelopePayload = Omit<BackupEnvelope, 'checksum'>;

/** Result of the single-pass envelope serialization. */
export interface SerializedBackupText {
  /** Canonical envelope text, `checksum` member included (this is THE export text). */
  text: string;
  /** Checksum over the canonical payload (everything except `checksum`). */
  checksum: string;
  /**
   * The same text as emitted chunks (`chunks.join('') === text`). Callers that
   * stream to a file can consume these directly and skip materializing the
   * joined string at all.
   */
  chunks: string[];
}

/**
 * Serialize an envelope payload to canonical text AND compute its checksum in
 * ONE pass over the data.
 *
 * Byte contract: `text` is exactly what the legacy two-step writer produced —
 * `canonicalString({ ...payload, checksum })` where
 * `checksum === computeChecksum(canonicalString(payload))`. The trick: the
 * `checksum` member participates in top-level key ordering from the start, but
 * its VALUE is emitted as an empty placeholder chunk that is filled in after
 * the digest, and NONE of its tokens enter the hash.
 *
 * Campaign 011 regression guard (checksum comma bug): output text and digest
 * input diverge around `checksum` (`A,CHECKSUM,B` in the text hashes as
 * `A,B`). Output commas are emitted at every member boundary; only commas
 * tying two PAYLOAD members together enter the digest. Hashing a checksum-
 * adjacent comma (or dropping an output comma after a leading `checksum`)
 * either corrupts every export's digest or emits unparseable JSON — both were
 * real regressions during this fix, now pinned by serializer.test.ts.
 */
export function serializeEnvelopeWithChecksum(
  payload: BackupEnvelopePayload,
): SerializedBackupText {
  const hasher = new Sha256();
  const chunks: string[] = [];
  let checksumValueIndex = -1;

  // Hashed emit: chunk goes into the output text AND the checksum input.
  const emitHashed = (chunk: string) => {
    chunks.push(chunk);
    hasher.update(chunk);
  };
  // Unhashed emit: output-text-only (the checksum member itself).
  const emitTextOnly = (chunk: string) => {
    chunks.push(chunk);
  };

  const record = payload as unknown as Record<string, unknown>;
  // Undefined-valued members are dropped from both text and hash, matching
  // JSON.stringify semantics of the legacy writer.
  const keys = Object.keys(record).filter((k) => record[k] !== undefined);
  if (!keys.includes('checksum')) {
    keys.push('checksum');
  }
  keys.sort();

  emitHashed('{');
  let hashedMembers = 0; // payload members emitted into the hash so far
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === 'checksum') {
      // Output-text-only member. Its preceding comma (if any) separates two
      // output members but does NOT exist in the hashed legacy payload text;
      // never feed it to the hasher.
      if (i > 0) {
        emitTextOnly(',');
      }
      emitTextOnly('"checksum"');
      emitTextOnly(':');
      checksumValueIndex = chunks.length;
      emitTextOnly(''); // placeholder, replaced with the digest below
      continue;
    }
    if (i > 0) {
      // Output text ALWAYS needs this comma. Whether it is also hashed
      // depends on the legacy payload text (`A,CHECKSUM,B` hashes as `A,B`):
      // only a comma tying this member to a PRECEDING PAYLOAD member enters
      // the digest. When `checksum` sorts first, the comma exists solely in
      // the output and must stay out of the hash.
      if (hashedMembers > 0) {
        emitHashed(',');
      } else {
        emitTextOnly(',');
      }
    }
    emitHashed(JSON.stringify(key));
    emitHashed(':');
    writeCanonicalJson(record[key], emitHashed);
    hashedMembers += 1;
  }
  emitHashed('}');

  const checksum = hasher.digestHex();
  chunks[checksumValueIndex] = `"${checksum}"`;
  return { text: chunks.join(''), checksum, chunks };
}

interface ExportPayloadOptions {
  appVersion?: string;
  now: () => number;
}

function buildExportPayload(data: BackupData, options: ExportPayloadOptions): BackupEnvelopePayload {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    createdAt: options.now(),
    ...(options.appVersion ? { appVersion: options.appVersion } : {}),
    schemaVersion: SCHEMA_VERSION,
    engineVersion: BACKUP_ENGINE_VERSION,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    manifest: buildBackupManifest(data),
    data,
  };
}

/**
 * Produce a complete, checksummed backup envelope from the live database.
 * The returned object is JSON-serializable; `serializeBackup` turns it into
 * the on-disk text form with a deterministic layout.
 *
 * Prefer {@link exportLocalDataBundle} when the caller also needs the text:
 * it reuses the SAME single serialization pass instead of walking the data a
 * second time.
 */
export async function exportLocalData(
  db: AppDatabase,
  options: ExportOptions = {},
): Promise<BackupEnvelope> {
  const now = options.now ?? (() => Date.now());
  const data = await readSnapshot(db);
  const payload = buildExportPayload(data, { ...options, now });
  const { checksum } = serializeEnvelopeWithChecksum(payload);
  return { ...payload, checksum };
}

/** Envelope + ready-to-share text produced by ONE snapshot + ONE serialization pass. */
export interface ExportedBackupBundle {
  envelope: BackupEnvelope;
  /**
   * Canonical on-disk/share text. Identical to `serializeBackup(envelope)` —
   * just computed without a second full pass over the data.
   */
  text: string;
}

/**
 * Single-pass variant of {@link exportLocalData} that also returns the
 * serialized backup text. This is the memory- and CPU-conscious path for the
 * production export flow (large backups are walked exactly once).
 */
export async function exportLocalDataBundle(
  db: AppDatabase,
  options: ExportOptions = {},
): Promise<ExportedBackupBundle> {
  const now = options.now ?? (() => Date.now());
  const data = await readSnapshot(db);
  const payload = buildExportPayload(data, { ...options, now });
  const { text, checksum } = serializeEnvelopeWithChecksum(payload);
  return { envelope: { ...payload, checksum }, text };
}

/**
 * Serialize an envelope to deterministic, stable text (sorted keys, no extra
 * whitespace). Single-pass since campaign 010: no intermediate deep copy, and
 * the already-stored `checksum` is emitted verbatim (never recomputed).
 */
export function serializeBackup(envelope: BackupEnvelope): string {
  return canonicalChunks(envelope).join('');
}

/**
 * Chunked form of {@link serializeBackup}: the canonical text as an array of
 * chunks. Feeding these to `FileBackupTransport.writeBackupChunks` streams the
 * backup to disk in bounded batches WITHOUT ever materializing the joined
 * multi-megabyte string in the JS heap.
 */
export function serializeBackupChunks(envelope: BackupEnvelope): string[] {
  return canonicalChunks(envelope);
}
