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
    await recover(fs, { name, previous, temporary, rotated: fs.exists(previous) });
    throw error;
  }
}

/** What recovery knows about the state it is recovering from. */
interface RecoveryState {
  name: string;
  previous: string;
  temporary: string;
  /** Is a complete old copy sitting at the rotation sibling? */
  rotated: boolean;
}

/**
 * Best-effort restoration after a failed replacement. Never throws: a failure
 * here must not replace the error the caller is about to see.
 */
async function recover(
  fs: RotationFileSystem,
  state: RecoveryState,
): Promise<void> {
  const { name, previous, temporary, rotated } = state;
  // The temp is never a valid backup (the listing rule hides it and the user
  // cannot restore it), so removing it is always safe.
  try {
    if (fs.exists(temporary)) fs.delete(temporary);
  } catch {
    // Left behind as a dotfile; swept by the next successful write.
  }

  // If the old content is at the rotation sibling and the name is missing or
  // unusable, put it back. Restoring a stale backup beats leaving the user with
  // no backup at this name at all.
  try {
    if (rotated && !fs.exists(name)) {
      await fs.move(previous, name);
      return;
    }
  } catch {
    // Nothing further to try; `.prev` survives for a later recovery step.
  }

  // The new content may already be in place (a failure in `verify` or
  // `delete-previous`). In that case the old copy at `.prev` is redundant.
  try {
    if (!rotated && fs.exists(previous)) {
      fs.delete(previous);
    }
  } catch {
    // Inert leftover.
  }
}

/**
 * Remove rotation leftovers from an interrupted earlier replacement.
 *
 * Called on every successful write and on every listing pass, so an
 * interrupted rotation cannot accumulate across app launches. It is a sweep,
 * not a recovery: a `.prev` is only removed when its live counterpart exists,
 * because a `.prev` with no counterpart is the ONLY surviving copy of a backup
 * and deleting it would be the data loss this module exists to prevent.
 *
 * Returns the names that were protected rather than deleted, so a caller can
 * surface them instead of silently keeping an artifact the user cannot see.
 */
export function sweepRotationLeftovers(fs: RotationFileSystem): string[] {
  const protectedLeftovers: string[] = [];
  for (const fileName of fs.listNames()) {
    if (!isPreviousBackupName(fileName)) continue;
    // `.foo.prev` belongs to the backup named `foo`.
    const owner = fileName.slice(1, -'.prev'.length);
    if (fs.exists(owner)) {
      try {
        fs.delete(fileName);
      } catch {
        // Inert; the next pass tries again.
      }
      continue;
    }
    // The counterpart is gone: this is the only copy left of that backup.
    protectedLeftovers.push(fileName);
  }
  return protectedLeftovers;
}
