/**
 * File-system backup transport (Campaign 010, architecture-debt D2).
 *
 * Wires the `BackupTransport` seam to real device storage: backups persist
 * under `<documentDirectory>/backups` via expo-file-system (SDK 57
 * object-oriented API), exports can be handed to the system share sheet, and
 * imports can source from the system document picker.
 *
 * Failure philosophy matches the portability engine: every native call is the
 * caller's responsibility to try/catch — the screen layer must never crash
 * because storage is unavailable. All operations are synchronous inside
 * async-shaped methods (the engine's serialize/apply path is synchronous too);
 * large-backup memory behavior is dominated by the envelope string itself.
 *
 * NOT VALIDATED — Campaign 010 implementation-only wave. No device run has
 * exercised SAF/picker/share flows yet; Campaign 011 owns that verification
 * (see .agent/_tasks/campaign011-validation-backlog.md).
 */

import { Directory, File, Paths } from "expo-file-system";
import { getDocumentAsync } from "expo-document-picker";
import { isAvailableAsync, shareAsync } from "expo-sharing";

import type { BackupTransport } from "./transport";

/** Backups live in a dedicated folder so listing/deleting stays scoped. */
export const BACKUP_DIRECTORY_NAME = "backups";

function backupDirectory(): Directory {
  return new Directory(Paths.document, BACKUP_DIRECTORY_NAME);
}

function ensureBackupDirectory(): Directory {
  const dir = backupDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Production `BackupTransport` backed by the app document directory.
 * Overwrite semantics: writing an existing name replaces it (delete-then-
 * write; checksums and rollback safety live in the engine layers above).
 */
export function createFileBackupTransport(): BackupTransport {
  return {
    async writeBackup(name, contents) {
      const file = new File(ensureBackupDirectory(), name);
      if (file.exists) {
        file.delete();
      }
      file.write(contents);
    },

    async readBackup(name) {
      const file = new File(ensureBackupDirectory(), name);
      if (!file.exists) {
        throw new Error(`No backup named "${name}" found in app backups`);
      }
      return file.text();
    },

    async listBackups() {
      const dir = ensureBackupDirectory();
      return dir
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((file) => file.name)
        .sort((a, b) => b.localeCompare(a));
    },

    async deleteBackup(name) {
      const file = new File(ensureBackupDirectory(), name);
      // Contract: no-op when the name does not exist.
      if (file.exists) {
        file.delete();
      }
    },
  };
}

/** A backup file chosen by the user through the system document picker. */
export interface PickedBackupFile {
  /** Original file name as reported by the picker. */
  name: string;
  /** Full text of the picked backup envelope. */
  text: string;
}

/**
 * Let the user choose a backup JSON from outside the app sandbox (Downloads,
 * Drive, other apps). Resolves `null` when the picker is canceled.
 */
export async function pickBackupFile(): Promise<PickedBackupFile | null> {
  const result = await getDocumentAsync({
    // Any type: backup files have no registered MIME across vendors.
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  const file = new File(asset.uri);
  if (!file.exists) {
    throw new Error(`Picked file "${asset.name}" could not be opened`);
  }
  return { name: asset.name, text: await file.text() };
}

/**
 * Hand a saved backup to the system share sheet (save to Files / send to
 * another app). Resolves `false` when sharing is unavailable on the platform;
 * throws only for a genuinely missing backup.
 */
export async function shareBackupFile(
  name: string,
  dialogTitle = "Share backup",
): Promise<boolean> {
  const file = new File(backupDirectory(), name);
  if (!file.exists) {
    throw new Error(`No backup named "${name}" found in app backups`);
  }
  if (!(await isAvailableAsync())) {
    return false;
  }
  await shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle,
  });
  return true;
}
