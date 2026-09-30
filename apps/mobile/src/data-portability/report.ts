/**
 * Result/preview report types for import operations. Kept separate from the
 * engine so `apply` / `preview` / `wipe` can share them without circular
 * imports.
 */

import type { ParsedBackup } from './deserialize';
import type { ForwardCompatibilityReport } from './forward-compat';
import type { ImportMode } from './types';

/** Per-section counters produced by an import. */
export interface ImportCounters {
  mode: ImportMode;
  sessionsAdded: number;
  sessionsSkipped: number;
  ratingHistoryAdded: number;
  ledgerAdded: number;
  xpAwardsAdded: number;
  favoritesAdded: number;
  domainRatingsUpdated: number;
  tutorialsUpdated: number;
  workoutsUpdated: number;
  questDefinitionsUpdated: number;
  questProgressUpdated: number;
  achievementDefinitionsUpdated: number;
  achievementUnlocksUpdated: number;
  profileMerged: boolean;
  warnings: string[];
}

export function emptyCounters(mode: ImportMode): ImportCounters {
  return {
    mode,
    sessionsAdded: 0,
    sessionsSkipped: 0,
    ratingHistoryAdded: 0,
    ledgerAdded: 0,
    xpAwardsAdded: 0,
    favoritesAdded: 0,
    domainRatingsUpdated: 0,
    tutorialsUpdated: 0,
    workoutsUpdated: 0,
    questDefinitionsUpdated: 0,
    questProgressUpdated: 0,
    achievementDefinitionsUpdated: 0,
    achievementUnlocksUpdated: 0,
    profileMerged: false,
    warnings: [],
  };
}

/** Summary metadata about a backup, surfaced in the preview UI. */
export interface BackupMeta {
  format: string;
  version: number;
  createdAt: number;
  appVersion?: string;
  schemaVersion: number;
  counts: {
    gameSessions: number;
    domainRatings: number;
    ratingHistory: number;
    currencyLedger: number;
    gameFavorites: number;
    xpAwards: number;
    tutorialState: number;
    workoutInstances: number;
    questDefinitions: number;
    questProgress: number;
    achievementDefinitions: number;
    achievementUnlocks: number;
    hasProfile: boolean;
  };
}

/** Result of a successful import (merge or replace). */
export interface ImportResult extends ImportCounters {
  /** Total entities written (added/updated) — the meaningful "did something" number. */
  totalWritten: number;
  /**
   * Set when the imported backup contained content this build does not
   * understand, and the user chose to proceed anyway (Change 070).
   *
   * Recorded rather than merely shown, because the loss is permanent and silent
   * otherwise: the next export writes the file back without those fields and
   * nothing anywhere says they ever existed. Carrying the verdict on the RESULT
   * (not only in the preview) is what lets the screen state after the fact that
   * this import was knowingly lossy.
   */
  lossy?: LossyImportRecord;
}

/** What a knowingly-lossy import did not understand. */
export interface LossyImportRecord {
  /** How many distinct things were not understood. */
  count: number;
  /** The bounded, user-facing description shown at preview time. */
  summary: string;
  /** Dotted paths, for diagnostics. Bounded by the detector. */
  paths: string[];
}

/** A dry-run preview: validation status + what the import would do. */
export interface ImportPreview {
  valid: boolean;
  mode: ImportMode;
  meta: BackupMeta;
  /** Present when `valid` is false; the typed rejection reason. */
  error?: {
    kind: 'malformed' | 'unsupported-version' | 'checksum' | 'data-validation';
    message: string;
    details?: unknown;
  };
  /** Would-be counters (same shape as a real import result's counters). */
  counters: ImportCounters;
  /**
   * Present when the backup contains content this build does not understand
   * (Change 070). The preview is still `valid: true` — the user may deliberately
   * proceed — but the caller must surface this and let them cancel, because a
   * proceeding import is permanently lossy.
   */
  forwardCompatibility?: ForwardCompatibilityReport;
  /** Human-readable notes, e.g. destructive replace warning. */
  notes: string[];
  /**
   * The already-validated parsed backup, present when `valid` is true.
   * Callers that apply immediately after previewing can reuse it instead of
   * paying a second full parse/validate/canonicalize pass on large backups.
   */
  parsed?: ParsedBackup;
}
