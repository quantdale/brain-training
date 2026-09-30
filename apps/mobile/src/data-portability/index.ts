/**
 * Public entry point for the local data-portability engine.
 *
 * The engine is pure and backend-agnostic: it reads/writes through the
 * canonical `AppDatabase` facade and serializes to a versioned, checksummed
 * text envelope. All mutation is transactional and validates the backup before
 * touching data.
 */

export {
  exportLocalData,
  exportLocalDataBundle,
  readSnapshot,
  serializeBackup,
  type ExportOptions,
} from './serialize';
export {
  parseAndValidateBackup,
  MAX_BACKUP_TEXT_LENGTH,
  type ParsedBackup,
} from './deserialize';
export {
  applyImport,
  buildDatabaseFromBackup,
  mergeProfileSettings,
} from './apply';
export { previewImport } from './preview';
// 070: the crash-safe replacement sequence, the forward-compatibility detector
// and the diagnostics budget are exported so the transport seam, the validator
// and the data-management screen all use the SAME implementations the tests
// pin, rather than each keeping a private copy that can drift.
export {
  isPreviousBackupName,
  previousBackupName,
  replaceWithRotation,
  sweepRotationLeftovers,
  type ReplacementHooks,
  type ReplacementStep,
  type RotationFileSystem,
} from './replacement';
export {
  detectUnrecognizedContent,
  KNOWN_DATA_SECTIONS,
  KNOWN_ENVELOPE_FIELDS,
  type ForwardCompatibilityReport,
  type UnrecognizedItem,
  type UnrecognizedKind,
} from './forward-compat';
export {
  DEFAULT_TIER_LIMITS,
  DiagnosticsBudget,
  IssueRecorder,
  type DiagnosticTier,
  type RetainedDiagnostic,
} from './diagnostics-budget';
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
