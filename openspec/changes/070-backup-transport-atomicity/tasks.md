# Tasks — 070-backup-transport-atomicity

## 1. Bounded import diagnostics

- [ ] 1.1 Add a diagnostics budget to the import validation path in
      `apps/mobile/src/data-portability`: a retained-detail limit and an
      always-incremented total counter, so cost stops growing with problem
      count.
- [ ] 1.2 On budget exhaustion, stop appending detail while continuing to
      count, and report the exact total plus an explicit truncation notice.
- [ ] 1.3 Order retained entries so the most actionable (invalid field name and
      reason) survive truncation; never embed a full oversized field value in a
      message — truncate the value with an explicit marker.
- [ ] 1.4 Add tests: a size-legal backup with a very large number of invalid
      entries completes within a bounded allocation and reports a truncation
      notice; a single oversized field is rejected by name with a truncated
      value; a valid backup produces complete output with no truncation notice.

## 2. Name validation aligned with the listing rule

- [ ] 2.1 Extract the internal-artifact rule (dotfile prefix, `.tmp` suffix) into
      one predicate used by both `listBackups()` and `validateBackupName()`.
- [ ] 2.2 Reject a name that the listing would hide, before the file is written,
      with a message naming the reason.
- [ ] 2.3 Add tests for the accepted and rejected name classes, asserting that
      no file is created for a rejected name and that the listing predicate and
      the write-time validator agree on every case.

## 3. Crash-safe backup replacement

- [ ] 3.1 Replace the `move(..., { overwrite: true })` call in
      `apps/mobile/src/data-portability/file-transport.ts` with a rotation
      sequence: write temp → rename existing to `.prev` → rename temp into place
      → verify the new file is present and readable → delete `.prev`.
- [ ] 3.2 Ensure every intermediate state leaves at least one complete readable
      backup, and that a failure at any step reports the original error without
      masking it behind cleanup.
- [ ] 3.3 Add a fault-injection test that terminates the replacement after each
      step (before rotation, between rotation and rename, after rename, before
      `.prev` deletion) and asserts the name still reads complete previous or
      complete new content, never empty or missing.
- [ ] 3.4 Add a test proving a successful replacement leaves exactly one visible
      backup and no user-visible temporary artifact.
- [ ] 3.5 Add `.prev` orphan cleanup on the next successful write and on a
      listing pass, so an interrupted rotation cannot accumulate.
- [ ] 3.6 Preserve byte-for-byte identity of a successful export's content; run
      the existing byte-parity suites as the regression gate.

## 4. Unrecognized-content signal on import

- [ ] 4.1 Detect fields, versions, or structures present in an imported backup
      that the importing version does not understand, at preview time.
- [ ] 4.2 Surface the count and a short description in the preview, and let the
      user cancel; record a proceeding import as knowingly lossy.
- [ ] 4.3 Keep the reverse case (an older backup read by a newer app) silent and
      unchanged — it is additive and already tolerated.
- [ ] 4.4 Add tests: a newer-format backup triggers the notice and can be
      cancelled; a same-version and an older backup do not; a proceeding import
      is recorded as lossy.

## 5. Surface stranded hidden artifacts

- [ ] 5.1 On a listing pass, detect existing files that the listing rule hides
      and report them by name with an offer to delete, so a file saved under a
      previously accepted name is not stranded.
- [ ] 5.2 Add a test for the stranded-artifact path.

## 6. Documentation and durable state

- [ ] 6.1 Correct the `createFileBackupTransport` docstring: remove the
      "a same-directory rename is atomic … leaves the previous complete backup"
      claim and state the rotation guarantee that is actually implemented.
- [ ] 6.2 Record the measured dependency behavior (delete-then-rename in
      `expo-file-system`'s Android move) as the justification, with the source
      references, so a future change does not re-derive it.
- [ ] 6.3 Update `.agent/BACKLOG.md` and `docs/DEFERRED_DECISIONS.md`: the
      recorded deferral describes only the missing fsync; record that an
      ordering-level data-loss window was also present and is now closed, and
      that physical flush remains the open owner decision.

## 7. Verification

- [ ] 7.1 `npx jest src/data-portability` green, including the byte-parity and
      large-backup suites.
- [ ] 7.2 Full matrix green with no new skips; the jest signal validator passes.
- [ ] 7.3 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.4 On the dedicated AVD: save two backups under the same name, kill the
      app mid-replacement, relaunch, and confirm the name reads complete
      previous or complete new content; confirm no hidden artifact is listed and
      no user-visible temp remains.
- [ ] 7.5 Re-run the opt-in large-backup probe and compare against the committed
      baseline to confirm the bounded diagnostics and rotation did not regress
      export memory or time.
