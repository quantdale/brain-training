/**
 * Result/preview report types for import operations. Kept separate from the
 * engine so `apply` / `preview` / `wipe` can share them without circular
 * imports.
 */

import type { ParsedBackup } from './deserialize';
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
  /** Human-readable notes, e.g. destructive replace warning. */
  notes: string[];
  /**
   * The already-validated parsed backup, present when `valid` is true.
   * Callers that apply immediately after previewing can reuse it instead of
   * paying a second full parse/validate/canonicalize pass on large backups.
   */
  parsed?: ParsedBackup;
}
