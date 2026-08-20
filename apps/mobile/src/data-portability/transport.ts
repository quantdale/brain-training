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

/** Build a stable, human-readable backup filename (local timezone date + time). */
export function defaultBackupName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `brain-training-backup_${stamp}.json`;
}
