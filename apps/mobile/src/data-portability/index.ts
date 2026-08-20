/**
 * Public entry point for the local data-portability engine.
 *
 * The engine is pure and backend-agnostic: it reads/writes through the
 * canonical `AppDatabase` facade and serializes to a versioned, checksummed
 * text envelope. All mutation is transactional and validates the backup before
 * touching data.
 */

export { exportLocalData, readSnapshot, serializeBackup, type ExportOptions } from './serialize';
export { parseAndValidateBackup, type ParsedBackup } from './deserialize';
export {
  applyImport,
  buildDatabaseFromBackup,
} from './apply';
export { previewImport } from './preview';
export { wipeLocalData, countLocalData, type LocalDataCounts } from './wipe';
export {
  createMemoryTransport,
  defaultBackupName,
  type BackupTransport,
} from './transport';
export {
  canonicalString,
  canonicalize,
} from './canonical-json';
export { sha256Hex, computeChecksum, CHECKSUM_ALGORITHM } from './checksum';
export {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupError,
  MalformedBackupError,
  UnsupportedVersionError,
  ChecksumMismatchError,
  BackupDataValidationError,
  type BackupEnvelope,
  type BackupData,
  type BackupProfile,
  type BackupGameSession,
  type BackupDomainRating,
  type BackupRatingHistory,
  type BackupLedgerEntry,
  type BackupFavorite,
  type BackupXpAward,
  type BackupTutorialState,
  type BackupWorkoutInstance,
  type BackupQuestDefinition,
  type BackupQuestProgress,
  type BackupAchievementDefinition,
  type BackupAchievementUnlock,
  type ImportMode,
} from './types';
export {
  emptyCounters,
  type ImportCounters,
  type ImportResult,
  type ImportPreview,
  type BackupMeta,
} from './report';
