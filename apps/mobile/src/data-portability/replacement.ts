/**
 * Backup replacement and restart recovery.
 *
 * Do not use an overwrite move: SDK 57 expo-file-system prepares a destination
 * by deleting it before moving (Android fsops/CopyMoveStrategy.kt:86–112).
 * Even a non-overwrite move can fall back to copy+delete (:33–41). Existence,
 * nonempty content, and a successful move therefore do not establish integrity.
 *
 * Keep the original live file while writing and verifying its `.prev` copy.
 * Only then remove the live name and move the verified temp into place. Recovery
 * likewise copies `.prev` without consuming it until the live bytes read back
 * exactly and pass the real backup reader's checksum/format/data validation.
 * Inconclusive recovery retains hidden artifacts for the transport to report.
 *
 * This is logical recovery, NOT physical durability: Expo exposes no fsync.
 */
import { parseAndValidateBackup } from './deserialize';

/** The rotation sibling of a backup name: a dotfile, so listing hides it. */
export function previousBackupName(name: string): string {
  return `.${name}.prev`;
}

/** True when `fileName` is a rotation leftover this module owns. */
export function isPreviousBackupName(fileName: string): boolean {
  return fileName.startsWith('.') && fileName.endsWith('.prev');
}

/** Minimal storage port, shared by the native adapter and fault-injection tests. */
export interface RotationFileSystem {
  exists(name: string): boolean;
  write(name: string, contents: string): void;
  /** Must refuse an existing destination; never request overwrite semantics. */
  move(from: string, to: string): Promise<void>;
  delete(name: string): void;
  read(name: string): Promise<string>;
  listNames(): string[];
}

export type ReplacementStep =
  | 'write-temp'
  | 'rotate-existing'
  | 'rename-into-place'
  | 'verify'
  | 'delete-previous';

/** Caught-fault hooks. Process-death tests must instead plant restart states. */
export interface ReplacementHooks {
  beforeStep?(step: ReplacementStep): void;
  temporaryNameFor?(name: string): string;
}

/**
 * Replace a backup, verifying every copy before discarding its alternative.
 * Failed cleanup never masks the original storage error. Calls are sequential
 * in the UI; this port does not provide inter-process or concurrent-writer locks.
 */
export async function replaceWithRotation(
  fs: RotationFileSystem,
  name: string,
  contents: string,
  hooks: ReplacementHooks = {},
): Promise<void> {
  const previous = previousBackupName(name);
  const temporary = hooks.temporaryNameFor?.(name) ?? `.${name}.pending`;

  // Never rotate a truncated live file over an unresolved complete `.prev`.
  // The transport normally sweeps first, but the sequence defends itself too.
  if (fs.exists(previous)) {
    if (await liveIsUsable(fs, name)) {
      fs.delete(previous);
    } else if (!(await restorePrevious(fs, name, previous))) {
      throw new Error(`Backup recovery for "${name}" is unresolved; retained "${previous}"`);
    }
  }
  if (fs.exists(temporary) && !(await liveIsUsable(fs, name))) {
    throw new Error(`Backup recovery for "${name}" is unresolved; retained "${temporary}"`);
  }

  const runStep = (step: ReplacementStep): void => { hooks.beforeStep?.(step); };
  try {
    runStep('write-temp');
    fs.write(temporary, contents);
    // A short temp write must not lead to destruction of either complete copy.
    await verifyBackupContent(fs, temporary, contents);

    if (fs.exists(name)) {
      runStep('rotate-existing');
      const original = await fs.read(name);
      // Copy, not move: even the rotation itself may be interrupted mid-copy.
      fs.write(previous, original);
      if (!(await holdsContent(fs, previous, original))) {
        throw new Error(`Backup rotation of "${name}" did not preserve the original content`);
      }
      fs.delete(name);
    }

    runStep('rename-into-place');
    await fs.move(temporary, name);
    runStep('verify');
    await verifyBackupContent(fs, name, contents);

    runStep('delete-previous');
    if (fs.exists(previous)) fs.delete(previous);
  } catch (error) {
    await recover(fs, { name, previous, temporary }, contents);
    throw error;
  }
}

interface RecoveryState {
  name: string;
  previous: string;
  temporary: string;
}

/** Restore a known-good sibling; only reclaim temps once a valid live copy exists. */
async function recover(
  fs: RotationFileSystem,
  { name, previous, temporary }: RecoveryState,
  expected: string,
): Promise<void> {
  try {
    if (fs.exists(previous) && !(await holdsContent(fs, name, expected))) {
      // A short rotation copy must not overwrite the still-complete live file.
      if (!(await liveIsUsable(fs, name))) await restorePrevious(fs, name, previous);
    }
    if ((await liveIsUsable(fs, name)) && fs.exists(temporary)) fs.delete(temporary);
  } catch {
    // Keep all uncertain artifacts. The sweep/report path can retry next access.
  }
}

/** Exact byte identity is needed in addition to format integrity during a copy. */
async function holdsContent(
  fs: RotationFileSystem,
  name: string,
  expected: string,
): Promise<boolean> {
  if (!fs.exists(name)) return false;
  try {
    return (await fs.read(name)) === expected;
  } catch {
    return false;
  }
}

async function verifyBackupContent(
  fs: RotationFileSystem,
  name: string,
  expected: string,
): Promise<void> {
  const written = await fs.read(name);
  if (written !== expected) {
    throw new Error(`Backup replacement of "${name}" did not produce the expected content ` +
      `(read ${written.length} chars, expected ${expected.length})`);
  }
  parseAndValidateBackup(written);
}

/** Positive validation, never a presence/nonempty heuristic. Unknown means retain. */
async function liveIsUsable(fs: RotationFileSystem, name: string): Promise<boolean> {
  if (!fs.exists(name)) return false;
  try {
    parseAndValidateBackup(await fs.read(name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a validated sibling while retaining the recovery source. A failed/short
 * write or failed readback must leave `.prev` available for another restart.
 */
async function restorePrevious(
  fs: RotationFileSystem,
  name: string,
  previous: string,
): Promise<boolean> {
  try {
    const original = await fs.read(previous);
    parseAndValidateBackup(original);
    fs.write(name, original);
    await verifyBackupContent(fs, name, original);
    fs.delete(previous);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repair rotation siblings, then reclaim writer temps only beside a validated
 * live backup. Returns every recognized artifact that could not be reclaimed;
 * the transport also lists hidden files so uncertain copies remain discoverable.
 */
export async function sweepRotationLeftovers(fs: RotationFileSystem): Promise<string[]> {
  const unreclaimed: string[] = [];
  for (const fileName of [...fs.listNames()]) {
    if (!isPreviousBackupName(fileName)) continue;
    const owner = fileName.slice(1, -'.prev'.length);
    if (owner.length === 0) {
      unreclaimed.push(fileName);
      continue;
    }
    try {
      if (await liveIsUsable(fs, owner)) {
        fs.delete(fileName);
        continue;
      }
      if (await restorePrevious(fs, owner, fileName)) continue;
      unreclaimed.push(fileName);
    } catch {
      unreclaimed.push(fileName);
    }
  }
  // A restored sibling can now justify removal of its owner's abandoned temp.
  for (const fileName of [...fs.listNames()]) {
    const owner = temporaryArtifactOwner(fileName);
    if (owner === null) continue;
    try {
      if (await liveIsUsable(fs, owner)) {
        fs.delete(fileName);
      } else {
        unreclaimed.push(fileName);
      }
    } catch {
      unreclaimed.push(fileName);
    }
  }
  return unreclaimed;
}

/** Recognize writer-owned temp names, never foreign dotfiles. */
function temporaryArtifactOwner(fileName: string): string | null {
  if (!fileName.startsWith('.')) return null;
  if (fileName.endsWith('.pending')) {
    const owner = fileName.slice(1, -'.pending'.length);
    return owner.length > 0 ? owner : null;
  }
  if (fileName.endsWith('.tmp')) {
    const stem = fileName.slice(1, -'.tmp'.length);
    const dot = stem.lastIndexOf('.');
    if (dot <= 0) return null;
    const nonce = stem.slice(dot + 1);
    return nonce.length > 0 ? stem.slice(0, dot) : null;
  }
  return null;
}
