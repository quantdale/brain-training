/**
 * Dry-run preview of an import. Validates the backup first (so the preview
 * reports rejection reasons), then computes exactly what a real import would
 * do WITHOUT mutating the database: the full `applyData` runs inside a real
 * transaction that is deliberately aborted, so the returned counters are
 * precise and the database is guaranteed untouched.
 */

import type { AppDatabase } from '@/db';
import { parseAndValidateBackup } from './deserialize';
import { applyData } from './apply';
import { captureTriggers, dropTriggers, recreateTriggers } from './triggers';
import { emptyCounters, type BackupMeta, type ImportPreview } from './report';
import type { ImportMode } from './types';

class PreviewRollback extends Error {
  constructor() {
    super('preview-rollback');
    this.name = 'PreviewRollback';
  }
}

function buildMeta(parsed: ReturnType<typeof parseAndValidateBackup>): BackupMeta {
  const { data, envelope } = parsed;
  return {
    format: envelope.format,
    version: envelope.version,
    createdAt: envelope.createdAt,
    ...(envelope.appVersion ? { appVersion: envelope.appVersion } : {}),
    schemaVersion: envelope.schemaVersion,
    counts: {
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
    },
  };
}

/**
 * Validate and preview an import from backup text. Never mutates. Returns a
 * structured report: `valid: false` with an `error` when the backup is
 * rejected, otherwise `valid: true` with the would-be counters and notes.
 */
export async function previewImport(
  db: AppDatabase,
  text: string,
  mode: ImportMode,
): Promise<ImportPreview> {
  let parsed;
  try {
    parsed = parseAndValidateBackup(text);
  } catch (error) {
    if (error instanceof SyntaxError || (error as Error).name === 'MalformedBackupError') {
      return reject(mode, 'malformed', (error as Error).message, error);
    }
    const name = (error as Error).name;
    if (name === 'UnsupportedVersionError') {
      return reject(mode, 'unsupported-version', (error as Error).message, error);
    }
    if (name === 'ChecksumMismatchError') {
      return reject(mode, 'checksum', (error as Error).message, error);
    }
    if (name === 'BackupDataValidationError') {
      return reject(
        mode,
        'data-validation',
        (error as Error).message,
        (error as { issues?: unknown }).issues,
      );
    }
    return reject(mode, 'malformed', (error as Error).message, error);
  }

  const meta = buildMeta(parsed);
  const c = emptyCounters(mode);
  const notes: string[] = [];

  // Run the real apply inside a transaction that we intentionally abort so the
  // database is left completely untouched while we capture exact counters.
  // For replace, the clear needs the append-only triggers dropped at the
  // connection level (modern SQLite removed `PRAGMA triggers`).
  let triggers: Awaited<ReturnType<typeof captureTriggers>> | null = null;
  if (mode === 'replace') {
    triggers = await captureTriggers(db);
    await dropTriggers(db, triggers);
  }
  try {
    await db.transaction(async (txn) => {
      await applyData(txn, parsed.data, mode, c);
      throw new PreviewRollback();
    });
  } catch (error) {
    if (!(error instanceof PreviewRollback)) {
      // A genuine failure during the dry-run (should not happen for valid data);
      // surface it as a validation error rather than crashing the preview.
      return reject(mode, 'data-validation', `Preview failed: ${(error as Error).message}`, error);
    }
  } finally {
    if (triggers) {
      await recreateTriggers(db, triggers);
    }
  }

  if (mode === 'replace') {
    notes.push(
      `Replace will overwrite ALL local data with the backup (${meta.counts.gameSessions} sessions, ` +
        `${meta.counts.currencyLedger} ledger entries, ${meta.counts.questProgress} quest-progress rows, etc.). ` +
        `This is destructive and cannot be undone except by restoring another backup.`,
    );
  } else {
    notes.push(
      'Merge will add new data and reconcile conflicts (sessions by id, economy by natural key, ' +
        'ratings/progress by best/latest). Existing data you did not export is preserved.',
    );
  }

  if (parsed.data.profile && meta.counts.hasProfile) {
    const targetProfile = await db.profile.get();
    if (targetProfile && targetProfile.displayName && parsed.data.profile.displayName !== targetProfile.displayName) {
      notes.push(
        `Profile name differs: device "${targetProfile.displayName || '(none)'}" vs backup "${parsed.data.profile.displayName}". ` +
          `Merge keeps the backup name; replace overwrites it.`,
      );
    }
  }

  return { valid: true, mode, meta, counters: c, notes, parsed };
}

function reject(
  mode: ImportMode,
  kind: 'malformed' | 'unsupported-version' | 'checksum' | 'data-validation',
  message: string,
  details?: unknown,
): ImportPreview {
  return {
    valid: false,
    // Preserve the caller's requested mode so the UI can keep showing what the
    // user was about to do, even when the backup was rejected.
    mode,
    meta: {
      format: '',
      version: 0,
      createdAt: 0,
      schemaVersion: 0,
      counts: {
        gameSessions: 0,
        domainRatings: 0,
        ratingHistory: 0,
        currencyLedger: 0,
        gameFavorites: 0,
        xpAwards: 0,
        tutorialState: 0,
        workoutInstances: 0,
        questDefinitions: 0,
        questProgress: 0,
        achievementDefinitions: 0,
        achievementUnlocks: 0,
        hasProfile: false,
      },
    },
    error: { kind, message, details },
    counters: emptyCounters('merge'),
    notes: [`Import rejected: ${message}`],
  };
}
