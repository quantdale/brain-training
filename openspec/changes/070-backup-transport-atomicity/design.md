# Design — 070-backup-transport-atomicity

## Context

See `proposal.md` — Why.

The load-bearing external fact, read from the installed dependency rather than
assumed: `expo-file-system`'s Android native move is a **delete-then-rename**.
`node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/`:

- `FileSystemPath.kt:174-187` — `move(to, options)` → `file.moveTo(to.asCopyOrMoveDestination(options.overwrite))`
- `fsops/CopyMoveStrategy.kt:86-90` — `prepareAsDestination`:
  ```kotlin
  target.takeIf { it.exists() }?.let {
    if (!spec.overwrite) throw DestinationAlreadyExistsException()
    it.deleteRecursively()      // destination removed first
  }
  ```
- `fsops/CopyMoveStrategy.kt:95-112` — `tryNativeMove` then attempts
  `file.renameTo(target)`, falling back to an NIO move, then to copy+delete.

So `move(temp, dest, { overwrite: true })` has a window in which `dest` does not
exist. The current transport (`data-portability/file-transport.ts:132-158`)
performs exactly that call, while its own docstring claims "a failed write
therefore leaves the previous complete backup available for recovery". The
listing filter (added in the post-067 hardening pass) hides dotfiles, so the
surviving temp is invisible to the user: after a crash in that window the user
has no backup at that name and no indication that one was lost.

## Goals / Non-Goals

**Goals**

- No instant exists during a replacement where the backup name is unreadable.
- Diagnostics from validating a hostile input are bounded in aggregate.
- Every file the app reports as saved is discoverable and deletable.
- Content the app does not understand is surfaced, never silently dropped.

**Non-Goals**

- Encrypting backups (an owner product decision, recorded in
  `docs/DEFERRED_DECISIONS.md`).
- Changing the backup format, the checksum algorithm (integrity-not-MAC is
  recorded accepted debt), or the accepted size cap value.
- Changing what a *successful* export contains; byte parity must be preserved.
- Replacing `expo-file-system`'s legacy `File` API with the new `File`/`Directory`
  API, which is a larger migration considered separately.

## Decisions

**D1 — Rotate, then replace; do not rely on the platform overwrite.** The
guarantee must come from the sequence, not from a property of a third-party
rename that this repository has already proven to be false.

- Chosen: write `new` to a temp file; if the destination exists, rename the
  existing file to a `.prev` sibling; rename `new` into place; delete `.prev`
  only after the new file is confirmed present and readable. Every intermediate
  state has at least one complete readable backup, and a crash leaves at most a
  stale `.prev` — which the same listing rule already excludes from the user
  view but which a recovery step can adopt.
- Rejected: call `move` with `overwrite: false` after deleting the destination
  ourselves. That is the same delete-then-rename window, relocated.
- Rejected: `copy` then delete. Worse: the window is longer and the bytes are
  written twice.
- Rejected: attempt to make the rename atomic and rely on it. The property is
  not available on this dependency; the evidence is in this design.

**D2 — Durability beyond ordering: flush where the platform exposes it.**
Ordering removes the *logical* loss window. Physical durability (the bytes
reaching storage) additionally needs an fsync, which the recorded deferral
already identifies as unavailable. This change therefore improves the guarantee
to "no ordering window" and explicitly leaves the flush question open with an
owner, rather than pretending ordering is the whole answer. The `.prev` rotation
also happens to bound that residual risk: a power loss can lose the newest
backup's tail, but the previous complete backup is still present on the next
boot.

**D3 — Bound diagnostics by construction, not by truncation after the fact.**
The cost of the current behavior is allocation, so capping the retained
strings after they have been built does not fix it. Validation must stop
*appending* once a budget is exhausted, while continuing to *count* — a counter
is what lets the message say "and 12,043 more".

**D4 — Reject unlistable names at the same seam that writes them.** The listing
filter is already the definition of "a name the user cannot see". Validating
against that same rule at write time turns a data-loss trap into an input
error, and keeps the two rules from drifting apart.

**D5 — Forward compatibility is a first-class preview signal, not a silent
tolerance.** The reverse case (an older backup read by a newer app) is additive
and already tolerated and tested; that tolerance is correct and stays. The case
that loses data is a *newer* backup read by an older app, where unknown fields
are dropped and the next export writes them back missing — silent, permanent
data loss. It must be a visible decision by the user, recorded as lossy.

## Risks / Trade-offs

- **Rotation changes the on-disk artifact set.** `.prev` files appear
  transiently.
  → Mitigation: the existing listing rule already excludes dotfiles, and
  `.prev` is deleted on the success path. Add a cleanup sweep for `.prev`
  orphans so an interrupted rotation cannot accumulate.
- **Rejecting previously accepted names is a behavior change for a user who
  already saved one.** Such a file exists and is currently invisible.
  → Mitigation: on the next successful write or on a listing pass, surface any
  existing hidden artifact by name and offer deletion, rather than leaving it
  stranded. Record the decision as a product-visible fix, not a silent
  migration.
- **A bounded diagnostic list could hide a specific problem the user needs to
  act on.**
  → Mitigation: always report the first N in full plus the exact total, and
  order by the field that failed so the most actionable entries survive
  truncation.
- **Reporting lossy import could alarm users upgrading or downgrading the app.**
  → Mitigation: the notice is specific ("3 fields written by a newer version will
  not be restored") and cancellable, not a blocking error.
- **Adding a forward-compat signal touches the preview and apply paths**, which
  the replace-import journey exercises on device.
  → Mitigation: run the data-portability suites and the replace-import journey
  on the dedicated AVD; the lossy path is opt-in.

## Migration Plan

1. Bound diagnostics and reject unlistable names (independent, no format change).
2. Add rotation-based replacement, keep the byte content of a successful export
   identical, and verify with a fault-injection test that terminates between
   each step.
3. Add the lossy-import preview signal and its user choice.
4. Add `.prev` orphan cleanup and surface existing hidden artifacts.
5. Correct the transport docstring and the recorded deferral in
   `.agent/BACKLOG.md` / `docs/DEFERRED_DECISIONS.md`, which currently describe
   only the missing fsync.
6. No data migration. Rollback is a clean revert; `.prev` orphans are inert.

## Open Questions

None. The fsync question is an owner decision already recorded as deferred; this
change states its boundary explicitly rather than reopening it.
