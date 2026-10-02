/**
 * Crash-safe backup replacement (Change 070, design D1).
 *
 * WHY NOT `move(temp, dest, { overwrite: true })`
 * -----------------------------------------------
 * That is what this transport used to do, and its docstring claimed a
 * same-directory rename is atomic so "a failed write leaves the previous
 * complete backup available for recovery". That claim is false for the
 * installed dependency. `expo-file-system`'s Android native move is a
 * **delete-then-rename**, read from the vendored source
 * (`node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/`):
 *
 * - `FileSystemPath.kt:174-187` — `move(to, options)` delegates to
 *   `file.moveTo(to.asCopyOrMoveDestination(options.overwrite))`.
 * - `fsops/CopyMoveStrategy.kt:86-90` — `prepareAsDestination`:
 *   ```kotlin
 *   target.takeIf { it.exists() }?.let {
 *     if (!spec.overwrite) throw DestinationAlreadyExistsException()
 *     it.deleteRecursively()   // destination removed FIRST
 *   }
 *   ```
 * - `fsops/CopyMoveStrategy.kt:95-112` — only then `tryNativeMove` /
 *   `renameTo`, falling back to an NIO move, then to copy+delete.
 *
 * So there is a window in which the destination does not exist. The listing
 * filter hides dotfiles, so the surviving temp is invisible too: after a crash
 * in that window the user has no backup at that name and no indication one was
 * lost. The evidence is recorded here so a future change does not re-derive it
 * and "simplify" the sequence back to a single overwrite move.
 *
 * THE SEQUENCE, AND WHY EACH STEP IS THERE
 * -----------------------------------------
 * The guarantee must come from the sequence, not from a property of a
 * third-party rename this repository has already proven to be false. Each
 * intermediate state below leaves at least ONE complete readable backup:
 *
 * | after step                | `name`                | `.prev`         |
 * |---------------------------|-----------------------|-----------------|
 * | temp written              | old (or absent)       | —               |
 * | old rotated to `.prev`    | ABSENT (only a gap)   | old (complete)  |
 * | temp renamed into place   | new (complete)        | old (complete)  |
 * | verified, `.prev` deleted | new (complete)        | —               |
 *
 * The only instant a name is unreadable is between the rotation and the
 * rename, and in that instant the complete previous content is readable at the
 * `.prev` path, which the same recovery step can adopt. A crash therefore costs
 * at worst the newest backup, never both.
 *
 * DELIBERATELY NOT CLAIMED: physical durability. Ordering removes the *logical*
 * loss window. Getting the bytes onto storage additionally needs an fsync,
 * which is unavailable through this dependency and is recorded as an open owner
 * decision in `.agent/BACKLOG.md` / `docs/DEFERRED_DECISIONS.md`. The rotation
 * happens to bound that residual too: a power loss can lose the newest
 * backup's tail, but the previous complete backup survives to the next boot.
 */

/** The rotation sibling of a backup name: a dotfile, so listing hides it. */
export function previousBackupName(name: string): string {
  return `.${name}.prev`;
}

/** True when `fileName` is a rotation leftover this module owns. */
export function isPreviousBackupName(fileName: string): boolean {
  return fileName.startsWith('.') && fileName.endsWith('.prev');
}

/**
 * The minimal file-system surface the sequence needs.
 *
 * Narrow on purpose: the sequence is the thing that must be provably crash-safe,
 * so it is expressed against four operations and a probe, which makes
 * step-level fault injection possible without a device or a native module.
 */
export interface RotationFileSystem {
  /** Does a readable file exist at this name? */
  exists(name: string): boolean;
  /** Write new content under a name (the temp file). */
  write(name: string, contents: string): void;
  /**
   * Rename `from` to `to`.
   *
   * MUST NOT silently delete `to` first — the whole design exists because the
   * platform's own move does. Implementations must fail if `to` exists, so a
   * bug here surfaces as a loud error instead of a silent data-loss window.
   */
  move(from: string, to: string): Promise<void>;
  /** Delete a name if present. */
  delete(name: string): void;
  /**
   * Read a name's content; rejects when unreadable. Used to verify the new
   * content actually landed before the only remaining copy of the old content
   * is deleted. Async because the underlying `File.text()` is.
   */
  read(name: string): Promise<string>;
  /** Every name currently present in the backup directory. */
  listNames(): string[];
}

/** The steps of the sequence, named so fault injection can name where it died. */
export type ReplacementStep =
  | 'write-temp'
  | 'rotate-existing'
  | 'rename-into-place'
  | 'verify'
  | 'delete-previous';

/**
 * Optional hook used by tests to terminate the sequence at a named step.
 * Production callers pass nothing; the hook is the ONLY way the sequence can be
 * interrupted, so an unexpected interruption cannot hide in a code path the
 * tests do not exercise.
 */
export interface ReplacementHooks {
  /** Throwing from this hook simulates a process death / storage fault. */
  beforeStep?(step: ReplacementStep): void;
  /** Content actually written to the temp file (test double's temp name). */
  temporaryNameFor?(name: string): string;
}

/**
 * Replace the backup at `name` with `contents`, keeping at least one complete
 * readable copy at every instant.
 *
 * On any failure the ORIGINAL error is rethrown, never a cleanup error: a
 * cleanup failure that masks "disk full" or "permission denied" sends an
 * on-call engineer to the wrong place. Cleanup is best-effort and each step
 * restores the strongest state it can:
 *
 * - fail before the rotation → the old backup is untouched; the temp is removed.
 * - fail during the rotation → best-effort move `.prev` back to `name`.
 * - fail during the rename → the old backup is restored from `.prev`, because a
 *   half-written name is worse than a stale one.
 * - fail while verifying or deleting `.prev` → the new backup is already
 *   complete and in place; the leftover `.prev` is inert and swept later.
 */
export async function replaceWithRotation(
  fs: RotationFileSystem,
  name: string,
  contents: string,
  hooks: ReplacementHooks = {},
): Promise<void> {
  const previous = previousBackupName(name);
  const temporary = hooks.temporaryNameFor?.(name) ?? `.${name}.pending`;

  const runStep = (step: ReplacementStep): void => {
    hooks.beforeStep?.(step);
  };

  // A leftover `.prev` from an interrupted earlier rotation is inert but must
  // not become the destination of this one: `move` refuses to overwrite, and
  // more importantly the old-old backup must not be promoted to `.prev` over
  // the one the user is about to lose.
  runStep('write-temp');
  fs.write(temporary, contents);

  try {
    if (fs.exists(name)) {
      runStep('rotate-existing');
      if (fs.exists(previous)) {
        fs.delete(previous);
      }
      await fs.move(name, previous);
    }

    runStep('rename-into-place');
    await fs.move(temporary, name);

    // Verify BEFORE discarding the only remaining copy of the old content. A
    // rename that silently did nothing must not be allowed to delete the
    // backup it was supposed to replace.
    runStep('verify');
    if (!fs.exists(name)) {
      throw new Error(`Backup replacement left no file at "${name}" after the rename`);
    }
    // Read it back: presence alone does not prove the content landed. This
    // costs one extra read of the backup, which is the price of being able to
    // delete the previous copy with a straight face.
    const written = await fs.read(name);
    if (written !== contents) {
      throw new Error(
        `Backup replacement of "${name}" did not produce the expected content ` +
          `(read ${written.length} chars, expected ${contents.length})`,
      );
    }

    runStep('delete-previous');
    if (fs.exists(previous)) {
      fs.delete(previous);
    }
  } catch (error) {
    await recover(fs, { name, previous, temporary }, contents);
    throw error;
  }
}

/** What recovery knows about the state it is recovering from. */
interface RecoveryState {
  name: string;
  previous: string;
  temporary: string;
}

/**
 * Best-effort restoration after a failed replacement. Never throws: a failure
 * here must not replace the error the caller is about to see.
 *
 * One rule covers every failure shape: whenever the live name does not hold
 * the EXPECTED content and a complete previous copy exists, promote the
 * previous copy. That includes the three real cases — the name is missing
 * (interrupted between rotation and rename), the name is unreadable, and the
 * name exists but holds DIFFERENT bytes (a rename that landed short of the
 * expected content). The first version only handled "name missing", so a
 * content-mismatch failure left the corrupt file as the user's visible backup
 * and the good copy hidden — precisely inverted from what the caller needs.
 * A stale backup is strictly better than a corrupt one.
 */
async function recover(
  fs: RotationFileSystem,
  state: RecoveryState,
  expected: string,
): Promise<void> {
  const { name, previous, temporary } = state;
  // The temp is never a valid backup (the listing rule hides it and the user
  // cannot restore it), so removing it is always safe.
  try {
    if (fs.exists(temporary)) fs.delete(temporary);
  } catch {
    // Left behind as an internal artifact; the sweep reclaims it once the
    // live name is healthy again.
  }

  try {
    if (fs.exists(previous) && !(await holdsContent(fs, name, expected))) {
      await restorePrevious(fs, name, previous);
    }
  } catch {
    // Nothing further to try; `.prev` survives and the next sweep promotes it.
  }
}

/** True when a readable file at `name` holds exactly `expected`. */
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

/**
 * Is the live file at `name` a usable backup?
 *
 * Empty and unreadable files are not: an empty file cannot be a backup
 * envelope and an unreadable one cannot be restored from. The sweep uses this
 * to tell a stale rotation sibling (live name healthy — litter) from the only
 * real copy (live name missing or empty — must be promoted).
 */
async function liveIsUsable(fs: RotationFileSystem, name: string): Promise<boolean> {
  if (!fs.exists(name)) return false;
  try {
    return (await fs.read(name)).length > 0;
  } catch {
    return false;
  }
}

/**
 * Put the rotation sibling back under the live name.
 *
 * Best-effort and never throws: the caller is either reporting an error or
 * sweeping, and a failure here must not replace the error the caller is about
 * to see. Returns whether the live name now exists.
 */
async function restorePrevious(
  fs: RotationFileSystem,
  name: string,
  previous: string,
): Promise<boolean> {
  try {
    if (fs.exists(name)) fs.delete(name);
    await fs.move(previous, name);
    return fs.exists(name);
  } catch {
    return false;
  }
}

/**
 * Remove rotation leftovers from an interrupted earlier replacement.
 *
 * Called on every write, listing, and read, so an interrupted rotation is
 * repaired by the next access rather than by a manual step. The ordering rule:
 *
 * - a `.prev` whose live name is missing or unusable is the ONLY complete copy
 *   of that backup, so it is PROMOTED back to the live name. A banner asking
 *   the user to notice a hidden file is not a fix: the contract is that a read
 *   of the name yields complete previous or complete new content, and a name
 *   that is missing fails that contract outright.
 * - a `.prev` whose live name is healthy is the stale sibling of a crash after
 *   the rename landed — pure litter, reclaimed.
 * - a writer temp is reclaimed only once its owner's live name is healthy,
 *   because until then the temp may be the only complete copy of a write that
 *   never finished. Foreign dotfiles are never touched: only the exact temp
 *   shapes the writer creates are recognized.
 *
 * Returns the names that could not be reclaimed (restoration failed), so a
 * caller can surface them instead of silently keeping an artifact the user
 * cannot see.
 */
export async function sweepRotationLeftovers(fs: RotationFileSystem): Promise<string[]> {
  const unreclaimed: string[] = [];
  // Pass 1: rotation siblings.
  for (const fileName of [...fs.listNames()]) {
    if (!isPreviousBackupName(fileName)) continue;
    // `.foo.prev` belongs to the backup named `foo`. A file literally named
    // `.prev` derives an empty owner and would be "promoted" to the empty
    // name — guard like `temporaryArtifactOwner` does so a foreign dotfile is
    // never moved, only reported.
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
  // Pass 2: writer temps. Runs after pass 1 so a promoted sibling makes its
  // owner healthy before the owner's temp is considered. (Writes are
  // sequential in the UI — a temp belonging to an in-flight write cannot be
  // present during another write's sweep.)
  for (const fileName of [...fs.listNames()]) {
    const owner = temporaryArtifactOwner(fileName);
    if (owner === null) continue;
    try {
      if (await liveIsUsable(fs, owner)) {
        fs.delete(fileName);
      }
    } catch {
      // Inert; the next sweep tries again.
    }
  }
  return unreclaimed;
}

/**
 * The owner of a writer-created temp, or null for anything else.
 *
 * The writer creates exactly two shapes: `.{owner}.pending` (the sequence's
 * default) and `.{owner}.{nonce}.tmp` (the transport's nonce form, whose nonce
 * is base36 + '-' + base36 and therefore contains no dot). Anything that does
 * not match one of those shapes is left alone — a foreign dotfile must never be
 * swept.
 */
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
