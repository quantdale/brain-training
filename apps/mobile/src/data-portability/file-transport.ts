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

import { MAX_BACKUP_TEXT_LENGTH } from "./deserialize";
import {
  replaceWithRotation,
  sweepRotationLeftovers,
  type RotationFileSystem,
} from "./replacement";
import type { BackupTransport } from "./transport";
import { MalformedBackupError } from "./types";

/** Backups live in a dedicated folder so listing/deleting stays scoped. */
export const BACKUP_DIRECTORY_NAME = "backups";

/**
 * THE ONE RULE for "is this name a backup the user can see and restore?".
 *
 * Change 070: this used to exist twice — a filter inside `listBackups()` and a
 * validator inside `validateBackupName()` — with the same intent and no shared
 * definition, so the two could drift. When they do drift, a user writes a
 * backup under an accepted name and can never find it. One predicate, used by
 * both, makes that failure mode unrepresentable.
 *
 * Internal artifacts (the writer's temp and `.prev` rotation files) are dotfiles
 * or `.tmp` leftovers. They are never restorable, so they are never listed and
 * never accepted as a write target.
 */
export function isInternalBackupArtifact(name: string): boolean {
  return name.startsWith(".") || name.endsWith(".tmp");
}

/** Structural name rules that have nothing to do with the visibility rule. */
function isStructurallyValidName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\u0000")
  );
}

/**
 * Keep transport names inside the app-owned backup directory AND listable.
 *
 * Rejecting a name the listing would hide is what turns a silent data-loss trap
 * into an input error: the user is told at write time, rather than discovering
 * months later that a backup exists that the app can neither show nor restore.
 */
function validateBackupName(name: string): void {
  if (!isStructurallyValidName(name)) {
    throw new Error("Backup name must be a non-empty file name inside the backups directory");
  }
  if (isInternalBackupArtifact(name)) {
    // Distinct message: the name is structurally fine, it is just unlistable,
    // and the user needs to know WHICH rule they hit to pick a different name.
    throw new Error(
      `Backup name "${name}" is reserved for internal backup files and cannot be used. ` +
        "A backup must not start with '.' or end with '.tmp', because the backup list hides those names.",
    );
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
 * Adapt the SDK 57 `File`/`Directory` surface to the narrow port the rotation
 * sequence needs.
 *
 * Shared by `writeBackup`, `listBackups`, and the stranded-artifact reporting
 * so all three see the directory the same way — the alternative is three copies
 * of the same mapping, and a drift between them would mean the writer believes
 * a file is gone while the lister still sees it.
 */
function rotationFsFor(fs: FileSystemModule, dir: FsDirectory): RotationFileSystem {
  return {
   exists: (fileName) => new fs.File(dir, fileName).exists,
   write: (fileName, text) => {
    new fs.File(dir, fileName).write(text);
   },
   async move(from, to) {
    // `overwrite` is deliberately NOT set. The sequence guarantees the
    // destination does not exist before every move (it rotates first), so an
    // existing destination means a bug in the sequence — and the platform's
    // overwrite path is the delete-then-rename this design exists to avoid. Let
    // it fail loudly instead.
    await new fs.File(dir, from).move(new fs.File(dir, to));
   },
   delete: (fileName) => {
    const target = new fs.File(dir, fileName);
    if (target.exists) {
     target.delete();
    }
   },
   read: async (fileName) => new fs.File(dir, fileName).text(),
   listNames: () =>
    dir
     .list()
     .filter((entry): entry is InstanceType<FileSystemModule["File"]> => entry instanceof fs.File)
     .map((entry) => entry.name),
  };
}

/**
 * Production `BackupTransport` backed by the app document directory.
 *
 * Replacement guarantee (Change 070): writing an existing name rotates the old
 * content to a `.prev` sibling, renames the new content into place, VERIFIES it
 * reads back, and only then deletes `.prev`. At every instant at least one
 * complete readable copy exists; the only gap is between the rotation and the
 * rename, and in that gap the complete previous copy is readable at `.prev`.
 *
 * This is NOT a claim that the platform rename is atomic. The installed
 * `expo-file-system` Android move is a delete-then-rename (sources and line
 * references in `replacement.ts`), which is why the guarantee comes from the
 * sequence. See the module header there before changing this.
 *
 * Physical durability (fsync) is a separate, still-open owner decision: ordering
 * removes the logical loss window, not the window between "written" and "on
 * storage".
 */
export function createFileBackupTransport(): BackupTransport {
 return {
  async writeBackup(name, contents) {
   validateBackupName(name);
   const fs = fileSystem();
   const dir = ensureBackupDirectory();
   const rotationFs = rotationFsFor(fs, dir);

   // Sweep first: an interrupted earlier rotation must not leave a `.prev`
   // that this write would then have to compete with.
   sweepRotationLeftovers(rotationFs);

   // A nonce keeps two concurrent writers from colliding on the temp path. The
   // temp name is a dotfile, so it is never listed even mid-write.
   await replaceWithRotation(rotationFs, name, contents, {
    temporaryNameFor: (target) =>
     `.${target}.${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.tmp`,
   });
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
   // Sweep before listing so an interrupted rotation does not accumulate
   // across launches. A `.prev` whose live counterpart is gone is the only
   // remaining copy of that backup and is deliberately NOT deleted — it is
   // reported through `listStrandedArtifacts` instead.
   sweepRotationLeftovers(rotationFsFor(fs, dir));
   return dir
    .list()
    .filter((entry): entry is FsFile => entry instanceof fs.File)
    .map((file) => file.name)
    // The SAME predicate the write-time validator uses (Change 070).
    .filter((fileName) => !isInternalBackupArtifact(fileName))
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

  /**
   * Hidden files that need the user's decision (Change 070, task 5.1).
   *
   * Two shapes, both real:
   * 1. a rotation leftover whose live counterpart is gone — the only remaining
   *    copy of a backup whose replacement was interrupted;
   * 2. any other file the listing rule hides, e.g. one an EARLIER build wrote
   *    under a name it accepted but the current rule does not. That is a
   *    backup the app once reported as saved and can now neither show nor
   *    restore, and deleting it on the user's behalf would be destructive.
   *
   * Reported rather than acted on: the user chooses to recover or delete. The
   * sweep is a no-op here by design (it already ran in `listBackups`), so a
   * caller may invoke this directly.
   */
  async listStrandedArtifacts() {
   const fs = fileSystem();
   const dir = ensureBackupDirectory();
   const rotationFs = rotationFsFor(fs, dir);
   // A leftover whose live counterpart exists is pure litter and is reclaimed
   // here; what survives is what the user must decide on.
   const protectedLeftovers = sweepRotationLeftovers(rotationFs);
   const others = rotationFs
    .listNames()
    .filter(
     (fileName) =>
      isInternalBackupArtifact(fileName) && !protectedLeftovers.includes(fileName),
    );
   return [...new Set([...protectedLeftovers, ...others])].sort();
  },

  async deleteStrandedArtifact(name) {
   // Deliberately NOT `deleteBackup`: that validates against the listing rule,
   // which is the very rule that hid this file, so routing through it would
   // make the artifact permanently undeletable. The name still has to stay
   // inside the backup directory.
   if (!isStructurallyValidName(name) || !isInternalBackupArtifact(name)) {
    throw new Error(
     `"${name}" is not a hidden backup artifact; use the normal delete control instead.`,
    );
   }
   const fs = fileSystem();
   const file = new fs.File(ensureBackupDirectory(), name);
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
  // Reject oversized files BEFORE `file.text()` materializes them in memory.
  // The picker reports a byte size for most providers; the deserialize cap only
  // runs after the whole string exists, so a multi-hundred-MB pick would OOM
  // the JS runtime first. UTF-8 byte length is always >= UTF-16 code-unit
  // length, so this can only reject a file whose byte size alone exceeds the
  // cap — erring on the side of not materializing a large document, never
  // accepting one that deserialize would reject.
  const reportedBytes =
    typeof asset.size === "number" && Number.isFinite(asset.size) ? asset.size : null;
  // 062: providers that omit `asset.size` fall back to the copied file's
  // own stat size (the pick is already a cache copy, so stating it costs
  // no extra I/O of consequence). Defensive access: a quirky bridge falls
  // through to the pre-existing text/deserialize gates instead of breaking
  // picking.
  let statBytes: number | null = null;
  try {
    const statSize: unknown = (file as { size?: unknown }).size;
    if (typeof statSize === "number" && Number.isFinite(statSize)) {
      statBytes = statSize;
    }
  } catch {
    // Fall through to the text/deserialize gates below.
  }
  const knownBytes = reportedBytes ?? statBytes;
  if (knownBytes !== null && knownBytes > MAX_BACKUP_TEXT_LENGTH) {
    throw new MalformedBackupError(
      `Picked backup "${asset.name}" is too large (${knownBytes} bytes; the maximum supported backup size is ${MAX_BACKUP_TEXT_LENGTH} characters).`,
    );
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
