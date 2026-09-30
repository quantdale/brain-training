/**
 * Backup transport abstraction.
 *
 * The serialization/import engine is backend-agnostic and produces/consumes a
 * plain string. How that string reaches disk, the cloud-share sheet, or a file
 * picker is deliberately OUT of scope for this branch: native file-picker /
 * sharing dependencies are a shared convergence surface (package manifest) that
 * this wave must not touch. We define a clean `BackupTransport` seam and ship
 * an in-memory implementation for production wiring + tests.
 *
 * PRODUCTION INTEGRATION (owner: merge session) — to make export/import reach
 * the filesystem on device, implement `BackupTransport` with:
 *   - `writeBackup`  -> expo-file-system write to the app's document/backup dir
 *                       (or expo-sharing / DocumentPicker for user-chosen files)
 *   - `readBackup`   -> expo-file-system read, or DocumentPicker.getDocumentAsync
 *   - `listBackups`  -> expo-file-system readdir of the backup dir
 *   - `deleteBackup` -> expo-file-system delete
 * No new npm dependency is required if `expo-file-system`/`expo-sharing`/
 * `expo-document-picker` are already in the Expo SDK; otherwise add them via a
 * dedicated manifest commit (see handoff).
 */

export interface BackupTransport {
  /** Persist backup text under `name` (caller-chosen, e.g. generated filename). */
  writeBackup(name: string, contents: string): Promise<void>;
  /** Read previously-written backup text by `name`. */
  readBackup(name: string): Promise<string>;
  /** List available backup names (newest-first ordering is up to the impl). */
  listBackups(): Promise<string[]>;
  /** Remove a backup by `name`. No-op if it does not exist. */
  deleteBackup(name: string): Promise<void>;
  /**
   * Files the transport is HIDING from `listBackups()` but cannot safely
   * delete on its own (Change 070).
   *
   * Optional so the in-memory transport and any future transport need not
   * implement it. Two cases land here:
   * - a rotation leftover whose live counterpart is gone, so the leftover is
   *   the ONLY surviving copy of that backup and deleting it would be the data
   *   loss the rotation exists to prevent;
   * - a file written under a name an EARLIER build accepted but the current
   *   listing rule hides — a backup the app once reported as saved and can now
   *   neither show nor restore.
   *
   * Both are the user's to resolve (restore under a visible name, or delete),
   * so the transport reports them and the screen offers the choice rather than
   * making it silently.
   */
  listStrandedArtifacts?(): Promise<string[]>;
  /**
   * Delete a stranded artifact by its raw on-disk name.
   *
   * Separate from `deleteBackup` because that one validates names against the
   * listing rule — which is exactly the rule that HIDES a stranded artifact,
   * so routing deletion through it would make the artifact undeletable.
   */
  deleteStrandedArtifact?(name: string): Promise<void>;
}

/** In-memory transport — used by tests and as a placeholder default in the UI. */
export function createMemoryTransport(): BackupTransport {
  const store = new Map<string, string>();
  return {
    async writeBackup(name, contents) {
      store.set(name, contents);
    },
    async readBackup(name) {
      const found = store.get(name);
      if (found === undefined) {
        throw new Error(`No backup named "${name}" in memory transport`);
      }
      return found;
    },
    async listBackups() {
      return [...store.keys()];
    },
    async deleteBackup(name) {
      store.delete(name);
    },
  };
}

/**
 * Build a stable, human-readable backup filename (local timezone date + time).
 *
 * Collision resistance beyond one-second resolution, without changing the
 * normal single-export name:
 *   - repeated calls within the same clock second (before the transport
 *     inventory refreshes) advance a monotonic suffix: `-2`, `-3`, ...;
 *   - names supplied in `existingNames` (the saved-backup inventory) are
 *     skipped, covering collisions with files from earlier sessions.
 * The first call for a given second stays exactly
 * `brain-training-backup_YYYY-MM-DD_HH-MM-SS.json`.
 */
export function defaultBackupName(
  now: Date = new Date(),
  existingNames: Iterable<string> = [],
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const base = `brain-training-backup_${stamp}.json`;

  const taken = new Set(existingNames);
  // Monotonic only within the same second: a new stamp starts fresh at `-1`
  // (the base name), so ordinary spaced-out exports keep the plain name.
  let index = lastDefaultNameBase === base ? lastDefaultNameIndex + 1 : 1;
  let candidate = collisionSuffix(base, index);
  while (taken.has(candidate)) {
    index += 1;
    candidate = collisionSuffix(base, index);
  }
  lastDefaultNameBase = base;
  lastDefaultNameIndex = index;
  return candidate;
}

/** Last generated base name + suffix index (per process, not persisted). */
let lastDefaultNameBase: string | null = null;
let lastDefaultNameIndex = 0;

/** `-2`, `-3`, ... before the extension; index <= 1 is the unadorned name. */
function collisionSuffix(base: string, index: number): string {
  return index <= 1 ? base : base.replace(/\.json$/, `-${index}.json`);
}
