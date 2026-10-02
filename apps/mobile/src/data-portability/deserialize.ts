/**
 * Import validation: parse, authenticate integrity, and structurally validate a
 * backup BEFORE any mutation occurs. Three independent rejection gates:
 *
 *   1. MalformedBackupError      — not JSON / wrong `format` / unparseable.
 *   2. UnsupportedVersionError   — `version` newer than we can read.
 *   3. ChecksumMismatchError     — payload does not match `checksum`.
 *   4. BackupDataValidationError — valid envelope, but a data section's shape
 *                                  is wrong (defends against hand-edited files).
 *
 * `parseAndValidateBackup` performs all four gates and returns the validated
 * envelope, or throws. `previewImport` and `applyImport` both call it first,
 * so mutation can never run against an untrusted payload.
 */

import { MAX_WORKOUT_GAME_IDS } from '@/workout/templates';

import { canonicalString } from './canonical-json';
import { CHECKSUM_ALGORITHM, computeChecksum } from './checksum';
import { DiagnosticsBudget, IssueRecorder } from './diagnostics-budget';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupDataValidationError,
  BackupError,
  ChecksumMismatchError,
  MalformedBackupError,
  UnsupportedVersionError,
  type BackupData,
  type BackupEnvelope,
} from './types';

export interface ParsedBackup {
  envelope: BackupEnvelope;
  data: BackupData;
  /**
   * The envelope and data EXACTLY as they appeared in the file, before
   * `validateData` narrowed them to this build's known shape (Change 070).
   *
   * This exists because of a real trap that is easy to walk into: the
   * validated `data` has, by construction, already DISCARDED every section and
   * field this build does not understand. Running forward-compatibility
   * detection on `data` therefore always reports "nothing unrecognized" —
   * it would be inspecting the post-loss state and reporting success. Detection
   * must run against the pre-validation input, which is what this carries.
   */
  raw: { envelope: Record<string, unknown>; data: Record<string, unknown> };
}

/**
 * Upper bound on accepted backup text size, in UTF-16 code units (the portable
 * proxy for bytes: UTF-8 byte length is always >= code-unit length, so any
 * rejection here is guaranteed to be a genuinely huge input). Our own exports
 * stay orders of magnitude below this even with years of sessions; the gate
 * exists so a hostile/mis-picked multi-hundred-MB file fails fast with a clear
 * error instead of OOM-ing the JS runtime inside JSON.parse.
 */
export const MAX_BACKUP_TEXT_LENGTH = 64 * 1024 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Bound attacker-controlled values echoed into validation messages (R3
 * residual). A multi-MB hostile `id` must not amplify into UI text, toast
 * detail, or logcat lines — truncate long renderings with an explicit
 * length marker. Normal short ids render verbatim, so existing message
 * contracts are unchanged.
 */
const MAX_ECHO_LENGTH = 80;
export function echoId(value: unknown): string {
  const rendered = JSON.stringify(value ?? '?');
  return rendered.length > MAX_ECHO_LENGTH
    ? `${rendered.slice(0, MAX_ECHO_LENGTH)}\u2026(${rendered.length} chars)`
    : rendered;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Validate the data sections. Collects every problem rather than failing on the
 * first, under a BOUNDED budget (Change 070).
 *
 * The previous implementation grew an unbounded `string[]`, so a size-legal
 * (64 MB) but corrupt backup with hundreds of thousands of invalid rows built a
 * message per row and then joined them all into one `Error.message`. That turns
 * a validation failure into an out-of-memory failure, and the user sees an OOM
 * instead of the reason their backup was rejected. `IssueRecorder` bounds the
 * retained set, keeps counting the rest, and makes the truncation explicit
 * (see `diagnostics-budget.ts`).
 *
 * Two classes, because they are not equally useful to a user:
 * - ROW (`push`) — a problem with one entry. Unbounded, repetitive, dropped
 *   first.
 * - STRUCTURAL (`pushStructural`) — a problem with the shape of a whole
 *   section. Bounded by the schema, and the thing a user can actually act on,
 *   so it must survive truncation.
 */
function validateData(data: unknown): BackupData {
  const issues = new IssueRecorder(new DiagnosticsBudget());
  if (!isObject(data)) {
    throw new BackupDataValidationError(['`data` must be an object']);
  }

  const requireArray = (key: string): unknown[] => {
    const v = data[key];
    if (!Array.isArray(v)) {
      issues.pushStructural(`data.${key} must be an array`);
      return [];
    }
    return v;
  };

  const sessionsRaw = requireArray('gameSessions');
  const gameSessions = sessionsRaw.filter((s): s is Record<string, unknown> => {
    if (!isObject(s)) {
      issues.push('gameSessions contains a non-object entry');
      return false;
    }
    if (
      !isNonEmptyString(s.id) ||
      !isNonEmptyString(s.gameId) ||
      !isSafeInteger(s.gameVersion) ||
      !isSafeInteger(s.generatorVersion) ||
      !isSafeInteger(s.scoringVersion) ||
      !isSafeInteger(s.seed) ||
      !hasOwn(s, 'difficulty') ||
      !hasOwn(s, 'rawResult') ||
      !isNumber(s.normalizedResult) ||
      !isSafeInteger(s.xp) ||
      !isSafeInteger(s.startedAt) ||
      !isSafeInteger(s.completedAt) ||
      !isNumber(s.durationMs) ||
      !Number.isSafeInteger(Math.round(s.durationMs))
    ) {
      issues.push(`gameSessions entry ${echoId(s?.id)} is missing/invalid fields`);
      return false;
    }
    // Range checks mirror the DB's own CHECK constraints/triggers (schema.ts):
    // a backup that violates them must be rejected with a typed, readable
    // error at validation time — not abort mid-import with an opaque SQLite
    // constraint message after the clear has already run.
    if (s.normalizedResult < 0 || s.normalizedResult > 1) {
      issues.push(
        `gameSessions entry ${echoId(s.id)} normalizedResult must be in [0, 1]`,
      );
      return false;
    }
    if (s.xp < 0) {
      issues.push(`gameSessions entry ${echoId(s.id)} xp must be nonnegative`);
      return false;
    }
    if (s.completedAt < s.startedAt) {
      issues.push(
        `gameSessions entry ${echoId(s.id)} completedAt must not precede startedAt`,
      );
      return false;
    }
    if (s.durationMs < 0) {
      issues.push(`gameSessions entry ${echoId(s.id)} durationMs must be nonnegative`);
      return false;
    }
    return true;
  });

  const domainRatingsRaw = requireArray('domainRatings');
  const domainRatings = domainRatingsRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.domain) ||
      !isSafeInteger(r.rating) ||
      !isSafeInteger(r.sessions) ||
      !isSafeInteger(r.updatedAt)
    ) {
      issues.push('domainRatings contains an invalid entry');
      return false;
    }
    // Mirrors the DB's `rating >= 0` insert/update triggers.
    if (r.rating < 0 || r.sessions < 0) {
      issues.push(`domainRatings entry "${r.domain}" rating/sessions must be nonnegative`);
      return false;
    }
    return true;
  });

  const ratingHistoryRaw = requireArray('ratingHistory');
  const ratingHistory = ratingHistoryRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.sessionId) ||
      !isNonEmptyString(r.domain) ||
      !isSafeInteger(r.delta) ||
      !isSafeInteger(r.ratingAfter) ||
      !isSafeInteger(r.createdAt)
    ) {
      issues.push('ratingHistory contains an invalid entry');
      return false;
    }
    return true;
  });

  const ledgerRaw = requireArray('currencyLedger');
  const currencyLedger = ledgerRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isSafeInteger(r.amount) ||
      !isNonEmptyString(r.reason) ||
      !(r.sessionId === null || isNonEmptyString(r.sessionId)) ||
      !isSafeInteger(r.createdAt) ||
      !(
        r.operationId === null ||
        r.operationId === undefined ||
        isNonEmptyString(r.operationId)
      )
    ) {
      issues.push('currencyLedger contains an invalid entry');
      return false;
    }
    return true;
  });

  const favoritesRaw = requireArray('gameFavorites');
  const gameFavorites = favoritesRaw.filter((r): r is Record<string, unknown> => {
    if (!isObject(r) || !isNonEmptyString(r.gameId) || !isSafeInteger(r.createdAt)) {
      issues.push('gameFavorites contains an invalid entry');
      return false;
    }
    return true;
  });

  const xpRaw = requireArray('xpAwards');
  const xpAwards = xpRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isSafeInteger(r.amount) ||
      r.amount <= 0 ||
      !isNonEmptyString(r.reason) ||
      !isNonEmptyString(r.source) ||
      !isSafeInteger(r.createdAt)
    ) {
      issues.push('xpAwards contains an invalid entry');
      return false;
    }
    return true;
  });

  const tutorialRaw = requireArray('tutorialState');
  const tutorialState = tutorialRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.gameId) ||
      !isBoolean(r.completed) ||
      !isBoolean(r.replayRequested) ||
      !(r.version === null || r.version === undefined || isString(r.version)) ||
      !isSafeInteger(r.updatedAt)
    ) {
      issues.push('tutorialState contains an invalid entry');
      return false;
    }
    return true;
  });

  const workoutsRaw = requireArray('workoutInstances');
  const workoutInstances = workoutsRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.date) ||
      !Array.isArray(r.gameIds) ||
      r.gameIds.length === 0 ||
      !r.gameIds.every((g) => isNonEmptyString(g)) ||
      !(r.status === 'active' || r.status === 'completed') ||
      !isSafeInteger(r.currentIndex) ||
      !isSafeInteger(r.rerollAttempt) ||
      !isSafeInteger(r.seedVersion) ||
      !isSafeInteger(r.createdAt) ||
      !isSafeInteger(r.updatedAt)
    ) {
      issues.push('workoutInstances contains an invalid entry');
      return false;
    }
    // Optional durable skip record (073 §3, engine 4+): must be an array of
    // in-range leg indices when present; absent (pre-skip backups) is fine and
    // means "no skips". Reject out-of-range or non-integer entries outright —
    // silently dropping one here would let a hostile backup record a skip for
    // a leg index that does not exist, or desync the position from the list.
    if (r.skippedIndices !== undefined) {
      if (!Array.isArray(r.skippedIndices)) {
        issues.push('workoutInstances contains an invalid entry');
        return false;
      }
      const legCount = r.gameIds.length;
      const valid = r.skippedIndices.every(
        (i: unknown) => isSafeInteger(i) && i >= 0 && i < legCount,
      );
      if (!valid) {
        issues.push(
          `workoutInstances entry ${echoId(r.date)} has skipped indices outside the leg list`,
        );
        return false;
      }
    }
    // A valid checksum proves integrity, not sane size: Home renders one row
    // per leg, so a hostile backup with 100k ids would freeze the app on the
    // first render after import. Reject before anything is persisted.
    if (r.gameIds.length > MAX_WORKOUT_GAME_IDS) {
      issues.push(
        `workoutInstances entry ${echoId(r.date)} has ${r.gameIds.length} game ids (the maximum is ${MAX_WORKOUT_GAME_IDS})`,
      );
      return false;
    }
    if (
      r.currentIndex < 0 ||
      r.currentIndex > r.gameIds.length ||
      r.rerollAttempt < 0 ||
      r.seedVersion < 0 ||
      r.updatedAt < r.createdAt
    ) {
      issues.push(`workoutInstances entry ${echoId(r.date)} has invalid progress metadata`);
      return false;
    }
    // Optional Workout V3 metadata (engine 3+): must be object-or-null when
    // present; absent (pre-engine-3 backups) is fine.
    if (
      r.metadata !== undefined &&
      r.metadata !== null &&
      (!isObject(r.metadata) || Array.isArray(r.metadata))
    ) {
      issues.push('workoutInstances contains an invalid entry');
      return false;
    }
    return true;
  });

  const questDefsRaw = requireArray('questDefinitions');
  const questDefinitions = questDefsRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.id) ||
      !(r.kind === 'daily' || r.kind === 'weekly' || r.kind === 'longterm') ||
      !isNonEmptyString(r.title) ||
      !isNonEmptyString(r.description) ||
      !isSafeInteger(r.rewardXp) ||
      !isSafeInteger(r.rewardCurrency) ||
      !isSafeInteger(r.version) ||
      r.rewardXp < 0 ||
      r.rewardCurrency < 0 ||
      r.version < 1
    ) {
      issues.push('questDefinitions contains an invalid entry');
      return false;
    }
    return true;
  });

  const questProgRaw = requireArray('questProgress');
  const questProgress = questProgRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.questId) ||
      !isNonEmptyString(r.period) ||
      !isSafeInteger(r.progress) ||
      r.progress < 0 ||
      !(
        r.completedAt === null ||
        r.completedAt === undefined ||
        isSafeInteger(r.completedAt)
      ) ||
      !(
        r.claimedAt === null ||
        r.claimedAt === undefined ||
        isSafeInteger(r.claimedAt)
      )
    ) {
      issues.push('questProgress contains an invalid entry');
      return false;
    }
    return true;
  });

  const achDefsRaw = requireArray('achievementDefinitions');
  const achievementDefinitions = achDefsRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.id) ||
      !isNonEmptyString(r.title) ||
      !isNonEmptyString(r.description) ||
      !isSafeInteger(r.rewardXp) ||
      !isSafeInteger(r.rewardCurrency) ||
      !isSafeInteger(r.version) ||
      r.rewardXp < 0 ||
      r.rewardCurrency < 0 ||
      r.version < 1
    ) {
      issues.push('achievementDefinitions contains an invalid entry');
      return false;
    }
    return true;
  });

  const achUnlocksRaw = requireArray('achievementUnlocks');
  const achievementUnlocks = achUnlocksRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNonEmptyString(r.achievementId) ||
      !isSafeInteger(r.unlockedAt) ||
      !(
        r.claimedAt === null ||
        r.claimedAt === undefined ||
        isSafeInteger(r.claimedAt)
      )
    ) {
      issues.push('achievementUnlocks contains an invalid entry');
      return false;
    }
    return true;
  });

  // Profile is optional (a fresh device has none), but if present it must be well-formed.
  const profileRaw = (data as Record<string, unknown>).profile;
  let profile: BackupData['profile'] = null;
  if (profileRaw !== null && profileRaw !== undefined) {
    if (
      !isObject(profileRaw) ||
      !isNonEmptyString(profileRaw.id) ||
      !isString(profileRaw.displayName) ||
      !isObject(profileRaw.settings) ||
      !isSafeInteger(profileRaw.createdAt) ||
      !isSafeInteger(profileRaw.updatedAt)
    ) {
      issues.pushStructural('profile is present but invalid');
    } else {
      profile = {
        id: profileRaw.id,
        displayName: profileRaw.displayName,
        settings: profileRaw.settings as Record<string, unknown>,
        createdAt: profileRaw.createdAt,
        updatedAt: profileRaw.updatedAt,
      };
    }
  }

  // Relational integrity: every FK-backed section must reference a definition
  // that exists in the SAME backup. Every export we produce is self-consistent
  // by construction, so a dangling reference means the file was hand-edited or
  // truncated per-section — reject it with a typed error instead of aborting
  // mid-import on a FOREIGN KEY constraint (replace mode) or silently dropping
  // rows (merge mode).
  const sessionIds = new Set(gameSessions.map((s) => s.id as string));
  for (const h of ratingHistoryRaw) {
    if (isObject(h) && isString(h.sessionId) && !sessionIds.has(h.sessionId)) {
      issues.push(
        `ratingHistory references unknown session ${echoId(h.sessionId)} (no matching gameSessions entry)`,
      );
    }
  }
  for (const e of ledgerRaw) {
    if (
      isObject(e) &&
      isString(e.sessionId) &&
      e.sessionId !== null &&
      !sessionIds.has(e.sessionId)
    ) {
      issues.push(
        `currencyLedger references unknown session ${echoId(e.sessionId)} (no matching gameSessions entry)`,
      );
    }
  }
  // quest_progress.quest_id -> quests.id and achievement_unlocks.achievement_id
  // -> achievements.id (schema.ts). Definitions are shape-validated above, so
  // the id sets only contain usable ids.
  const questIds = new Set(questDefinitions.map((q) => q.id as string));
  for (const p of questProgRaw) {
    if (isObject(p) && isString(p.questId) && !questIds.has(p.questId)) {
      issues.push(
        `questProgress references unknown quest ${echoId(p.questId)} (no matching questDefinitions entry)`,
      );
    }
  }
  const achievementIds = new Set(achievementDefinitions.map((a) => a.id as string));
  for (const u of achUnlocksRaw) {
    if (isObject(u) && isString(u.achievementId) && !achievementIds.has(u.achievementId)) {
      issues.push(
        `achievementUnlocks references unknown achievement ${echoId(u.achievementId)} (no matching achievementDefinitions entry)`,
      );
    }
  }

  if (issues.hasProblems) {
    throw new BackupDataValidationError(issues.report());
  }

  return {
    schemaVersion: isNumber(data.schemaVersion) ? (data.schemaVersion as number) : 0,
    profile,
    gameSessions: gameSessions as unknown as BackupData['gameSessions'],
    domainRatings: domainRatings as unknown as BackupData['domainRatings'],
    ratingHistory: ratingHistory as unknown as BackupData['ratingHistory'],
    currencyLedger: currencyLedger.map((r) => ({
      amount: r.amount as number,
      reason: r.reason as string,
      sessionId: (r.sessionId as string | null) ?? null,
      createdAt: r.createdAt as number,
      operationId: (r.operationId as string | null) ?? null,
    })),
    gameFavorites: gameFavorites as unknown as BackupData['gameFavorites'],
    xpAwards: xpAwards as unknown as BackupData['xpAwards'],
    tutorialState: tutorialState.map((r) => ({
      gameId: r.gameId as string,
      completed: r.completed as boolean,
      replayRequested: r.replayRequested as boolean,
      version: (r.version as string | null) ?? null,
      updatedAt: r.updatedAt as number,
    })),
    workoutInstances: workoutInstances as unknown as BackupData['workoutInstances'],
    questDefinitions: questDefinitions as unknown as BackupData['questDefinitions'],
    questProgress: questProgress.map((r) => ({
      questId: r.questId as string,
      period: r.period as string,
      progress: r.progress as number,
      completedAt: (r.completedAt as number | null) ?? null,
      claimedAt: (r.claimedAt as number | null) ?? null,
    })),
    achievementDefinitions: achievementDefinitions as unknown as BackupData['achievementDefinitions'],
    achievementUnlocks: achievementUnlocks.map((r) => ({
      achievementId: r.achievementId as string,
      unlockedAt: r.unlockedAt as number,
      claimedAt: (r.claimedAt as number | null) ?? null,
    })),
  };
}

/**
 * Parse and fully validate a backup text. Throws a typed `BackupError` on any
 * rejection gate. Returns the validated envelope + normalized data.
 */
export function parseAndValidateBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_TEXT_LENGTH) {
    throw new MalformedBackupError(
      `Backup is too large (${text.length} characters; the maximum supported size is ${MAX_BACKUP_TEXT_LENGTH}).`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new MalformedBackupError('Backup is not valid JSON.', error);
  }

  if (!isObject(parsed)) {
    throw new MalformedBackupError('Backup root must be a JSON object.');
  }

  if (parsed.format !== BACKUP_FORMAT) {
    throw new MalformedBackupError(
      `Unrecognized backup format: ${String(parsed.format)} (expected "${BACKUP_FORMAT}").`,
    );
  }

  if (!isNumber(parsed.version)) {
    throw new MalformedBackupError('Backup is missing a numeric `version`.');
  }
  // Only whole, positive format versions have ever existed. Zero, negative,
  // and fractional values are not "very old backups" — they are corrupt or
  // forged envelopes and must be rejected with a clear error rather than
  // silently read as if they were the current format.
  if (!Number.isSafeInteger(parsed.version) || parsed.version < 1) {
    throw new MalformedBackupError(
      `Backup version ${String(parsed.version)} is not a valid format version (expected a positive integer).`,
    );
  }

  if (parsed.version > BACKUP_FORMAT_VERSION) {
    throw new UnsupportedVersionError(parsed.version, BACKUP_FORMAT_VERSION);
  }

  // Recompute the checksum over the same payload (everything except `checksum`).
  const { checksum: provided, ...payload } = parsed as Record<string, unknown>;
  if (!isString(provided)) {
    throw new MalformedBackupError('Backup is missing a `checksum`.');
  }
  // The canonical writer is recursive, so a deeply nested payload (JSON.parse
  // itself accepts ~100k levels) throws RangeError before shape validation
  // could reject it. Convert ANY non-Backup failure here into the existing
  // typed malformed-backup error: a validation failure must never surface as
  // an untyped stack overflow.
  let actual: string;
  try {
    actual = computeChecksum(canonicalString(payload as Record<string, unknown>));
  } catch (error) {
    if (error instanceof BackupError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new MalformedBackupError(
      `Backup payload could not be canonicalized for checksum verification: ${detail}`,
      error,
    );
  }
  if (actual !== (provided as string)) {
    throw new ChecksumMismatchError(provided as string, actual);
  }

  if (parsed.checksumAlgorithm && parsed.checksumAlgorithm !== CHECKSUM_ALGORITHM) {
    // Informational only: we always recompute with our canonical algorithm, so
    // a differing label does not block import — but we surface it for debugging.
    // (Kept defensive: if a future algorithm is introduced, this is the seam.)
  }

  const data = validateData(parsed.data);

  // Captured AFTER the integrity and version gates (so only a backup this build
  // would actually import reaches it) but BEFORE `validateData` narrows the
  // shape — this is the "what did the file actually contain" view that
  // forward-compatibility detection needs. `parsed` is the live
  // `JSON.parse` result and is not mutated by validation.
  const raw = {
    envelope: parsed as Record<string, unknown>,
    data: isObject(parsed.data) ? parsed.data : {},
  };

  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: parsed.version,
    createdAt: isNumber(parsed.createdAt) ? (parsed.createdAt as number) : 0,
    ...(isString(parsed.appVersion) ? { appVersion: parsed.appVersion } : {}),
    schemaVersion: isNumber(parsed.schemaVersion) ? (parsed.schemaVersion as number) : 0,
    checksum: provided as string,
    checksumAlgorithm: isString(parsed.checksumAlgorithm)
      ? (parsed.checksumAlgorithm as string)
      : CHECKSUM_ALGORITHM,
    data,
  };

  return { envelope, data, raw };
}
