/**
 * Backup envelope schema + typed errors for the local data-portability engine.
 *
 * The envelope is the on-disk/text format of an export. It is versioned
 * (`version`) and carries a checksum over its canonical payload so corruption
 * is detected before any mutation is attempted (constitution §7: "merge or
 * replace restore with validation/preview").
 */

import type { Profile, GameSessionRecord, LedgerEntry } from '@/db';
import type { DomainRating, RatingHistoryEntry } from '@/db';

/** Highest backup-format version this engine can read and write. */
export const BACKUP_FORMAT_VERSION = 1;

/** Envelope `format` discriminator — rejects anything that is not our backup. */
export const BACKUP_FORMAT = 'brain-training-backup';

/* ------------------------------------------------------------------ */
/* Canonical data snapshot (everything authoritative the app stores).  */
/* ------------------------------------------------------------------ */

export interface BackupProfile {
  id: string;
  displayName: string;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface BackupGameSession {
  id: string;
  gameId: string;
  gameVersion: number;
  generatorVersion: number;
  scoringVersion: number;
  seed: number;
  difficulty: unknown;
  rawResult: unknown;
  normalizedResult: number;
  xp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

export interface BackupDomainRating {
  domain: string;
  rating: number;
  sessions: number;
  updatedAt: number;
}

export interface BackupRatingHistory {
  sessionId: string;
  domain: string;
  delta: number;
  ratingAfter: number;
  createdAt: number;
}

export interface BackupLedgerEntry {
  amount: number;
  reason: string;
  sessionId: string | null;
  createdAt: number;
  operationId: string | null;
}

export interface BackupFavorite {
  gameId: string;
  createdAt: number;
}

export interface BackupXpAward {
  amount: number;
  reason: string;
  source: string;
  createdAt: number;
}

export interface BackupTutorialState {
  gameId: string;
  completed: boolean;
  replayRequested: boolean;
  version: string | null;
  updatedAt: number;
}

export interface BackupWorkoutInstance {
  date: string;
  gameIds: string[];
  status: string;
  currentIndex: number;
  rerollAttempt: number;
  seedVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface BackupQuestDefinition {
  id: string;
  kind: string;
  title: string;
  description: string;
  criteria: unknown;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

export interface BackupQuestProgress {
  questId: string;
  period: string;
  progress: number;
  completedAt: number | null;
  claimedAt: number | null;
}

export interface BackupAchievementDefinition {
  id: string;
  title: string;
  description: string;
  criteria: unknown;
  rewardXp: number;
  rewardCurrency: number;
  version: number;
}

export interface BackupAchievementUnlock {
  achievementId: string;
  unlockedAt: number;
  claimedAt: number | null;
}

/**
 * The full authoritative snapshot. Every table in the SQLite model maps to one
 * field here. `schemaVersion` records the source DB schema version for
 * provenance; it is informational and never blocks an import.
 */
export interface BackupData {
  schemaVersion: number;
  profile: BackupProfile | null;
  gameSessions: BackupGameSession[];
  domainRatings: BackupDomainRating[];
  ratingHistory: BackupRatingHistory[];
  currencyLedger: BackupLedgerEntry[];
  gameFavorites: BackupFavorite[];
  xpAwards: BackupXpAward[];
  tutorialState: BackupTutorialState[];
  workoutInstances: BackupWorkoutInstance[];
  questDefinitions: BackupQuestDefinition[];
  questProgress: BackupQuestProgress[];
  achievementDefinitions: BackupAchievementDefinition[];
  achievementUnlocks: BackupAchievementUnlock[];
}

/** The serialized + integrity-protected backup envelope. */
export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Unix epoch ms when the export was produced. */
  createdAt: number;
  /** Source app version string, if known (provenance only). */
  appVersion?: string;
  /** Source DB schema version (provenance only). */
  schemaVersion: number;
  /** Checksum over the canonical payload (everything except `checksum`). */
  checksum: string;
  checksumAlgorithm: string;
  data: BackupData;
}

/* ------------------------------------------------------------------ */
/* Typed errors — all import rejection paths throw one of these.      */
/* ------------------------------------------------------------------ */

/** Base class for all backup-related errors. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** The text is not a parseable backup envelope at all (truncated, garbage, wrong format). */
export class MalformedBackupError extends BackupError {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MalformedBackupError';
    this.cause = cause;
  }
}

/** The envelope declares a `version` newer than this engine supports. */
export class UnsupportedVersionError extends BackupError {
  readonly backupVersion: number;
  readonly supportedVersion: number;
  constructor(backupVersion: number, supportedVersion: number) {
    super(
      `Backup format version ${backupVersion} is newer than the supported version ${supportedVersion}. ` +
        `Update the app before restoring this backup.`,
    );
    this.name = 'UnsupportedVersionError';
    this.backupVersion = backupVersion;
    this.supportedVersion = supportedVersion;
  }
}

/** The recomputed checksum does not match the envelope's `checksum`. */
export class ChecksumMismatchError extends BackupError {
  readonly expected: string;
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super('Backup checksum mismatch — the file is corrupt or tampered with.');
    this.name = 'ChecksumMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

/** The envelope is structurally valid but a data section fails validation. */
export class BackupDataValidationError extends BackupError {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Backup data failed validation: ${issues.join('; ')}`);
    this.name = 'BackupDataValidationError';
    this.issues = issues;
  }
}

export type ImportMode = 'merge' | 'replace';

export type { Profile, GameSessionRecord, LedgerEntry, DomainRating, RatingHistoryEntry };
