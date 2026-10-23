# Backup/restore + migration qualification — Campaign 080 continuation

Date: 2026-10-21
Status: **NOT EXECUTED this continuation — recorded honestly.** Device time
was consumed by the mandatory certification-system repair and the 42-game
revalidation sweep (the primary directive). No data was placed at risk: no
export/import/migration operation was performed against the owner profile.

Prepared this continuation (source-verified surface): the app exposes a full
data-management instrument (`apps/mobile/src/app/data-management.tsx`):
`data-export-card`, import/validation UI, `data-counts-*` per-table counters
(sessions/ratings/history/ledger/favorites/quests/xp) — which is exactly the
authoritative row-count evidence the round-trip protocol needs
(export → row counts + artifact hash → import → counts identical →
invalid-backup rejection → interrupted-import recovery).

Exact next action (isolated fixture, never the owner profile): create a
synthetic profile via the development fixture path, run export → verify
counts/hash → import → verify identical counts → corrupt-file rejection →
interrupted-import recovery; then upgrade/migration: install the prior
compatible build, create known state, upgrade in place, verify schema
migration + progression integrity. Migration fixture must be explicitly
labelled if no authentic prior artifact exists (none is claimed here).

---

# Phase D EXECUTED — 2026-10-23 (final-engineering continuation)

Status: **PARTIALLY VERIFIED / PARTLY AUTOMATION-LIMITED** — executed against
the dedicated QA emulator profile (never any owner device), behind verified
full app-data anchors. Driver: `scripts/qa/data-management-journey.mjs`;
evidence: `qa-artifacts/080/data-management/<stamp>/` (journey JSON, WAL-
consistent DB snapshots, per-step screenshots, app-data anchor tarballs with
recorded sha256).

## VERIFIED

**Export (product UI).** `data-export-button` writes
`brain-training-backup_<date>_<time>.json` into the app-owned backups
directory. Envelope: `format=brain-training-backup`, `schemaVersion=13`,
`engineVersion=3`, sha256 `checksum` present, `manifest.sections` per-table
counts. Integrity checks all passed: `manifest.totalRecords == content records`
(316 == 316) and **8/8 section↔database count agreements** (gameSessions 49,
currencyLedger 49, questDefinitions 16, questProgress 18, achievementUnlocks 6,
ratingHistory 96, tutorialState 32, workoutInstances 6). The export path also
exposes Share (system share sheet) and per-backup Load/Share/Delete controls.

**Backups survive wipe.** The product documents this on both the Saved
Backups card ("They survive restarts and are NOT removed by deleting your
training data") and the wipe card ("Saved backup files are kept by the wipe").
Verified on device: backup files present before and after the wipe.

**Wipe (destructive clear).** Type-to-confirm `DELETE` gate observed and
exercised. All user data cleared transactionally (49 sessions → 0, ledger 0,
ratings 0, favorites 0, tutorial state 0, workout instances 0, achievement
unlocks 0). The app reseeds shipped catalog rows afterwards (quests 16,
achievements 37, fresh zero-progress quest rows, local profile) — that is
documented first-run behavior, not surviving user data.

**Recovery / rollback (ops-grade).** Full app-data anchor restore
(`tar` + `chown` + SELinux `chcon u:object_r:app_data_file:s0:c150,…`) returned
the complete 49-session profile intact **twice**, app healthy afterwards. This
is the safety net every destructive test in this phase ran behind.

**Invalid-input rejection (state invariance).** Four crafted fixtures —
malformed JSON, truncated envelope, `schemaVersion: 999`, invalid values — were
placed in the backups directory and loaded through the product's Load path.
Across every run the database state was **bitwise unchanged** (counts +
aggregates equal before/after). No fixture ever corrupted state. (The precise
per-case rejection COPY was not consistently captured by automation; the
screenshots in the run directories are the record.)

**Preview contract.** The replace preview renders exactly the documented
contract: "Preview (replace): Valid — Would add 49 sessions and 49 ledger
entries after erasing current data", explicit destructive warnings, and loss
accounting ("49 sessions would be added, 0 skipped"). Merge/replace mode
semantics are stated on-screen before any mutation.

## AUTOMATION-LIMITED (honestly undetermined)

**The import ACTION (Replace Import / Merge Import) was never observed to
execute under automation.** The preview phase repeatedly executed correctly;
the final action button did not apply data in any automated attempt. The
harness-side causes found and fixed during investigation: aggressive swipe
flings corrupt this app's React Native accessibility bounds (captured in
logcat: `boundsInScreen: Rect(42, 63 - 252, -5792)`), which detaches taps from
controls; one garbage-bounds tap hit the system navigation bar and backgrounded
the app (which superficially looked like a crash — the crash buffer and dropbox
were EMPTY, so this is NOT reported as an application defect). Safe-tap guards
(on-screen bounds, nav-bar exclusion), gentle scrolling and search/pick
alignment were implemented; the action still did not execute under automation.

This is recorded as an AUTOMATION LIMITATION, not as an application defect and
not as a passed round-trip. The portability engine's own suites
(`apps/mobile/src/data-portability/__tests__/` — apply, replacement, checksum,
deserialize, forward-compat, large-backup) pass in CI and cover the engine
semantics. Closing this gap needs either a more reliable input channel (e.g.
accessibility action injection) or a human-confirmed single round-trip.

## NOT EXECUTED

- **Native prior-version upgrade migration.** No authentic prior APK exists in
  the repository, release history or workflow artifacts (searched); per the
  campaign rule the honest label for the source-covered migration matrix is
  `MIGRATION_FIXTURE_VERIFIED` (jest `migration-matrix`/`migration-robustness`/
  `migration-v10-hardening` suites), NOT `NATIVE_PRIOR_VERSION_UPGRADE_VERIFIED`.
  No historical artifact was fabricated.
- **Interrupted-import recovery** (process kill mid-import) was not executed;
  transactional rollback is source-covered by the engine's transaction guards
  and the wipe's verified transactional clear.
