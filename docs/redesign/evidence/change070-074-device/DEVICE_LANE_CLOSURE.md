# Changes 070/072/073/074 — Device-lane closure

**Date:** 2026-10-04 · **Tree:** `a295476` (clean, `main`; the only code-bearing
delta vs the Change 068 device session's `096aefc` build is documentation —
`git diff --name-status 096aefc..a295476` lists `.agent/` + evidence paths only)
**Scope closed:** the four OpenSpec device-lane debts recorded as
"NOT VALIDATED — device lane not available": `070-backup-transport-atomicity`
§7.4, `072-navigation-and-error-surfaces` §7.3–§7.5,
`073-workout-lifecycle-durability` §6.3–§6.5, `074-sdk-module-contract` §7.4.

## Verdict

**PASS for all scoped device-lane tasks**, with two explicitly bounded
classifications at the end (072 §7.3 Profile half; ARTEMIS lane). Every measured
claim below comes from the dedicated AVD (`braintraining-ui35`, Android 15 /
API 35, `emulator-5554`) against the debug APK built from `096aefc`
(`171ba82d45d2d39dd4f5d1775ea129de44bc5d30e248e54c83ff3754f8bcdccd`), installed
via `adb install -r` over the existing Change 068 install. JS delivery was the
Metro dev lane (`expo start` + `adb reverse tcp:8081`); all input was
emulator-local (`adb shell input` + uiautomator hierarchy); no host mouse,
keyboard, or focus was touched. Raw artifacts: `qa-artifacts/change070-074-device/`.

## Baseline (pre-journey)

Pulled `db+wal` audited with better-sqlite3 (host-side, copies only):
integrity `ok`, 0 FK violations, schema v13; 2 sessions; workout rows
2026-09-21 (idx 0), 2026-10-03 (idx 1, reroll 1), 2026-10-04 (idx 0, fresh:
card-sort → grid-nav → running-order → task-switch); ledger 3 rows; xp 1 row.

## 073 §6.5 — standalone sessions never claim a workout leg; exactly-once advance

A standalone Color Stroop session was driven from Games → Game Detail → Play
through the real tutorial-eligible intro, live trials, and the game-local result
surface (`drive-standalone-stroop.log`).

- New session `flexibility-color-stroop-muta8jbi-1-d7ub9e` persisted
  (2026-10-04 03:51:04 device time) with versioned metadata and normalized
  result; ledger gained exactly one gameplay entry keyed by the idempotent
  operation id.
- **All three workout rows were unchanged by the standalone session** —
  2026-10-04 `current_index` stayed 0 (no leg claimed), 2026-10-03 stayed 1.
- **Exactly-once under repeated relaunch:** two full launch → force-stop cycles
  later, the pulled db is position-identical (still 3 sessions, indices 0/1/0),
  no duplicate ids, integrity `ok`, 0 FK violations. No phantom advance.

## 072 §7.4 — push→replace navigation on device

Three full Home → game-detail → Home cycles (Games tab → `games-suggested-open`
pushing `/game-detail/[id]` → `game-detail-back` → Home tab), each verified by
hierarchy (game-detail markers present on the detail screen; `home-workout-cta`
present after each Home return) (`det1..3.xml`, `home1..3.xml`).

- **System back from Home after the cycles left Home** — focus moved to
  `NexusLauncherActivity` (app backgrounded), NOT back into the detail screen
  (`after-back.xml`: 0 game-detail markers).
- Refocus (`am start`) landed on Home, not detail (`refocused.xml`:
  `home-workout-cta` present, 0 game-detail markers). History does not
  re-enter the abandoned flow.

## 072 §7.5 — results mutation reflected on Progress without waiting

Immediately after the standalone session's result surface persisted, navigating
to the Progress tab rendered the new data on first focus: "3 sessions across 3
active days in the last 30d" (pre-journey: 2) and "3 trained · 5 untrained ·
0 stale" (`progress-after.png.xml`, `progress-recent.xml`). The input-aware
focus gate (newest-session fingerprint) refreshed on focus instead of serving
the stale window.

## 073 §6.4 — complete → skip → finish; the skipped leg awards nothing

Today's workout was played leg-by-leg on device:

1. **Leg 1 (Card Sort)** — started from Home's workout CTA; the real first-play
   tutorial rendered (demo board + `tutorial-skip` QA control) and was skipped;
   the session completed via the dev-only QA force-win hook (`qa-toggle` →
   `force-win`; debug build only) and the game-local result showed
   "Outstanding". Home: 1/4, Card Sort "Done".
2. **Leg 2 (Grid Navigator) SKIPPED via the real UI** — `home-workout-skip`
   ("Skip this game (free)") on Home; status flipped to **"Skipped"**, Running
   Order became "up now", and the allowance hint went **"3 skips left" →
   "2 skips left in this plan — the last game must be played"**
   (`home-opts.xml`, `home-after-skip.xml`).
3. **Leg 3 (Running Order)** — the GameHost intro read the STORED position:
   "Today's workout, **game 3**" (honest launch after 1 played + 1 skipped,
   §4); completed via QA force-win.
4. **Leg 4 (Task Switch, final leg)** — intro "game 4"; the result surface
   showed `workout-complete`: "**4/4 games complete** / Workout complete —
   This workout is saved." Home after relaunch: `home-workout-complete-panel`
   "4/4 games saved."

Durable verification (`after-workout/`):

- `workout_instances[2026-10-04]`: **status `completed`, `current_index` 4,
  `skipped_indices_json` `[1]`** — the summary matches the stored state.
- **The skipped leg awarded nothing:** no `game_sessions` row for
  `spatial-grid-nav`, no `currency_ledger` entry, no xp — only the three PLAYED
  legs produced exactly-once gameplay credits (10 each, keyed by operation id).
- integrity `ok`, 0 FK violations, schema v13.

## 073 §6.3 — mid-window force-stop: boot reconciliation (crafted state)

The window between session commit and leg advance is milliseconds wide and
cannot be hit externally; per the Campaign 065 crafted-recovery precedent the
durable state was crafted to the exact post-commit/pre-advance shape while the
app was stopped, using the device `sqlite3` binary under `run-as`:

- Craft: `workout_instances[2026-10-03].current_index` 1 → **0**, while leg 0's
  real session (`flexibility-color-stroop-mus9p047-1-mf1awp`) proves the leg
  settled (`reconcile/before-rewind.db`).
- **One relaunch reconciled the position forward to 1**
  (`reconcile/after-relaunch1.db`) — the boot reconciliation
  (`reconcileWorkoutPositions`) walked over the leg the session proves settled.
- **The leg was not replayed:** still exactly one 2026-10-03 stroop session; no
  new session row.
- **Reward-free:** the ledger is byte-identical to pre-craft (same 7 rows, same
  operation ids).
- **Idempotent under a repeated relaunch:** after a second launch → force-stop
  cycle, `current_index` AND `updated_at` are identical
  (`after-relaunch2.db`: `updated_at` 1791088202867 both) — the second boot
  wrote nothing. integrity `ok`, 0 FK violations throughout.

This also completes 073 §6.5's "exactly-once advance still holds under a
repeated relaunch" for the reconciliation path.

## 070 §7.4 — backup transport atomicity on device

Driven on the real Data Management screen against the real `files/backups`
directory.

**Part 1 — same-name replacement (the rotation sequence).** A backup was
exported under the fixed name `journey-g-backup`, then exported AGAIN under the
same name (the write-temp → rotate `.prev` → rename → verify read-back →
delete `.prev` path):

- Both envelopes are complete valid backup JSON (checksum/manifest present);
  the two copies differ only by their `createdAt` stamp, as expected.
- After the replacement completed, `ls -a files/backups` shows **no temp file
  and no `.prev`** — the rotation cleaned up; the listing shows the single
  name with Load/Share/Delete controls.

**Part 2 — interrupted replacement (the orphan `.prev` promotion).** With the
app stopped, the durable state was crafted to the exact kill-between-rotate-
and-rename shape: the live name was removed and its content left ONLY as
`files/backups/.journey-g-backup.prev` (sha256
`35894eca48ff571571eacd5534739345af37e17c4dbdade9c7059d84c3491a5a`).

- On the next Data Management read, the listing sweep **promoted the orphan
  back to `journey-g-backup`** — the backup APPEARS in the user's inventory.
- The recovered file is **sha256-identical** to the pre-craft content (complete
  previous content, not a tail) and parses as a valid envelope.
- No `.prev` or temp remains after the sweep.

## 072 §7.3 — failed read renders failure + retry (Data Management, device)

Two real faults were exercised against the live screen:

1. **POSIX access denial (the task's example):** `chmod 000 files/backups`
   while stopped. Measured result: the platform library
   (`expo-file-system` `Directory.list()` → `File.listFiles()`-backed
   `listAsRecords()`) returns an empty listing for an unreadable directory
   instead of throwing, so the section rendered its (truthful-as-known) empty
   state and NO error reached the seam. Recorded as the device behavior of the
   deny-access example on this stack; it is a platform-library swallowing
   property, not a 072 regression.
2. **A read that genuinely throws:** the backups directory was replaced by a
   regular FILE of the same name (a real "unreadable backups surface"). The
   screen then rendered exactly the 072 contract
   (`dm-fault2.xml`):
   - `data-saved-backups-error` — "**Could not read your saved backups.**"
     with a `data-saved-backups-retry` control;
   - the stranded-artifacts section reported its own failure
     ("Could not check for hidden backup files.") with its own retry;
   - **the empty state did NOT appear for the failure** — the user is never
     told "no saved backups" while the read is failing;
   - the counts/storage sections kept their own loaded state (per-section
     isolation).
   After restoring the directory, tapping **Retry** recovered the listing live
   (no screen reload): the real 2026-09-21 backup reappeared with its
   Load/Share/Delete controls, and the stranded section's retry also cleared.
   (`dm-recovered.xml`, `dm-stranded-ok.xml`.)

**Profile half — boundary (honest classification).** Profile's `loadProfile`
chain (`ledger.getBalance`, `profile.get`, `achievements.listUnlocks`,
`quests.listProgressForPeriod`, sessions/xp aggregates, tolerant inventory
read) shares the database with the FOUNDATIONAL bootstrap stages (the
progression stage syncs quest progress at boot), so no device fault exists
that fails Profile's read while leaving boot on the normal shell — any db
fault lands on the bootstrap recovery path (certified separately, Campaign
053), not on the Profile failure state. The four-state behavior is pinned by
the change's unit/screen tests; on device this campaign additionally observed
the loaded/empty boundary and the failure+retry mechanism end-to-end on the
same `useDbData` seam (Data Management). Profile's failure-state rendering
itself remains unit-pinned, NOT separately device-observed — recorded as
`PARTIAL (device)` for §7.3's Profile half rather than claimed.

## 074 §7.4 — background/restore, no duplicate session, no residue

- A standalone Color Stroop session was started (live board, Trial 1/15), the
  app was **backgrounded with HOME** (launcher focus confirmed), then restored:
  the session resumed **auto-paused** behind `pause-overlay` with the trial,
  score and rule intact (constitution §11 backgrounding behavior), and the
  session then completed normally to the result surface (`h5-restored.xml`,
  `drive-h-complete.log`).
- **No duplicate session:** the final audit shows exactly one NEW session for
  the background/restore run (`flexibility-color-stroop-mutckrz9-1-c3s9j3`),
  7 sessions total with all-distinct ids, and an exactly-once ledger keyed by
  the operation id.
- **Tutorials and full-game persistence:** three genuine first-play tutorials
  rendered on device during this campaign (Card Sort, Running Order, Task
  Switch) with working QA skip; five real game completions persisted across
  the campaign (1 standalone + 3 workout legs + 1 post-background/restore).
- **No residue:** the whole-campaign logcat (18,442 lines) contains **0**
  `FATAL EXCEPTION`, **0** `SQLiteReentrantTransactionError`, **0** SQLite
  error/lock/corrupt lines, **0** ANR lines, **0** RedBox/LogBox entries; the
  only "duplicate" mentions are system-server accessibility magnification
  noise (pid 594, not the app).

## Final durable audit (post-campaign)

`final/` pull: integrity `ok`, 0 FK violations, `user_version` 13;
`game_sessions` 7 (all-distinct ids); `workout_instances` exactly three rows in
their designed terminal/active states (09-21 active idx 0; 10-03 active idx 1
[reconciled]; 10-04 **completed** idx 4, skipped `[1]`); `currency_ledger` 8
rows with unique operation ids; `xp_awards` unchanged; workout summary and Home
completion card match the stored state.

## Classifications

| Task | Classification |
| --- | --- |
| 070 §7.4 replacement atomicity + orphan `.prev` recovery | **PASS** (device, this document) |
| 072 §7.3 failure state + retry (Data Management) | **PASS** (device, genuinely-throwing fault; POSIX-denial behavior recorded) |
| 072 §7.3 Profile half | **PARTIAL (device)** — failure rendering unit-pinned; a Profile-only read fault is not producible on device without landing on the foundational bootstrap recovery path (reason above) |
| 072 §7.4 push→replace back-from-Home | **PASS** (device) |
| 072 §7.5 immediate Progress reflection | **PASS** (device) |
| 073 §6.3 crafted mid-window reconciliation | **PASS** (device, reward-free, not replayed, idempotent) |
| 073 §6.4 complete/skip/finish + skipped-awards-nothing | **PASS** (device) |
| 073 §6.5 standalone-no-claim + exactly-once relaunch | **PASS** (device) |
| 074 §7.4 background/restore, no duplicate, tutorials, persistence, no residue | **PASS** (device) |
| ARTEMIS natural-language lane | **BLOCKED (external)** — not exercised; the journeys ran on the direct emulator-local ADB lane per the Campaign 030B/031/068 precedent |
| Human/manual platform lanes | out of scope, unchanged |

## Raw artifacts (outside Git, per `docs/QA_ARTIFACTS.md`)

`qa-artifacts/change070-074-device/`: `pre-journey/`, `after-standalone/`,
`after-relaunch/`, `after-workout/`, `reconcile/` (before-rewind /
after-relaunch1 / after-relaunch2), `final/` (db+wal), `logcat-full.log`,
hierarchy captures (`det*.xml`, `home*.xml`, `after-back.xml`, `refocused.xml`,
`progress-*.xml`, `results-standalone.xml`, `home-opts.xml`,
`home-after-skip.xml`, `home-completed.xml`, `jb*.xml`, `leg1-result.xml`,
`dm0.xml`, `dm-failed-read.xml`, `dm-fault*.xml`, `dm-recovered.xml`,
`dm-stranded-ok.xml`, `g-*.xml`, `h*.xml`, `leg4-result.xml`, `h6-result.xml`),
drivers (`drive-force-win.py`) + logs (`drive-standalone-stroop.log`,
`drive-leg1-cardsort.log`, `drive-leg3-running-order.log`,
`drive-leg4-task-switch.log`, `drive-h-complete.log`), backup copies
(`g-copy1.json`, `g-copy2.json`, `g-before-craft.json`,
`g-after-recovery.json`), audit tooling (`audit-db.js`, `workout-audit.js`,
`parse-hier.py`), `emulator-070-074-boot.log`, and the Metro log
(`../../metro-070-074.log`).
