# Lane L02 — data portability and its integration edges

## Scope covered

- Deeply inspected (complete reads):
  - `apps/mobile/src/data-portability/*.ts` — `types.ts`, `serialize.ts`, `checksum.ts`,
    `canonical-json.ts`, `deserialize.ts`, `apply.ts`, `preview.ts`, `triggers.ts`, `wipe.ts`,
    `report.ts`, `transport.ts`, `file-transport.ts`, `index.ts` (13 modules).
  - `apps/mobile/src/progression/*.ts` — `focus-sync.ts`, `seeding.ts`, `sync.ts`, `index.ts`.
  - `apps/mobile/src/sync/*.ts` — `types.ts`, `change-log.ts`, `conflict.ts`, `engine.ts`, `index.ts`.
  - `apps/mobile/src/app/data-management.tsx` (the only production UI caller, 837 lines) and its
    consuming surfaces `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`, `app/rewards.tsx`
    (focus-sync call sites), `workout/use-workout.ts`, `workout/use-workout-result-advance.ts`,
    `workout/events.ts`.
  - Consumed (read-only) DB layer: `db/schema.ts` (753 lines, all tables/indexes/triggers/migrations),
    `db/migrate.ts`, `db/index.ts`, `db/adapters/expo.ts`, `db/profile.ts`, `db/quests.ts`.
  - Native dependency behaviour: `apps/mobile/node_modules/expo-file-system@57.0.7` Android sources
    (`fsops/CopyMoveStrategy.kt`, `fsops/DestinationSpec.kt`, `fsops/DestinationSink.kt`,
    `FileSystemModule.kt`).
- Structurally inspected (grep/symbol/call trace): all 18 `data-portability/__tests__/*` files
  (test-name map), `progression/__tests__/*`, `sync/__tests__/*`, `app/__tests__/data-management.test.tsx`,
  `components/settings/confirm-button.tsx`, `workout/session-provenance.ts`, `sdk/rng.ts`,
  `quests/evaluate.ts`.
- Diagnostics run:
  - `npx jest src/data-portability/__tests__/{canonical-json,checksum,serializer}.test.ts src/progression/__tests__/focus-sync.test.ts src/sync/__tests__/sync-seams.test.ts --silent`
    → **5 suites / 31 tests passed**, exit 0.
  - `grep -rn` import/export/wipe call-site sweep across `apps/mobile/src` (callers table below).
  - Read of the installed `expo-file-system` Android implementation to establish the real
    `File.move(dest, {overwrite:true})` ordering (client-side library, shipped SDK 57.0.7).
- Intentionally excluded:
  - `db/schema.ts`/`db/migrate.ts` internals (owned by L01; cross-referenced, not re-reported).
  - Encrypted backups / checksum-as-MAC (accepted debt, `docs/DEFERRED_DECISIONS.md:28`).
  - `expo-sqlite` native behaviour and device-only flows (no emulator per brief; noted as
    `requires runtime validation` where it matters).
  - `sync/**` runtime behaviour: the module has **no production importers** (verified below), so it
    was reviewed as a frozen seam, not as a live flow.

## Flow map

1. **Export**: `data-management.tsx:onExport` → `exportLocalDataBundle(getDb())`
   (`serialize.ts:487`) → `readSnapshot` (`serialize.ts:110`, one `db.transaction` read of 13 raw
   SELECTs) → `buildExportPayload` (`serialize.ts:449`) → `serializeEnvelopeWithChecksum`
   (`serialize.ts:432`: single pass, `writeCanonicalJson` chunks → text **and** incremental
   `Sha256`) → `backupTransport.writeBackup(name, text)` (`file-transport.ts:135`: temp write +
   `move(..., {overwrite:true})`) → `shareBackupFile` (`file-transport.ts:268`) on press.
2. **Import**: `onLoadFromFile`/`onLoadBackup` (`pickBackupFile`, `file-transport.ts:200`;
   `readBackup`, `file-transport.ts:160`) → `setImportText` → `onPreview`/`onImport`
   (`data-management.tsx:275/319`) → `previewImport` (`preview.ts:71`: `parseAndValidateBackup`
   → `applyData` in an aborted transaction) → `applyImport` (`apply.ts:872`: capture/drop
   triggers → `db.transaction` → `applyData` → `recreateTriggers` in `finally`) →
   `emitWorkoutChanged()` + `refreshProgression()` (replace only).
3. **Validation**: `parseAndValidateBackup` (`deserialize.ts:491`) gates: size → JSON.parse →
   `format` → `version` (integer ≥ 1, > `BACKUP_FORMAT_VERSION` rejected) → `checksum`
   (SHA-256 over `canonicalString(payload minus checksum)`) → `validateData` (per-section shape,
   enum, DB-range and same-backup FK checks).
4. **Merge/replace apply**: `applyData` (`apply.ts:790`): within-backup dedupe by natural key →
   (replace) `DELETE` in `FK_DELETE_ORDER` → 13 section writers, children before parents.
5. **Progression/sync edges**: replace import → `stripImportedProgressionFingerprint` +
   `refreshProgression` (`progression/seeding.ts:63`) + the module-level focus gate
   (`progression/focus-sync.ts`) consumed by Home/Profile/Rewards; the append-only guards restored
   by `triggers.ts:38` and re-asserted on boot by `ensureSchemaGuards` (`db/migrate.ts:101`).

## Findings

### L02-F01 — Backup overwrite is not atomic: the destination is deleted *before* the rename, so a crash can destroy the previous backup

- Severity: P2
- Confidence: confirmed
- Category: reliability | data-integrity
- Files: `apps/mobile/src/data-portability/file-transport.ts:126-158` (`createFileBackupTransport.writeBackup`),
  `apps/mobile/src/data-portability/__tests__/file-transport.test.ts:280-300`,
  `apps/mobile/node_modules/expo-file-system/android/src/main/java/expo/modules/filesystem/fsops/CopyMoveStrategy.kt:59-100`
  (`prepareAsDestination` / `tryNativeMove`), `apps/mobile/src/app/data-management.tsx:174-176`,
  `.agent/BACKLOG.md:37-41`
- Evidence:
  - Repo claim (`file-transport.ts:127-130`): *"Overwrite semantics: writing an existing name replaces
    it with a temp-file write followed by an atomic same-directory move. **A failed write therefore
    leaves the previous complete backup available for recovery.**"* and `:139-140` *"A same-directory
    rename is atomic on the app's private filesystem."*
  - The write is `temporary.write(contents); await temporary.move(file, { overwrite: true });`
    (`file-transport.ts:146-147`).
  - Installed library (SDK 57.0.7) resolve path for `File.move(dest, {overwrite:true})`:
    ```kotlin
    // CopyMoveStrategy.kt (LocalFile.prepareAsDestination)
    target.takeIf { it.exists() }?.let {
      if (!spec.overwrite) throw DestinationAlreadyExistsException()
      it.deleteRecursively()          // <-- destination deleted FIRST
    }
    ```
    then `tryNativeMove` falls back to `resolved.receiveFrom(file)` (a plain copy) + source delete when
    `renameTo` fails, and `DestinationSink.LocalFile.receiveFrom` uses `copyFileNio`/stream copy.
    `FileSystemModule.kt:213` (`AsyncFunction("move")`) calls exactly `file.move(...)` → `moveTo` →
    `spec.resolve(file)` (`DestinationSpec.kt:28`) → the strategy above.
  - The pinned test asserts the opposite, because the in-repo double implements a non-deleting swap:
    `file-transport.test.ts:280` *"keeps the previous complete backup when the overwrite move fails
    (EACCES)"*; the mock's `move` (`:119-128`) throws *before* touching either path.
  - `.agent/BACKLOG.md:37-41` frames the exposure only as the *new* file ("can lose the new backup
    after the old one was replaced"), and the accepted-debt register names only *fsync*.
- Problem: with `overwrite: true` the previous backup file is deleted first and the new content only
  reaches the final name afterwards. A kill/power loss in that window leaves the destination name
  **absent** and the only copy sitting under the hidden temp name (`.name.<nonce>.tmp`, filtered out
  of `listBackups`). The `renameTo` fallback (copy + delete of the source) additionally leaves a
  partial file at the **final** name if the copy fails after the delete, so the "atomic" and
  "previous backup survives" guarantees do not hold on device.
- Why it matters: the backups folder is the user's only escape hatch from a wipe/replace
  (`data-management.tsx:392-430` offers "Export a backup first"), and `writeBackup` silently
  overwrites when the user types a name that already exists (`data-management.tsx:174`: *"A typed name
  wins"*; no confirm step, unlike per-backup Delete). The realistic failure is a low-memory kill or
  power loss during the write of a large (multi-MB) backup: the user is told "Saved on this phone as
  X", finds the file gone from the list, and their previous good backup is unrecoverable.
- Root cause: the transport assumes POSIX `rename(2)` semantics for an API that performs
  `delete(destination)` then `rename` when `overwrite` is set; the test double encodes the assumed
  semantics instead of the library's.
- Recommended solution: keep the temp-write pattern but make replacement crash-safe at the file level:
  (1) never overwrite implicitly from the UI — on an existing name either refuse, auto-suffix
  (`defaultBackupName` already has the collision machinery), or route through `ConfirmButton`;
  (2) rotate first: `move(final, final + '.prev', {overwrite:false})` (a *creation* rename, which does
  not delete anything) → `move(temp, final, {overwrite:false})` → best-effort delete of `.prev` only
  after the move resolves; (3) keep the `.prev` out of `listBackups` unless it is the only survivor;
  (4) fix the doc comment and the BACKLOG wording to state the real exposure.
- Implementation considerations: `.prev` must be excluded from listing (or shown as "recovered
  previous backup") and cleaned up on the next successful write; the fallback copy path means a
  *successful* `move` return is the only proof of a complete file — anything else must keep `.prev`;
  `fsync` stays deferred (accepted) — do not re-open it in this change.
- Dependencies: `file-transport.ts` (L02), `data-management.tsx` name input (L02), `.agent/BACKLOG.md`
  item "Backup file rename durability".
- Risks: an extra rename per write on a path the UI calls synchronously; a stale `.prev` left after a
  crash must never shadow the real file in restore flows.
- Validation required: unit test with a double that reproduces the library's real order (delete
  destination, then rename, then a fault) asserting the previous content is still readable under some
  name; a device scenario — export, export again with the same typed name, `adb shell am force-stop`
  between the two writes, relaunch, confirm a complete backup exists.
- Completion criteria: the "previous complete backup available for recovery" property is either true
  on device (proved by the fault-injection test that mimics delete-then-rename) or the claim is
  removed from the code and BACKLOG; no UI path silently destroys an existing backup.

### L02-F02 — Validation collects one unbounded string per bad entry, so a size-legal hostile backup is amplified into a multi-hundred-MB error message

- Severity: P2
- Confidence: confirmed (code + size arithmetic); the exact device failure point `requires runtime validation`
- Category: reliability | security (DoS) | data-integrity (fails as a crash instead of a typed error)
- Files: `apps/mobile/src/data-portability/deserialize.ts:78-460` (all `issues.push` sites, e.g.
  `:94`, `:113`, `:152`, `:408-445`), `apps/mobile/src/data-portability/types.ts:288-294`
  (`BackupDataValidationError`), `apps/mobile/src/data-portability/preview.ts:80-90` +
  `:132-160` (`reject(..., details)`), `apps/mobile/src/app/data-management.tsx:345-352`
- Evidence:
  - `types.ts:292`: `super(\`Backup data failed validation: ${issues.join('; ')}\`)` — every issue is
    joined into one string; there is no cap (`grep -rn "issues.length" src/data-portability` → none).
  - `deserialize.ts:85-95`: a section entry that is not an object pushes
    `'gameSessions contains a non-object entry'` (42 chars) **once per element**, then continues.
  - Arithmetic: the cheapest offending element is 2 JSON characters (`0,`); each yields ~44 chars of
    joined message (42 + `'; '`) ⇒ ≈22× amplification. The accepted input cap is
    `MAX_BACKUP_TEXT_LENGTH = 64 * 1024 * 1024` (`deserialize.ts:45`), so a self-consistent
    (re-signed — the checksum is integrity-only, accepted) 60 MB file can produce ≈1.3 GB of issue
    text plus ≈30 M individual strings, inside a sync validation on the JS thread.
  - The payload survives the throw: `preview.ts:88-95` passes `details: issues` into `ImportPreview`,
    which the screen stores in React state (`data-management.tsx:299` `setPreview(result)`) and
    renders (`data-management.tsx:768-780` renders `preview.error?.message`).
- Problem: the rejection path's memory is unbounded in the number of invalid entries, i.e. in the size
  of the hostile input, and is larger than the input itself. The designed failure mode ("fails fast
  with a clear error", `deserialize.ts:40-45` / 062's stated invariant) degrades into an OOM/ANR
  before the typed error can be surfaced.
- Why it matters: any externally-picked JSON (Downloads/Drive/other apps) that is valid-ish JSON,
  correct-format and re-signed can crash or freeze the app on the Data Management screen, i.e. exactly
  the screen a user visits to recover from a problem. The crash is also not diagnosable: no error
  message, no screenshot path, and the previous state is intact but the user is stuck.
- Root cause: "collect every problem" was implemented without a bound on the collected list or on the
  rendered message.
- Recommended solution: cap the reported issues (e.g. `MAX_REPORTED_ISSUES = 25`) and record a
  remainder count in the message (`'… and N more problems'`); keep the full list only when small
  (`issues.length <= cap`). Optionally stop early per section. Keep `details` bounded too (drop it
  above the cap).
- Implementation considerations: several tests assert on the full joined text
  (`hardening.test.ts:102/235/254/580`, `legacy-envelope.test.ts:218`) — they use one or two issues, so
  a cap of ~25 keeps them green; the message must stay a plain string for the preview `reject` channel;
  the cap belongs in `validateData`, not in the UI.
- Dependencies: none outside `data-portability`; relates to L02-F03 and to the accepted
  "checksum-is-integrity-not-MAC" position (the forgery precondition).
- Risks: capping could hide the *first* useful issue if the cap is applied after filtering rather than
  in insertion order (keep the first N in order).
- Validation required: unit test feeding an envelope with 10 000 invalid entries, asserting
  `error.issues.length <= cap` and `error.message.length < 4 KB`; re-run the affected suites.
- Completion criteria: no input within `MAX_BACKUP_TEXT_LENGTH` can make `BackupDataValidationError`
  (or the preview payload) grow super-linearly with its size; a test pins the bound.

### L02-F03 — The size cap bounds characters, not the memory the pipeline needs; the import path materializes ≥3 extra full-size copies

- Severity: P3
- Confidence: strongly indicated (allocation sites are unambiguous); device OOM threshold `requires runtime validation`
- Category: performance | reliability
- Files: `apps/mobile/src/data-portability/deserialize.ts:45`, `:491-500`, `:546-566`,
  `apps/mobile/src/data-portability/canonical-json.ts:88-101` (`canonicalString` → `join('')`),
  `apps/mobile/src/data-portability/checksum.ts:36-100` (`utf8Encode` of the *whole* string),
  `apps/mobile/src/app/data-management.tsx:329-345`, `:688-712` (`TextInput value/maxLength`)
- Evidence:
  - `deserialize.ts:45`: `MAX_BACKUP_TEXT_LENGTH = 64 * 1024 * 1024` with the rationale *"the gate
    exists so a hostile/mis-picked multi-hundred-MB file fails fast with a clear error instead of
    OOM-ing the JS runtime inside JSON.parse"*.
  - Peak allocations on the import path for one accepted file of size S: `text` (S) + `JSON.parse`
    object graph (~3-8×S for row arrays) + `canonicalString(payload)` (S, `chunks.join('')`) +
    `utf8Encode(canonical)` (S bytes) — and note the import path feeds the hash **one** giant chunk
    (`checksum.ts:100-113`), unlike the export path's 16 KB streaming chunks
    (`canonical-json.ts:44-56`).
  - The same text is then stored into screen state and handed to a multiline `TextInput`
    (`data-management.tsx:688-712`; the style block's own comment `textArea.maxHeight` still says
    *"a loaded backup is ~20KB of JSON"* — stale for a 20 k-session backup).
  - The only measured memory probe is opt-in and export-side (`__tests__/large-backup-memory.test.ts`
    header: *"OPT-IN measurement — skipped in normal CI (`LARGE_BACKUP_PROBE=1` enables)"*), and the
    apply/import path is pinned only at 4 000 rows (`adversarial.test.ts:463`), not 20 k.
- Problem: 64 M characters is ~4-8× more than a React Native app can hold at peak across these copies,
  so the gate's stated purpose only holds for "hundreds of MB" inputs; a 20-60 MB file passes the gate
  and then OOMs (or ANRs) mid-pipeline. There is no measured, evidence-backed bound, and the UI adds a
  further copy inside a `TextInput`.
- Why it matters: the failure is a hard crash (Hermes OOM abort) or a multi-second frozen UI on the
  data-management screen, which is the same screen that hosts the recovery flow; the user gets no
  typed error and no partial state guarantee.
- Root cause: the cap was chosen from "what is obviously hostile" rather than from a memory budget for
  the pipeline that consumes it; the import path was not part of the campaign-010 single-pass memory
  work (which optimized export only).
- Recommended solution: (1) derive the cap from a stated budget (e.g. ~8 MB, ~10× below a 64-128 MB
  working budget) and document the derivation; (2) make the import checksum consumption streaming — hash
  `canonicalChunks(payload)` one chunk at a time instead of `canonicalString(...)` + `utf8Encode(...)`;
  (3) avoid the `TextInput` render for large imports (show "loaded N characters from <file>" instead of
  the text, or truncate the displayed value while keeping the full text in a ref).
- Implementation considerations: lowering the cap must keep all real exports valid (20 k sessions
  ≈ 15-20 MB of canonical text per the probe's fixture, so a cap must still clear realistic payloads —
  measure before choosing); `pickBackupFile`'s byte gate and the paste guards use the same constant, so
  one change moves all three; the streaming hash change must keep `ChecksumMismatchError` behaviour and
  the byte-identical digest (pin with the existing `serializer.test.ts` vectors).
- Dependencies: L02-F02 (same hostile-input surface); `checksum.ts`/`canonical-json.ts` are shared with
  the export path and with `sync/conflict.ts` (`canonicalString` tie-break) — do not change the byte
  contract.
- Risks: lowering the cap can reject a legitimate large backup (user-visible new failure); the
  `TextInput` change touches a11y-captured UI (`data-management.test.tsx` asserts the input value).
- Validation required: run the opt-in probe with `LARGE_BACKUP_PROBE=1` and record peak heap for
  20 k sessions; add a device measurement (export→import of that same file); assert the digest is
  unchanged after the streaming change.
- Completion criteria: the cap is justified by a recorded measurement and the import path's peak heap
  for a cap-sized input is documented as within budget; no code path materializes more than one full
  copy of the canonical text at a time.

### L02-F04 — A user-typed backup name beginning with `.` or ending in `.tmp` is written and reported as saved, but the listing hides it (unrestorable, undeletable)

- Severity: P3
- Confidence: confirmed
- Category: frontend | data-integrity (user-visible state mismatch)
- Files: `apps/mobile/src/data-portability/file-transport.ts:179-183` (listing filter),
  `:135-136` + `transport.ts:16-25` (`validateBackupName` / no name policy),
  `apps/mobile/src/app/data-management.tsx:168-180` (name field → `writeBackup`),
  `openspec/changes/062-backup-import-export-robustness/audit-map.md:27`
- Evidence:
  - `file-transport.ts:182`: `.filter((name) => !name.startsWith('.') && !name.endsWith('.tmp'))`
    with the comment *"dotfiles and atomic-write temp leftovers … are never restorable backups and must
    not be selectable in the UI"*.
  - `validateBackupName` (`:36-50`) only rejects empty/`.`/`..`/slashes/NUL — a leading `.` or a `.tmp`
    suffix is accepted, and `data-management.tsx:174` writes exactly the user-typed name
    (`const name = backupName.trim() || defaultBackupName(...)`), then reports
    *"Saved on this phone as ${name}"* (`data-management.tsx:181`).
  - 062 recorded the filter itself as out of scope (*"Listing filter (would hide user data; orphans
    deletable)"*), but that note assumed filter-internal orphans — not a user-chosen name.
- Problem: the write path and the list path disagree about which names exist. Typing `.full.json` (or
  `my.tmp`) produces a real file, a success message with that name, and no row in "Saved Backups" —
  the user cannot load, share or delete it from the UI, and cannot tell whether the export happened.
- Why it matters: silent, unrecoverable-from-UI divergence in the exact flow the screen exists for;
  the file is also invisible to the "Saved backup files are kept" wipe messaging.
- Root cause: listing hygiene filters by *name shape*, while the writer accepts any non-traversing name.
- Recommended solution: validate the name policy at the write boundary — reject or normalize names
  that `listBackups` would hide (e.g. strip/normalise a leading dot, refuse a `.tmp` suffix, or store
  temp files in a dedicated `backups/.tmp/` subdirectory so name shape is no longer the signal); keep
  the filter as defence in depth.
- Implementation considerations: changing the temp convention requires updating the listing filter's
  second clause and `file-transport.test.ts:233-247`; do not add stricter validation that would orphan
  files already written on user devices (the 062 non-goal) — surface them instead of hiding them if any
  exist.
- Dependencies: L02-F01 (same write path); 062 audit-map item.
- Risks: a stricter name rule is a small behaviour change for users who relied on a dot/suffix name.
- Validation required: transport test asserting `writeBackup('.x.json', …)` either throws with a
  readable message or produces a listed name; UI test that the success message never names an unlisted
  file.
- Completion criteria: no accepted `writeBackup` name is invisible to `listBackups` (property test over
  the name policy), or the invisible case is impossible by construction.

### L02-F05 — A backup from a newer schema/engine imports silently: unknown fields are dropped and lost on the next export, and no preview signal exists

- Severity: P3
- Confidence: confirmed (no gate exists; the reverse-additive case is deliberately tolerated and tested)
- Category: data-integrity | api-contract
- Files: `apps/mobile/src/data-portability/types.ts:20-35` (`BACKUP_FORMAT_VERSION`/`BACKUP_ENGINE_VERSION`),
  `deserialize.ts:524-566` (only `version` is gated; `schemaVersion` is copied as provenance),
  `serialize.ts:68-96` (`RAW_SELECT.sessions` uses `SELECT *`, others use fixed column lists),
  `apps/mobile/src/data-portability/report.ts:44-58` (`BackupMeta`),
  `apps/mobile/src/app/data-management.tsx:735-782` (preview card renders counters + notes only),
  `__tests__/legacy-envelope.test.ts:179-202` (unknown keys tolerated on purpose)
- Evidence:
  - `deserialize.ts:527-538` rejects only `version > BACKUP_FORMAT_VERSION`; `schemaVersion` is
    *"informational and never blocks an import"* (`types.ts:112-116`) and unknown envelope/data keys are
    accepted by design (`legacy-envelope.test.ts:179`).
  - The importer writes a fixed column list per table (`apply.ts:186-200`, `writeWorkouts`, …), so any
    field a newer writer added is silently ignored; re-exporting then drops it permanently.
  - The export side reads fixed columns (`serialize.ts:68-81`) with `SELECT *` → hand-projected for
    sessions, so a future column would also be silently omitted from new backups. No test compares the
    `BackupData` sections against the schema's columns (`grep -rn "table_info" src/data-portability` →
    only `rollback.test.ts` for triggers/tables).
  - `BackupMeta.createdAt/appVersion/schemaVersion/format/version` are computed
    (`preview.ts:29-40`) but the screen renders none of them (`grep -n "preview.meta" data-management.tsx`
    → no match), and `ImportCounters.warnings` is never populated (`report.ts:12-43`, only
    `emptyCounters`).
- Problem: forward compatibility is "accept and quietly drop"; the user (and the QA harness) get no
  signal that the file was written by a newer app version, and a restore-from-a-newer-device backup can
  silently lose data that the newer app recorded.
- Why it matters: "restore on an older install" is a realistic support path (phone replacement, a
  downgrade after a bad update). Silent field loss is undetectable after the fact and violates the
  product's own backup promise ("one versioned, checksummed JSON file containing your full local
  training history", `data-management.tsx:559-566`).
- Root cause: no producer/reader version handshake and no surfaced metadata; the existing `notes`
  channel (`preview.ts:165-180`) was never used for provenance.
- Recommended solution: compare `envelope.schemaVersion`/`engineVersion` against local
  `SCHEMA_VERSION`/`BACKUP_ENGINE_VERSION` and push a `notes` entry (and a `warnings` entry) when the
  producer is newer — "this backup was written by a newer app version (schema 13; this app reads 12);
  fields this version does not understand will not be restored"; render `meta.createdAt`/`schemaVersion`
  in the preview card.
- Implementation considerations: keep the import *permissive* (never block — the constitution requires a
  usable restore path); the message must be honest but not alarming; the same channel should carry
  "unknown sections ignored" counts if a section is missing. Do not invent a hard rejection.
- Dependencies: L01 owns schema-version semantics; this finding is only about the portability boundary
  (preview messaging + provenance comparison).
- Risks: over-warning on every restore from a device that is one version newer (the app ships monthly)
  — prefer one concise note, not a banner.
- Validation required: unit test — envelope with `schemaVersion: SCHEMA_VERSION + 1` and an unknown
  section field → `previewImport` returns `valid: true` **and** a note mentioning the newer version;
  snapshot/assertion on the preview card.
- Completion criteria: importing a newer-written backup is still allowed but never silent; a test pins
  the note.

### L02-F06 — Imported-pick cache copies and orphaned write temp files are never cleaned (plaintext user data with no removal path)

- Severity: P3
- Confidence: confirmed for the code paths; the accumulated volume `requires runtime validation`
- Category: reliability | config (storage lifecycle)
- Files: `apps/mobile/src/data-portability/file-transport.ts:200-256` (`pickBackupFile`,
  `copyToCacheDirectory: true`, no delete of `asset.uri`), `:141-158` (temp cleanup only on the catch
  path, best-effort), `:179-183` (temp files hidden from listing),
  `apps/mobile/src/app/data-management.tsx:672-700` ("Saved Backups" copy: no size/count visibility)
- Evidence:
  - `file-transport.ts:214-217`: `getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, … })` —
    the picker copies the chosen document into the app cache; the code reads `file.text()`
    (`:256`) and never deletes the copy.
  - `writeBackup`'s catch block deletes the temp only when the *write/move* throws (`:148-158`);
    a process kill between `write(contents)` and `move` leaves `.name.<nonce>.tmp` forever, and the
    comment acknowledges it as harmless but nothing reaps it (no sweep on later writes or on
    `listBackups`).
  - `listBackups` (`:173-185`) hides both classes, so the user cannot see or delete them.
- Problem: two classes of full-size plaintext copies of the user's entire training history persist
  outside any UI affordance (app cache for every picked file, hidden temps for interrupted writes), and
  there is no pruning or summary for the backups folder itself.
- Why it matters: on a storage-constrained device the user can accumulate tens of MB of undeletable
  copies (repeatedly picking the same multi-MB backup from Drive is the natural behaviour when an import
  fails), and the extra copies widen the on-disk footprint of data the product promises to keep local.
  The wipe flow explicitly keeps backup files (`data-management.tsx:433-436`), so nothing reclaims them.
- Root cause: the picker API's cache semantics are not compensated for, and temp cleanup is
  catch-path-only.
- Recommended solution: delete the picked cache copy after read (best-effort, in a `finally`);
  reap `.tmp` leftovers at `listBackups`/`writeBackup` time (age-based, e.g. > 1 day); show the backups
  folder size/count on the Data Management card and offer a "delete all backups" affordance behind the
  existing two-tap confirmation.
- Implementation considerations: only delete paths the app owns (`Paths.cache` copy, not a
  user-selected `content://` original); never delete a temp file that is younger than the current write
  in flight; the 062 residual ("no user file is ever hidden from listing") means reap only files
  matching the writer's own temp pattern.
- Dependencies: L02-F04 (name/filter policy), L02-F01 (write path).
- Risks: deleting a cache copy the picker still references (delete after the text read resolves);
  age-based reaping that removes a live temp on a very slow device (guard with `mtime` + a run counter).
- Validation required: transport test — pick → assert the copy is deleted after read; write with an
  injected kill between write and move → assert the next `listBackups`/write reaps the stale temp;
  device check of `du` on the backups folder after 10 imports.
- Completion criteria: no app-owned plaintext copy of a backup outlives the operation that created it
  beyond a documented, bounded grace period; the user can see and reclaim the folder's footprint.

### L02-F07 — The import path bypasses the progression focus gate's bookkeeping, so other surfaces can serve a pre-import snapshot for up to 5 s

- Severity: P3
- Confidence: confirmed
- Category: correctness | frontend
- Files: `apps/mobile/src/progression/focus-sync.ts:56-100` (`markProgressionSynced`, gate state),
  `apps/mobile/src/app/data-management.tsx:360-372` + `:405-415` (`refreshProgression(getDb())` direct
  call, no gate bookkeeping), `apps/mobile/src/app/(tabs)/profile.tsx:231-241` (snapshot reuse),
  `apps/mobile/src/app/(tabs)/index.tsx:230-243`, `apps/mobile/src/app/rewards.tsx:110-122`
- Evidence:
  - `markProgressionSynced` is called only inside `runProgressionSync` (`focus-sync.ts:88-95`); the
    data-management import/wipe paths call `refreshProgression` directly.
  - Profile reuses the cached snapshot whenever the gate says "not due"
    (`profile.tsx:233-240`: `let questSnapshot = lastSyncedQuestSnapshot(); if (due || snapshot === null)
    { … }`) and derives its quest rows/evaluations from it (`profile.tsx:262-268`).
  - The gate's decision is fingerprint-based on the *newest session*
    (`focus-sync.ts:37-52, 68-81`), which a **replace** import can leave unchanged (restoring a backup
    whose newest session is the same one already present), so the window can stay closed after data
    changed.
- Problem: after an import the module-level `lastSnapshot` may predate the import while the gate
  reports "fresh"; consumers then evaluate quests against the pre-import session sample for up to
  `FOCUS_PROGRESSION_SYNC_MIN_MS` (5 000 ms).
- Why it matters: the visible symptom is a briefly wrong quest/claimable view immediately after a
  restore — exactly when a user is likely to look — and the profile screen's `owned`/progress numbers can
  disagree with the rows the same screen reads from the DB. Impact is bounded (≤5 s, derived view only;
  persisted rows are always correct because the import path syncs directly).
- Root cause: the gate's invalidation surface is "newest session fingerprint" only; imports mutate
  history in ways that fingerprint cannot express, and the direct `refreshProgression` call is invisible
  to the gate.
- Recommended solution: have the import/wipe paths record the completed sync
  (`markProgressionSynced(Date.now(), progressionInputFingerprint(newestAfterImport), snapshot)`) or add
  an explicit `invalidateProgressionFocusGate()` called from `onImport`/`onWipe`; the fingerprint read
  already exists (`readNewestProgressionInput`).
- Implementation considerations: `refreshProgression` returns the snapshot, so the call site can pass it
  straight to `markProgressionSynced`; keep `resetProgressionFocusSyncForTests` semantics; do not
  weaken the throttle for ordinary focus events.
- Dependencies: `progression/focus-sync.ts` (L02 scope), the three consuming surfaces (L02 scope).
- Risks: invalidating on every import could re-run the ~5 000-row sample scan more often than needed —
  one invalidation per completed import is negligible.
- Validation required: `focus-sync.test.ts` addition — after a simulated import the gate must report
  "due" (or the snapshot must be the post-import one); a UI-level test that Home/Profile re-evaluate
  immediately after a replace import.
- Completion criteria: no consumer can observe a progression snapshot older than the last completed
  import/wipe; test pins it.

### L02-F08 — Two overlapping destructive operations share one non-reentrant trigger drop/recreate prologue

- Severity: P3
- Confidence: suspected (mechanism read from code; the UI's `busy` guard makes it hard to trigger, exact interleaving `requires runtime validation`)
- Category: concurrency | observability (error quality)
- Files: `apps/mobile/src/data-portability/apply.ts:872-898` (`applyImport`),
  `apps/mobile/src/data-portability/preview.ts:90-115`, `apps/mobile/src/data-portability/triggers.ts:29-75`
  (`captureTriggers`/`dropTriggers`/`recreateTriggers`/`clearTablesIgnoringTriggers`),
  `apps/mobile/src/app/data-management.tsx:319-334` (the `busy` guard, set asynchronously)
- Evidence:
  - `applyImport` captures the trigger set, drops it, runs the clear+apply transaction, recreates the
    captured set in `finally` (`apply.ts:884-892`). The same prologue exists in the preview path and in
    `clearTablesIgnoringTriggers` (used by `wipeLocalData`).
  - A second operation starting in the window between the first operation's `dropTriggers` and its
    `recreateTriggers` captures an **empty or partial** trigger list (its `captureTriggers` is a plain
    `SELECT name, sql FROM sqlite_master WHERE type = 'trigger'`), so its own `finally` recreates only
    what it captured.
  - If the second operation's transaction lands after the first operation's recreate, its `DELETE FROM
    rating_history` is rejected by the restored append-only trigger (schema.ts
    `trg_rating_history_no_delete`), so the whole import aborts with an opaque
    `"rating_history is append-only: DELETE forbidden"` message surfaced as `Import failed: …`
    (`data-management.tsx:382`).
  - The UI guard is `if (busy) return;` reading React state set by `setBusy(true)`
    (`data-management.tsx:320-333`), which a same-tick double dispatch can bypass.
- Problem: the destructive prologue is not serialized or mutually exclusive. Depending on interleaving,
  a second operation either succeeds silently (normal sequential replace — acceptable) or fails with a
  confusing internal error, and the final trigger set is only guaranteed correct because of A's full-set
  recreation and the boot-time `ensureSchemaGuards` (`db/migrate.ts:101-114`).
- Why it matters: no data corruption is possible (every clear/apply is in one transaction and the
  triggers are healed on the next boot — L01 owns `ensureSchemaGuards`), but a user-visible
  "append-only … DELETE forbidden" message on a data-restore screen is unreportable and looks like
  corruption; the failure also cannot be retried from the message.
- Root cause: mutex state lives in React state, while the invariants live in module-level DB state; the
  trigger prologue is not defended against concurrent entry.
- Recommended solution: serialize destructive portability operations with a module-level promise/flag in
  `triggers.ts` or `apply.ts` (e.g. `withTriggerGuards(db, fn)` that queues callers), and translate a
  mid-prologue failure into a typed `BackupError` ("another restore is in progress — try again").
- Implementation considerations: `previewImport` also drops triggers for replace mode, so the guard must
  cover preview+apply pairs; the adapter forbids nested transactions, so the guard is a plain
  async mutex, not a transaction; keep `ensureSchemaGuards` as the last line of defence.
- Dependencies: L01 (trigger/schema-guard layer); `data-portability/__tests__/rollback.test.ts` already
  covers the mid-DDL failure path for a single operation.
- Risks: an over-broad mutex could deadlock the preview-if-apply flow (both are called sequentially from
  the screen, so a queue is fine; a rejection would not be).
- Validation required: test that starts `applyImport` and `wipeLocalData` concurrently and asserts
  exactly one succeeds with a typed "in progress" error for the other and a full trigger set afterwards.
- Completion criteria: concurrent destructive operations cannot produce an append-only trigger error or
  a partially recreated guard set; a test pins the serialization.

### L02-F09 — Inert seams and stale claims inside the portability module (dead replace path, no-op algorithm branch, stale transport header)

- Severity: P3
- Confidence: confirmed
- Category: docs-dx | architecture | observability
- Files: `apps/mobile/src/data-portability/apply.ts:900-932` (`buildDatabaseFromBackup`),
  `apps/mobile/src/data-portability/deserialize.ts:558-564` (empty `checksumAlgorithm` branch),
  `apps/mobile/src/data-portability/transport.ts:20-37` (stale "PRODUCTION INTEGRATION" block),
  `apps/mobile/src/data-portability/report.ts:12-43` (`warnings: []`),
  `apps/mobile/src/data-portability/index.ts` (exported but unreferenced)
- Evidence:
  - `buildDatabaseFromBackup` is documented as *"Intended for the production 'replace' path where the
    transport swaps the physical database file"* (`apply.ts:903-907`) but has **no production caller**:
    `grep -rn "buildDatabaseFromBackup" apps/mobile/src` → the barrel export and
    `__tests__/apply.test.ts:335` only; the real replace path is `applyImport`'s in-place transaction.
  - `deserialize.ts:558-564`:
    ```ts
    if (parsed.checksumAlgorithm && parsed.checksumAlgorithm !== CHECKSUM_ALGORITHM) {
      // Informational only: … but we surface it for debugging.
      // (Kept defensive: if a future algorithm is introduced, this is the seam.)
    }
    ```
    an empty branch that surfaces nothing (and is unreachable for the label to differ, since the checksum
    covers `checksumAlgorithm`).
  - `transport.ts:20-37` still instructs *"PRODUCTION INTEGRATION (owner: merge session) — to make
    export/import reach the filesystem on device, implement `BackupTransport` with …"* although
    `file-transport.ts` has shipped that implementation since campaign 010 and is wired at
    `data-management.tsx:75`.
  - `ImportCounters.warnings` is initialised and re-exported but never written or rendered
    (`grep -rn "warnings" src/data-portability` → `report.ts` only).
- Problem: four small doc/API drifts in the module a recovery flow depends on: a dead file-swap path, a
  seam that only exists in a comment, a header that contradicts the shipped wiring, and an unused
  diagnostic channel that would be the natural home for L02-F05's warning.
- Why it matters: the next agent reading `transport.ts` or trusting `buildDatabaseFromBackup` as "the
  production path" will reason about the wrong architecture (this audit found the drift only by
  grepping call sites); a dead branch claiming to surface an algorithm mismatch hides the fact that no
  such diagnostic exists.
- Root cause: incremental campaigns left the campaign-009-era scaffolding in place.
- Recommended solution: delete `buildDatabaseFromBackup` (or move it to tests and stop documenting it
  as the production path), delete the no-op branch (or make it push a `warnings` entry), rewrite the
  `transport.ts` header to describe the current wiring, and use `warnings` for import provenance notes
  (L02-F05) or remove it.
- Implementation considerations: `buildDatabaseFromBackup` is covered by a test; if it is removed, keep
  an equivalent assertion (a freshly built adapter from a backup is transactionally complete) or move it
  into the test helper; no behaviour change.
- Dependencies: L02-F05 (the warning channel), `index.ts` public surface (check other lanes' imports
  before deleting an export).
- Risks: removing a public barrel export can break another lane's import; verify references first
  (currently only tests).
- Validation required: `npx eslint src/data-portability` clean + the data-portability suite after the
  cleanup; a doc-reading check that `transport.ts` describes the shipped transport.
- Completion criteria: no production-documented path without a caller, no empty branch claiming to
  surface something, no unused diagnostic field; suite green.

## Checked and found clean

- **Checksum algorithm and coverage**: `CHECKSUM_ALGORITHM = 'sha256'` (`checksum.ts`), pure-TS,
  byte-identical across Node/Hermes; the digest covers every envelope member except `checksum` itself,
  including `checksumAlgorithm`, `manifest` and `data`, so relabelling or re-signing a *different*
  algorithm is not possible without recomputing the digest. Field order cannot matter: both writer and
  reader canonicalize (recursive key sort, arrays ordered by the snapshot builder).
- **Checksum cost**: export hashes exactly once, streaming 16 KB chunks (`canonical-json.ts:44-56`,
  `serialize.ts:432-495`) with no second walk or deep copy — the campaign-010 D2 claim is true in code;
  `computeChecksum`/`canonicalString` are linear, no quadratic patterns found in either direction.
- **Path traversal / name injection**: `validateBackupName` rejects empty, `.`, `..`, `/`, `\`, NUL
  before any FS call; `shareBackupFile`/`readBackup`/`deleteBackup` all validate
  (`file-transport.ts:36-50`, tests at `file-transport.test.ts:216-221`).
- **Temp-file visibility under a normal failure**: the temp write precedes the move, the catch deletes
  only the temp, and `.name.<nonce>.tmp` is filtered from listing — an aborted write cannot appear as a
  restorable partial in the normal (non-overwrite) path.
- **Replace-import atomicity and rollback**: clear + all inserts happen in one `db.transaction`
  (`apply.ts:876-900`); a mid-transaction fault rolls back with the previous bytes intact
  (`rollback.test.ts:141-205`, `apply.test.ts:282-334`). The trigger drop/recreate is in `finally`, and
  `ensureSchemaGuards` heals a crash between them at next boot (`db/migrate.ts:101-114`, L01).
- **Append-only triggers enabled after every destructive flow**: asserted after replace
  (`apply.test.ts:267`) and after wipe (`wipe-audit.test.ts:33`).
- **FK-safe delete order**: `FK_DELETE_ORDER` (`apply.ts:48-62`) is children-before-parents and shared
  by wipe (`wipe.ts:96`); a dynamic test proves no user table can hide from it
  (`hardening.test.ts:527-551`).
- **Insert order after a replace**: profile → favorites → ratings → sessions → history → ledger →
  xp → tutorial → workouts → quests → progress → achievements → unlocks; every FK parent precedes its
  child, verified against `schema.ts` REFERENCES clauses.
- **Validation mirrors every constraint the DB enforces today** (they matter because replace mode drops
  all triggers): `completed_at >= started_at`, `duration_ms >= 0` + `Math.round`, `normalized_result ∈
  [0,1]`, `xp >= 0`, `rating >= 0`/`sessions >= 0`, `xp_awards.amount > 0`, `reward_* >= 0`,
  `quests.kind ∈ {daily,weekly,longterm}`, every NOT NULL column, and every INTEGER-affinity column
  (`isSafeInteger`); same-backup FK integrity for `rating_history→game_sessions`,
  `currency_ledger→game_sessions`, `quest_progress→quests`, `achievement_unlocks→achievements`
  (`hardening.test.ts:190-292`).
- **Value-shape parity with the app's own writers**: `seed` is always a safe integer
  (`sdk/rng.ts:canonicalSeedToNumber` + `sessions.ts:canonicalInteger`), `quest_progress.progress` is
  always a non-negative safe integer (`db/quests.ts:172`, `quests/evaluate.ts:59-72`),
  `workout_instances.status ∈ {active, completed}` (`db/workout.ts:43`), `gameIds` bounded by
  `MAX_WORKOUT_GAME_IDS` — so no writer can produce an export its own importer rejects (the
  asymmetry that would otherwise be a P1).
- **Idempotency**: repeated merge and repeated replace are both no-ops beyond the first
  (`adversarial.test.ts:275-341`, `apply.test.ts:111-128`); dedupe keys are natural keys with nullable
  keys never collapsed; ledger idempotency uses `operation_id` (the campaign-9 D2 reason for raw SQL in
  `readSnapshot` is honoured).
- **Primary/unique-key collisions inside one backup are pre-collapsed** before insert
  (`apply.ts:790-826`), so a replace cannot trip `idx_rating_history_session_domain` or
  `idx_currency_ledger_operation_id`.
- **Preview never mutates**: `PreviewRollback` is thrown inside the real transaction and the error is
  filtered (`preview.ts:96-116`); a rejected preview preserves the requested mode and counters
  (`ai-hardening.test.ts:494-508`, `preview.test.ts:71-101`); the parsed payload is reused by the
  subsequent apply instead of re-parsing (`data-management.tsx:352-354`).
- **Type/gate ordering** in `parseAndValidateBackup`: size → JSON → root object → `format` → integer
  `version ≥ 1` → newer-version rejection → checksum → data shape; fractional/zero/negative versions are
  malformed rather than "old" (`hardening.test.ts:52-70`).
- **Deeply nested payloads** produce a typed `MalformedBackupError` (canonical-writer `RangeError` is
  wrapped) rather than an untyped stack overflow (`hardening.test.ts:594-620`).
- **Prototype-pollution keys**: `canonicalize` uses `Object.defineProperty` for own keys
  (`canonical-json.ts:33-37`) and the writer reads own keys directly, so `__proto__`/`constructor` keys
  in a backup are serialized/hashed as data. Every consumer of imported settings spreads
  (`apply.ts:mergeProfileSettings`, `db/profile.ts:update`), which creates own properties instead of
  triggering the prototype setter; no assignment-loop merge was found.
- **Replace-import progression repair**: the imported seed fingerprint is stripped
  (`apply.ts:174-186`), `refreshProgression` re-seeds the catalogs in-process, and the seeding safety
  net also count-probes the catalogs (`seeding.ts:88-104`) — the 065 FK-loop claim is true in code and
  tested (`replace-import-progression.test.ts:74-160`).
- **Wipe is not a data-portability orphan**: `wipeLocalData` reuses `FK_DELETE_ORDER`, keeps backup
  files (documented in UI copy), and restores the catalog in-process; counts use `COUNT(*)` so they are
  exact past repository list limits (`hardening.test.ts:510-526`).
- **Session/workout provenance survives a backup round trip**: it lives inside `raw_result_json`
  (`workout/session-provenance.ts:1-12`), which the export/import carries verbatim; a round-trip test
  pins it (`roundtrip.test.ts:58-100`).
- **Import while a workout is live**: no path can run an import while a game is being played (the game
  screen owns the JS thread); after an import the UI emits `emitWorkoutChanged()`
  (`data-management.tsx:357, 404`) and `useWorkout` re-reads, while `advanceForSession` degrades to
  `{advanced:false}` when the row changed/disappeared (`db/workout.ts:713-760`) and the result screen
  only logs + surfaces a save notice (`use-workout-result-advance.ts:105-135`) — no crash path found.
- **Error typing end-to-end**: all four rejection classes map to `ImportPreview.error.kind`
  (`malformed`, `unsupported-version`, `checksum`, `data-validation`) and are rendered as text in the
  screen's live region (`data-management.tsx:339-350, 745-782`); storage/picker/share failures are
  caught per action with a readable prefix (`Export failed`, `Load failed`, `Share failed`,
  `Import failed`) and transport failures degrade to an empty list rather than a crash
  (`data-management.tsx:139-148`).
- **Platform degradation**: sharing-unavailable returns `false` with honest copy
  (`file-transport.ts:277-286`, UI test asserts it); picker cancel resolves `null` without an error;
  picker/share/file modules are lazily required so a stale dev client cannot crash startup
  (`file-transport.ts:57-95`, `file-transport.lazy.test.ts`).
- **Android scoped storage**: all writes stay inside the app document directory
  (`Paths.document/backups`), reads from outside go through the SAF document picker with a cache copy,
  and sharing goes through the system sheet — no path requires a broad storage permission.
- **062's implemented items are real**: picker size gate with a stat fallback
  (`file-transport.ts:227-255`, tests `:329-393`), paste guards + `maxLength`
  (`data-management.tsx:290, 330, 710`), honest device-copy header copy (asserted in
  `data-management.test.tsx:236-247`).
- **campaign067 `LIFECYCLE_AND_PROVIDER.md` claims re-verified statically**: the two-tap replace
  button is a `ConfirmButton` with `CONFIRM_ARM_MS = 4000` (`components/settings/confirm-button.tsx:24`)
  that disarms when disabled; the export→save→share path writes to the backups folder before offering
  Share (`data-management.tsx:174-197`); the picker open/cancel path has no error surface for a cancel.
  The "Import apply NOT VALIDATED" classification is consistent with the arm/confirm contract (a
  single-tap shell sequence cannot fire it) — a manual/ARTEMIS two-tap journey is still the only way to
  close it, as recorded.
- **`sync/**` has no production consumers** (`grep -rn "createNoopSyncEngine|SYNC_TABLE_DESCRIPTORS|
  createInMemoryChangeTracker|resolveFieldMerge" src` → `sync/index.ts` + its test only), which matches
  its documented "freeze the seam, implement nothing" intent; the resolvers are pure, argument-order
  independent (`conflict.ts:92-110`, canonical-string tie-break) and the change log is monotonic and
  coalescing (`change-log.ts:76-140`). Not a defect; recorded so no lane re-reports the dead seam.

## Not covered / could not verify

- **Device timing and memory**: exact OOM/ANR thresholds for L02-F03, real SAF variance for the picker
  size signal, real `renameTo` behaviour on different Android filesystems (F01's fallback path), and
  whether Android's low-memory killer actually strikes inside the delete→rename window. No emulator/APK
  work per the lane rules; these need an on-device pass (`LARGE_BACKUP_PROBE=1` + a crafted
  delete-then-rename fault on device).
- **`expo-file-system` iOS implementation**: only the Android Kotlin sources were read; iOS
  `File.move` overwrite semantics were not verified (`ios/` sources were not inspected), so F01 is
  proven for Android and *strongly indicated* for iOS.
- **The 065 device DB-level probe and the campaign067 runtime evidence** referenced by
  `DEFERRAL_DISPOSITION.md:11` (0 FK violations, catalog re-seed on a cold launch) are external traces;
  they were not re-run, only cross-read.
- **Full Jest matrix / other lanes' suites**: only the five targeted suites above were executed; the
  remaining data-portability suites (`adversarial`, `rollback`, `hardening`, `roundtrip`, `wipe*`,
  `apply`, `preview`, `file-transport`) were read, not run, to respect the orchestrator's ownership of
  the full matrix.
- **End-to-end UI proof of import error messaging with the *real* engine**: `data-management.test.tsx`
  mocks `@/data-portability` wholesale (`:76-131`), so the UI layer's rendering of real
  `BackupDataValidationError` payloads is only inferable from code (L02-F02/F05 recommendations should
  add one integration assertion).
- **`sync/**`'s future behaviour** (per-table merge classes vs. the backup semantics): the module is
  inert, so its descriptors cannot be validated against a live backend; noted only for consistency
  (e.g. `xp_awards` natural key `['source','reason']` matches the import's `xpAwardIdentity`, but
  nothing enforces that they stay in sync).

## Contradictions with existing documentation

1. `file-transport.ts:127-130` ("atomic same-directory move … a failed write therefore leaves the
   previous complete backup available for recovery") and `.agent/BACKLOG.md:37-41` (which frames the
   risk as losing only the *new* file) contradict the installed library's delete-then-rename order
   (L02-F01). The in-repo test double encodes the same incorrect assumption, so the suite is green while
   the guarantee does not hold on device.
2. `transport.ts:20-37` ("PRODUCTION INTEGRATION (owner: merge session) — to make export/import reach
   the filesystem on device, implement `BackupTransport` …") contradicts `file-transport.ts` +
   `data-management.tsx:75`, where that implementation has shipped (L02-F09).
3. `deserialize.ts:558-564` claims to "surface it for debugging" for a differing `checksumAlgorithm`
   label; the branch is empty and unreachable because the label is inside the checksum (L02-F09).
4. `data-management.tsx:821-824` (style comment: "a loaded backup is ~20KB of JSON") contradicts the
   measured 20 k-session envelope the portability engine is built and probed for
   (`large-backup-memory.test.ts`, 20 000 sessions) — relevant to L02-F03's UI copy.
5. `openspec/changes/062-…/proposal.md` item 3 states the header copy disclosure was required because
   backing up files live in the files domain carried by Android auto-backup; the code copy matches
   (`data-management.tsx:410-419`) and the BACKLOG item exists — no contradiction, recorded because the
   audit re-verified it.
