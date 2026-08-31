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
 * LAZY NATIVE IMPORTS (campaign 011 operational fix): the three native
 * modules below are required lazily, at first operation — never at module
 * evaluation. History: campaign 010 added these dependencies AFTER the
 * installed dev-client APK was built; because they were statically imported,
 * any startup path reaching this module crashed the whole app with
 * `Cannot find native module 'ExpoDocumentPicker'` (see campaign011 W16 F2).
 * Lazy requires keep this module safe to import from anywhere (route tables,
 * barrels, tests) even when the installed binary predates the dependency;
 * a stale dev client now surfaces as a typed, catchable error inside the
 * data-management screen instead of a startup crash. Rebuild the dev client
 * (`npx expo run:android`) after adding native-backed dependencies.
 */

import type { BackupTransport } from "./transport";

/** Backups live in a dedicated folder so listing/deleting stays scoped. */
export const BACKUP_DIRECTORY_NAME = "backups";

/** Keep transport names inside the app-owned backup directory. */
function validateBackupName(name: string): void {
 if (
  typeof name !== "string" ||
  name.length === 0 ||
  name === "." ||
  name === ".." ||
  name.includes("/") ||
  name.includes("\\") ||
  name.includes("\u0000")
 ) {
  throw new Error("Backup name must be a non-empty file name inside the backups directory");
 }
}

type FileSystemModule = typeof import("expo-file-system");
type PickerModule = typeof import("expo-document-picker");
type SharingModule = typeof import("expo-sharing");
/** Instance types resolved through the module shape — no static value import. */
type FsDirectory = InstanceType<FileSystemModule["Directory"]>;
type FsFile = InstanceType<FileSystemModule["File"]>;

/**
 * Require a native-backed module with a diagnostic error naming the remedy.
 * Thrown only when the JS package is present but the running binary lacks the
 * compiled module (stale dev client) — callers above the transport already
 * try/catch, so this degrades to an inline message instead of a red screen.
 */
function requireNativeModule<T>(name: string, load: () => T): T {
 try {
  return load();
 } catch (err) {
  const detail = err instanceof Error ? err.message : String(err);
  throw new Error(
   `Native module '${name}' is unavailable in this app build ` +
    `(stale dev client). Rebuild and reinstall the dev client ` +
    `(npx expo run:android) after adding native dependencies. ` +
    `Original error: ${detail}`,
  );
 }
}

let fsCache: FileSystemModule | undefined;
function fileSystem(): FileSystemModule {
 fsCache ??= requireNativeModule(
  "expo-file-system",
  // Lazy native load: keeps this module importable before the dev client is
  // rebuilt (see LAZY NATIVE IMPORTS note above).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require("expo-file-system") as FileSystemModule,
 );
 return fsCache;
}

let pickerCache: PickerModule | undefined;
function documentPicker(): PickerModule {
 pickerCache ??= requireNativeModule(
  "expo-document-picker",
  // Lazy native load: a stale dev client must surface as a typed error at
  // first use, not crash startup (see LAZY NATIVE IMPORTS note above).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require("expo-document-picker") as PickerModule,
 );
 return pickerCache;
}

let sharingCache: SharingModule | undefined;
function sharing(): SharingModule {
 sharingCache ??= requireNativeModule(
  "expo-sharing",
  // Lazy native load: same stale-dev-client hazard as above; defer until
  // first share operation.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require("expo-sharing") as SharingModule,
 );
 return sharingCache;
}

function backupDirectory(): FsDirectory {
 const fs = fileSystem();
 return new fs.Directory(fs.Paths.document, BACKUP_DIRECTORY_NAME);
}

function ensureBackupDirectory(): FsDirectory {
 const dir = backupDirectory();
 if (!dir.exists) {
  dir.create({ intermediates: true, idempotent: true });
 }
 return dir;
}

/**
 * Production `BackupTransport` backed by the app document directory.
 * Overwrite semantics: writing an existing name replaces it with a temp-file
 * write followed by an atomic same-directory move. A failed write therefore
 * leaves the previous complete backup available for recovery.
 */
export function createFileBackupTransport(): BackupTransport {
 return {
  async writeBackup(name, contents) {
   validateBackupName(name);
   const fs = fileSystem();
   const dir = ensureBackupDirectory();
   const file = new fs.File(dir, name);
   // A same-directory rename is atomic on the app's private filesystem. The
   // nonce is only for the temporary path; it is never exposed by listing.
   const temporaryName = `.${name}.${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}.tmp`;
   const temporary = new fs.File(dir, temporaryName);
   try {
    temporary.write(contents);
    await temporary.move(file, { overwrite: true });
   } catch (error) {
    // Best-effort cleanup must never mask the original storage failure, and
    // importantly never deletes the prior destination.
    try {
     if (temporary.exists) {
      temporary.delete();
     }
    } catch {
     // The orphaned temp is harmless and remains scoped to the backup folder.
    }
    throw error;
   }
  },

  async readBackup(name) {
   validateBackupName(name);
   const fs = fileSystem();
   const file = new fs.File(ensureBackupDirectory(), name);
   if (!file.exists) {
    throw new Error(`No backup named "${name}" found in app backups`);
   }
   return file.text();
  },

  async listBackups() {
   const fs = fileSystem();
   const dir = ensureBackupDirectory();
   return dir
    .list()
    .filter((entry): entry is FsFile => entry instanceof fs.File)
    .map((file) => file.name)
    .sort((a, b) => b.localeCompare(a));
  },

  async deleteBackup(name) {
   validateBackupName(name);
   const fs = fileSystem();
   const file = new fs.File(ensureBackupDirectory(), name);
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
 const picker = documentPicker();
 const fs = fileSystem();
 const result = await picker.getDocumentAsync({
  // Any type: backup files have no registered MIME across vendors.
  type: "*/*",
  copyToCacheDirectory: true,
  multiple: false,
 });
 if (result.canceled || result.assets.length === 0) {
  return null;
 }
 const asset = result.assets[0];
 const file = new fs.File(asset.uri);
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
 validateBackupName(name);
 const share = sharing();
 const fs = fileSystem();
 const file = new fs.File(backupDirectory(), name);
 if (!file.exists) {
  throw new Error(`No backup named "${name}" found in app backups`);
 }
 if (!(await share.isAvailableAsync())) {
  return false;
 }
 await share.shareAsync(file.uri, {
  mimeType: "application/json",
  dialogTitle,
 });
 return true;
}
