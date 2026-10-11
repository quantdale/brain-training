# Controller journey — `diagnostics-recovery`

- Controller: external ARTEMIS (D:\Tools\artemis), profile `pro`, locked app `com.braintraining.app`
- ARTEMIS session: `bb4b414d-f4f6-4600-a518-91bbb2fb3e19` (raw trace external to Git)
- Device: emulator-5554 / AVD braintraining-ui35
- APK under test: `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`
- Controller exit code: 124
- Journey log: PRESENT

# Journey Log — com.braintraining.app (backup / restore / storage / diagnostics)

## Planned steps
1. Launch com.braintraining.app, land on Home, wait for any "Loading your training data" bootstrap state to resolve.
2. Map the bottom navigation: Home, Games, Progress, Profile.
3. Open the Profile tab (Candidate #1) and enumerate every entry it exposes (settings, account, about, data, sync, overflow menu).
4. Follow each sub-entry and record any backup / restore / storage / diagnostics text verbatim.
5. Probe non-destructively for a storage-unavailable or bootstrap-recovery state (relaunch, offline/permission condition, repair/reset affordance). Never wipe app data.
6. Consolidate findings under the four required headings and state whether the journey actually executed.

## Executed steps (what you really did, in order)
1. App was already open on the Progress tab (Mastery view); observed it and the element tree.
2. Tapped the Profile tab in the bottom navigation bar (first tap was bounced for a missing in-progress ledger sub-goal; re-issued after fixing the plan).
3. Swiped up through the Profile surface ~19 times (Player card → Streak → Streak milestones → Quests → Achievements #01–#37) until the bottom of the page.
4. At the bottom of Profile found "Your data → Data Management | Backup, restore, and delete your local training data" and tapped it.
5. Waited 2500 ms for the transition; the "Data Management" screen opened.
6. Scrolled the Data Management surface top-to-bottom (swipes up) capturing verbatim: Local database / Local Data / Export Backup / Saved Backups / Import·Restore / Delete All Local Data.
7. Scrolled back up (swipes down) to re-confirm the top-of-page intro and the "Local database · Ready" status card.
8. Non-destructive relaunch probe: force-stopped and relaunched com.braintraining.app twice (no data wiped) and observed the startup result.

## Observed outcome (quote exact on-screen text)
DATA-MANAGEMENT SURFACE — Profile ▸ "Your data" ▸ "Data Management":
- Entry point (bottom of Profile tab): "Your data" → "Data Management | Backup, restore, and delete your local training data" (chevron ">"). Adjacent rows: "Rewards" → "Open Rewards | 3 ready to claim · Manage cosmetics and reward history"; "THEME" → "System ✓ Active".
- Back / title: "‹ Profile" / "Data Management".
- Intro: "Your training history lives in this app on this phone — there is no account copy. Files you export or share leave through the share sheet, and Android's own device backup may carry exported files to a new phone. Export a backup file you control, preview exactly what a restore would change, and delete local data only when you mean it. All operations validate before they write and work fully offline."
- STORAGE STATUS card: "Local database" → "Ready" → "Profile present · 1 workout instances · 3 tutorial states".
- "Local Data": 5 Sessions | 5 Ratings | 12 History | 5 Ledger | 0 Favorites | 9 Quests | 0 XP awards.
- "Export Backup": "Creates one versioned, checksummed JSON file containing your full local training history: sessions, ratings, coins, quests, achievements, streak inventory and settings. It is saved in this app's backups folder on your phone; the app itself uploads nothing. Use Share to put a copy outside the app." Field "Backup name" (placeholder "Leave blank to auto-name"); "Saved in this app's backups folder on your phone."; button "Export to JSON".
- "Saved Backups": "Plain JSON files in this app's backups folder on your phone. They survive restarts and are NOT removed by deleting your training data below. For real safety keep a copy outside the device (Share)." Body: "No saved backups yet" / "Export above to create one."
- "Import / Restore": "Paste a previously exported backup JSON (or load a saved backup or file below), then preview — previews never write data." Options: "Merge — Adds what the backup contains that your phone is missing." / "Replace — Erases your current local data first, then restores exactly what is in the backup." Field "Paste backup JSON here". Buttons "Load from file...", "Preview Merge" (disabled), "Preview Replace" (disabled), "Merge Import" (disabled), "Replace Import" (disabled). Warning: "Replace cannot be undone except by restoring another backup. Not sure which mode you need? Merge is always safe."
- "Delete All Local Data": "Permanently deletes every session, rating, coin ledger entry, quest, achievement and setting on this phone. There is no account or sync copy of your live data to fall back on. Export a backup first — you cannot undo this unless you have one." Button "Export a backup first". "Confirmation" → "Type DELETE to confirm" / "Typing DELETE enables the wipe button below." Button "Wipe Local Data" (disabled). Note: "Saved backup files are kept by the wipe — restore one from Saved Backups if you change your mind."

OTHER SURFACES (no backup/restore/storage/diagnostics entry):
- Profile tab (top→bottom): "PLAYER / Profile / Your level, streak, rewards and settings."; "Player" card "Your training record is saved on this device." + Level 1 / "56 of 100 XP" / "56 TOTAL XP" / "1 DAY STREAK" / "10 COINS"; "Streak" + "Longest streak — 1 days", "Protection items — 0", "Freeze × 0 … 100 coins", "Shield × 0 … 150 coins", "Recovery × 0 … 200 coins"; "Streak milestones" (Getting Started … Year Strong); "Quests"; "Achievements" #01–#37; "Rewards".
- Home tab: "TODAY / Today's Workout / 4 games · about 8 minutes · a balanced starting set."; "Your training is ready on this device and works offline."; "Workout complete"; "4/4 games saved. See today's progress for a summary." (local/offline wording; no cloud/backup mention). No Settings / Account / About / More / Privacy / Cloud Sync / overflow menu was found on any tab.

BOOTSTRAP / STORAGE-UNAVAILABLE PROBE (non-destructive; NO data wiped):
- A "Loading your training data" text node (bounds [38,~170]-[961,~400]) repeatedly appeared in the accessibility element tree over content that was already rendered (Progress tab / and under the Home node while Profile was shown) — a transient/non-blocking bootstrap element; it cleared and never blocked use.
- Force-stop + relaunch ×2: the app reopened directly to a fully usable Home tab with all local data intact ("4/4 games saved"). No storage-unavailable / error / bootstrap-recovery screen ever appeared; the "Local database" status stayed "Ready".
- RESULT: a storage-unavailable or bootstrap-recovery state was NOT reachable through this surface or a plain relaunch — there is no repair / reset / recovery / sign-in affordance exposed anywhere on the Data Management surface.

## Defects (or 'none observed')
- none observed (routine execution friction only: two actions were bounced by the in-progress-ledger guard and re-issued after a plan update; the session video recording was unavailable for one start-up interval, so the bootstrap probe rests on live observation).

## Journey executed?
- YES — the journey actually executed. The app's data-management surface was reached (Profile ▸ Your data ▸ Data Management) and its backup, restore and storage information was captured verbatim. A storage-unavailable / bootstrap-recovery state was probed non-destructively and was NOT reachable. This is a real executed pass, not a request-only report.
