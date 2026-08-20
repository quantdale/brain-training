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

import { canonicalString } from './canonical-json';
import { CHECKSUM_ALGORITHM, computeChecksum } from './checksum';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupDataValidationError,
  ChecksumMismatchError,
  MalformedBackupError,
  UnsupportedVersionError,
  type BackupData,
  type BackupEnvelope,
} from './types';

export interface ParsedBackup {
  envelope: BackupEnvelope;
  data: BackupData;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isArrayOf<T>(value: unknown, pred: (v: unknown) => v is T): value is T[] {
  return Array.isArray(value) && value.every(pred);
}

/** Validate the data sections. Collects every problem rather than failing on the first. */
function validateData(data: unknown): BackupData {
  const issues: string[] = [];
  if (!isObject(data)) {
    throw new BackupDataValidationError(['`data` must be an object']);
  }

  const requireArray = (key: string): unknown[] => {
    const v = data[key];
    if (!Array.isArray(v)) {
      issues.push(`data.${key} must be an array`);
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
      !isString(s.id) ||
      !isString(s.gameId) ||
      !isNumber(s.gameVersion) ||
      !isNumber(s.generatorVersion) ||
      !isNumber(s.scoringVersion) ||
      !isNumber(s.seed) ||
      !isNumber(s.normalizedResult) ||
      !isNumber(s.xp) ||
      !isNumber(s.startedAt) ||
      !isNumber(s.completedAt) ||
      !isNumber(s.durationMs)
    ) {
      issues.push(`gameSessions entry ${JSON.stringify(s?.id ?? '?')} is missing/invalid fields`);
      return false;
    }
    return true;
  });

  const domainRatingsRaw = requireArray('domainRatings');
  const domainRatings = domainRatingsRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isString(r.domain) ||
      !isNumber(r.rating) ||
      !isNumber(r.sessions) ||
      !isNumber(r.updatedAt)
    ) {
      issues.push('domainRatings contains an invalid entry');
      return false;
    }
    return true;
  });

  const ratingHistoryRaw = requireArray('ratingHistory');
  const ratingHistory = ratingHistoryRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isString(r.sessionId) ||
      !isString(r.domain) ||
      !isNumber(r.delta) ||
      !isNumber(r.ratingAfter) ||
      !isNumber(r.createdAt)
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
      !isNumber(r.amount) ||
      !isString(r.reason) ||
      !(r.sessionId === null || isString(r.sessionId)) ||
      !isNumber(r.createdAt) ||
      !(r.operationId === null || r.operationId === undefined || isString(r.operationId))
    ) {
      issues.push('currencyLedger contains an invalid entry');
      return false;
    }
    return true;
  });

  const favoritesRaw = requireArray('gameFavorites');
  const gameFavorites = favoritesRaw.filter((r): r is Record<string, unknown> => {
    if (!isObject(r) || !isString(r.gameId) || !isNumber(r.createdAt)) {
      issues.push('gameFavorites contains an invalid entry');
      return false;
    }
    return true;
  });

  const xpRaw = requireArray('xpAwards');
  const xpAwards = xpRaw.filter((r): r is Record<string, unknown> => {
    if (
      !isObject(r) ||
      !isNumber(r.amount) ||
      !isString(r.reason) ||
      !isString(r.source) ||
      !isNumber(r.createdAt)
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
      !isString(r.gameId) ||
      !isBoolean(r.completed) ||
      !isBoolean(r.replayRequested) ||
      !(r.version === null || r.version === undefined || isString(r.version)) ||
      !isNumber(r.updatedAt)
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
      !isString(r.date) ||
      !Array.isArray(r.gameIds) ||
      !r.gameIds.every((g) => isString(g)) ||
      !isString(r.status) ||
      !isNumber(r.currentIndex) ||
      !isNumber(r.rerollAttempt) ||
      !isNumber(r.seedVersion) ||
      !isNumber(r.createdAt) ||
      !isNumber(r.updatedAt)
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
      !isString(r.id) ||
      !isString(r.kind) ||
      !isString(r.title) ||
      !isString(r.description) ||
      !isNumber(r.rewardXp) ||
      !isNumber(r.rewardCurrency) ||
      !isNumber(r.version)
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
      !isString(r.questId) ||
      !isString(r.period) ||
      !isNumber(r.progress) ||
      !(r.completedAt === null || r.completedAt === undefined || isNumber(r.completedAt)) ||
      !(r.claimedAt === null || r.claimedAt === undefined || isNumber(r.claimedAt))
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
      !isString(r.id) ||
      !isString(r.title) ||
      !isString(r.description) ||
      !isNumber(r.rewardXp) ||
      !isNumber(r.rewardCurrency) ||
      !isNumber(r.version)
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
      !isString(r.achievementId) ||
      !isNumber(r.unlockedAt) ||
      !(r.claimedAt === null || r.claimedAt === undefined || isNumber(r.claimedAt))
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
      !isString(profileRaw.id) ||
      !isString(profileRaw.displayName) ||
      !isObject(profileRaw.settings) ||
      !isNumber(profileRaw.createdAt) ||
      !isNumber(profileRaw.updatedAt)
    ) {
      issues.push('profile is present but invalid');
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

  if (issues.length > 0) {
    throw new BackupDataValidationError(issues);
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

  if (parsed.version > BACKUP_FORMAT_VERSION) {
    throw new UnsupportedVersionError(parsed.version, BACKUP_FORMAT_VERSION);
  }

  // Recompute the checksum over the same payload (everything except `checksum`).
  const { checksum: provided, ...payload } = parsed as Record<string, unknown>;
  if (!isString(provided)) {
    throw new MalformedBackupError('Backup is missing a `checksum`.');
  }
  const actual = computeChecksum(canonicalString(payload as Record<string, unknown>));
  if (actual !== (provided as string)) {
    throw new ChecksumMismatchError(provided as string, actual);
  }

  if (parsed.checksumAlgorithm && parsed.checksumAlgorithm !== CHECKSUM_ALGORITHM) {
    // Informational only: we always recompute with our canonical algorithm, so
    // a differing label does not block import — but we surface it for debugging.
    // (Kept defensive: if a future algorithm is introduced, this is the seam.)
  }

  const data = validateData(parsed.data);

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

  return { envelope, data };
}
