# Validation Evidence

Evidence policy: for every meaningful wave, append concise evidence containing
date/time, commit or working-state reference, changed subsystem, checks
actually run, PASS/FAIL/NOT VALIDATED, and important artifacts. Never convert
unavailable checks into PASS.

## Bootstrap (2026-08-16, commit `68b2f23`)

- `node scripts/validate-repo-state.mjs`: PASS.
- Application build: NOT VALIDATED — no application source yet (by design).

## Wave 0 (2026-08-16, commit `ea7488c` — scaffold, infra, ADR-0004, packets)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck (`tsc --noEmit`): PASS (after committing
  `expo-env.d.ts`; CSS-module errors resolved by the generated expo types).
- `apps/mobile` jest smoke: PASS (1 suite / 1 test) — jest-expo pipeline OK.
- `npx expo export --platform web`: PASS (4 static routes) — first export; the
  SDK 57 template lacked `expo-env.d.ts` generation on export (noted in
  ADR-0004).
- Android emulator QA: NOT VALIDATED — Campaign 001 scope.
- iOS build: NOT VALIDATED — deferred.

## Wave 1 (2026-08-16, commit `2816ea7` — shell, persistence, SDK, harness, CI)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors; includes `@types/jest` fix).
- `apps/mobile` jest: PASS — 15 suites / 104 tests (shell 9, db 20, sdk 65,
  infra 1, registry 9).
- `npx expo export --platform web`: PASS (7 static routes; `.wasm` asset ext
  fix in `metro.config.js` for expo-sqlite web).
- `scripts/android/self-test.sh` on live AVD `braintraining35`
  (aosp_atd, API 35, headless): PASS — 5 PASS / 0 FAIL / 1 SKIP (tap test
  skipped: home screen had no clickable nodes; becomes active with app
  foreground). Artifacts: `qa-artifacts/self-test-*` (screenshots, hierarchy,
  logcat). Proves hierarchy/screenshot/input/log without host input.
- `scripts/android/*.sh` `bash -n`: PASS (10 scripts).
- AVD creation + headless cold boot + snapshot: PASS (dedicated AVD
  `braintraining35`; google_apis image unstable on this host — aosp_atd used,
  documented in `docs/ANDROID_AUTOMATION.md`).
- GitHub Actions: App CI PASS (1m25s), Repository Integrity PASS (11s).
- `node scripts/validate-affected.mjs <sample paths>`: PASS (mapping + `--json`
  + `--strict`).

## Wave 2 (2026-08-16, commits `cc543fc` + `d886ce3` — memory game, registry)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors).
- `apps/mobile` jest: PASS — 22 suites / 183 tests (memory game 79 new).
- `npx expo export --platform web`: PASS (7 static routes incl. `/game/[id]`).
- Registry generator determinism: PASS (`--check` clean; bugfix verified —
  game `id` must be embedded in the generated registry).
- GitHub Actions on `d886ce3`: App CI PASS (1m40s), Repository Integrity PASS.
- Android device QA: NOT VALIDATED — in progress (APK build + emulator smoke).

## Fresh-session recovery drill (2026-08-16, commit `d886ce3`)

- Zero-context subagent ran the AGENTS.md startup protocol from committed repo
  state only: PASS — correct product/campaign/packet/app-state recovery;
  `validate-repo-state.mjs` PASS; CI verified via `gh`. Report matched code
  reality and produced an actionable drift checklist (all items since fixed).
- Evidence: `docs/RECOVERY_DRILL.md` (procedure + this drill + wave-1/2
  convergence records).

## Emulator QA (2026-08-16, commits `d886ce3` + fix `d380699`, AVD `braintraining35`)

Android debug APK (`app-debug.apk`, `expo run:android`, assembleDebug 11m02s):
**PASS**. Install/launch (with `adb reverse tcp:8081` for the Metro bundle), four-tab
shell, Games library with registered Memory game, `/game/memory` route, tutorial
auto-open + QA skip, difficulty selector, Round 1/5 reveal + input phase, pause
overlay (opaque, timers frozen — verified via persisted `pausedDurationMs`),
QA force-win → results screen (Score 750, Accuracy 100%, 5/5, forced badge).
Session persistence verified on-device: `files/SQLite/brain-training.db` pulled
via `run-as`; `user_version=1`; `game_sessions` row with full
versions/seed/difficulty/raw+normalized result/diagnostics; `profile` row
created and touched; `currency_ledger` empty (no currency in Phase 1).

Run artifacts: `qa-artifacts/20260816-memory-game-smoke/` (run.json, exit codes,
hierarchy dumps, logcat, device-db.sqlite).

**High regression found & fixed during QA**: `/game/[id]` was unreachable (tap +
deep link) because the route lived inside the NativeTabs navigator (only
declared triggers are navigable). Fixed by restructuring tab screens into the
`app/(tabs)/` group and making the root layout a Stack — commit `d380699`;
re-verified on-device after the fix. Typecheck + 183/183 tests + web export
green post-fix.

Known environment limitations (recorded, not product defects):
- `screencap`/`screenrecord` return black/empty frames for GPU-composited app
  content under `-gpu swiftshader_indirect` headless; uiautomator hierarchy
  dumps are the working visual evidence. Verify with `-gpu host` in a future
  campaign if screenshots become mandatory.
- Emulator 37.1.11 (WHPX) wedges under host memory pressure; mitigate by
  stopping gradle daemons after builds and cold-booting with `-memory 3072`.
- Expo SDK 57 template `expo-env.d.ts` is committed (ADR 0004); `expo export`
  does not regenerate it.

## Campaign 001 exit-criteria evidence (2026-08-16)

All exit criteria verified; see `.agent/CURRENT_CAMPAIGN.md` (COMPLETED) and
`.agent/checkpoints/001-autonomous-foundation-complete.md` for the full table.
CI status at completion: App CI + Repository Integrity green on `d380699`
(GitHub Actions).

## Campaign 002 — Eight Representative Games (2026-08-16, commits `d0ff355`…`0a16f68`)

### Wave 1 (games, `d0ff355`)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors).
- jest: PASS — 72 suites / 867 tests (7 new game modules, 50 new suites /
  684 tests: attention 89, speed 92, math 103, language 112, logic 95,
  flexibility 91, spatial 102).
- `npx expo export --platform web`: PASS (all 8 game routes bundle).
- Registry generator: `--check` PASS (8 games registered).
- GitHub Actions on `d0ff355`: App CI PASS, Repository Integrity PASS.

### Wave 2 (rating engine + schema v2, `0c7690d`)

- typecheck PASS; jest PASS — 76 suites / 902 tests (db v2 migration +
  rating/favorites repositories + pipeline/levels engine, 55 new tests).
- v1→v2 upgrade preserves existing rows (tested); rating_history
  append-only triggers tested; `completeSession` rollback on rating failure
  tested.
- GitHub Actions on `0c7690d`: App CI PASS, Repository Integrity PASS.

### Wave 3 (shared platform UI, `2e439c5`)

- typecheck PASS; jest PASS — 76 suites / 906 tests (results, game detail,
  library search/filter, Progress analytics; session aggregate queries).
- Web export PASS (routes `/results`, `/game-detail/[id]`).
- Note: `.expo/types/router.d.ts` (typed routes) is generated only by
  `expo start`; stale local copy removed for CI parity (see KNOWN_ISSUES).
- GitHub Actions on `2e439c5`: App CI PASS, Repository Integrity PASS.

### Wave 4 (Today's Workout, `f5d8e01`)

- typecheck PASS; jest PASS — 77 suites / 916 tests (workout determinism,
  distinctness, consecutive-day avoidance ≤ 1, reroll, leap-year edge cases).
- GitHub Actions on `f5d8e01`: App CI PASS, Repository Integrity PASS.

### Wave 5 (QA findings fix, `0a16f68`) + emulator QA (AVD `braintraining35`)

- typecheck PASS; jest PASS — 77 suites / 916 tests.
- **On-device end-to-end QA: PASS** (artifacts:
  `qa-artifacts/20260816-campaign002-smoke/` — device-db.sqlite, hierarchy
  dumps, logcat):
  - schema v2 live (`user_version=2`); Home Today's Workout renders 4
    deterministic games; Games library shows 8 cards; search + category
    chips + favorites-only filter verified (only favorited game shown).
  - game-detail: records/recent empty states, Play CTA; full play loop
    (tutorial QA-skip → Start → QA force-win → results 750 / 5/5 / 100% /
    forced badge).
  - Persistence verified in pulled db: 2× math sessions xp 50 (authoritative
    pipeline value), `domain_ratings` Math 1020 / Speed 1010 (2 sessions),
    `rating_history` 4 rows, `currency_ledger` 2× +10 gameplay, favorites
    row present, legacy memory session (xp 0, pre-pipeline) intact.
  - Progress tab: Level 2, XP 100, 3 sessions, 20 coins, 0/200 level bar,
    per-game stats (Memory 1×, Fast Math 2×), 8 domain rows.
  - Focus-refresh verified: quit back to the same detail instance shows the
    new session without remount.
- GitHub Actions on `0a16f68`: Repository Integrity PASS; App CI PASS (see
  run 31945905312).

### Campaign 002 exit-criteria evidence

All PASS — full table in
`.agent/checkpoints/002-eight-representative-games-complete.md`.

## Campaign 003 (2026-08-17, commits `c2680a2`…`4b3b4c4`)

### Wave 1 (db schema v3, `c2680a2`)

- typecheck PASS; jest PASS — 78 suites / 922 tests (43 db tests incl.
  v2→v3 migration preserving rows, xp_awards append-only triggers,
  monotonic quest progress, once-only claims/unlocks).
- GitHub Actions on `c2680a2`: App CI PASS, Repository Integrity PASS.

### Wave 2 (swarm, `d46a46d` → `8d7dbe6`)

- 6 parallel coder packets landed with disjoint write surfaces; no shared
  hotspots touched.
- typecheck PASS (whole tree); jest PASS — 90 suites / 1055 tests (quests
  30, streaks 51, content 9, offline-boundary 9, workout 41, progress-detail
  3 + all pre-existing).
- `node scripts/validate-offline.mjs`: PASS — 214 files scanned, CLEAN
  (negative-probed: URL-bearing fetch, XHR, axios, WebSocket all caught;
  comment/string-literal heuristics documented).
- `node scripts/generate-game-registry.mjs --check`: PASS (up to date).
- GitHub Actions on `8d7dbe6`: App CI PASS, Repository Integrity PASS.

### Wave 3 (convergence, `4b3b4c4`)

- typecheck PASS; jest PASS — 94 suites / 1072 tests / 4 snapshots.
- Visual baseline snapshots (Home/Games/Progress/Profile first-run states):
  PASS, stable across reruns (bare-route renders avoid NativeTabs random
  screenIds; no date strings in snapshots — verified).
- `node scripts/validate-offline.mjs`: PASS — 223 files scanned, CLEAN.
- `node scripts/validate-repo-state.mjs`: PASS.
- GitHub Actions on `4b3b4c4`: App CI PASS, Repository Integrity PASS.

### Emulator QA (AVD `braintraining35`, Metro-served JS, 2026-08-17)

- **Home**: PASS — personalized workout renders 4 games (Memory, Visual
  Search, Next in Sequence, Card Sort); live stats (Streak 1 days, XP 100,
  Level 2); reroll tap → new 4-game set + second reroll correctly blocked
  ("Need 25 coins", hint "Not enough coins for another reroll").
- **Profile**: PASS — streak card (Current 1/Longest 1/Items 0, buy pills
  100/150/200 coins); quests live (Play Three Games 3/3, Daily XP 100/100,
  Memory Week 1/10); qd3 claim tap → "3/3 · Claimed" (XP award + ledger
  verified indirectly: no re-claim possible); achievements section (First
  Steps claim button, Century Club, XP Voyager); theme: Dark tap → Dark row
  shows "Active" (live switch).
- **Progress + detail**: PASS — summary (Level 2, "20 / 200 XP to level 3",
  domains incl. Math/Speed), Full history link → `/progress-detail` with
  domain history entries ("1010 (+10)" etc.), back button.
- Artifacts: `qa-artifacts/20260817-campaign003-smoke/progress-detail.xml`.

### Performance/timing audit (2026-08-17)

- All 8 games: gameplay durations via SDK monotonic clock
  (`SessionLifecycle` with injectable `systemClock`); `Date.now()` appears
  ONLY for wall-clock stamps (`completedAtMs`, `startedAtMs`) and
  session-id nonces — no gameplay timing on wall clock. PASS (no 60/120 Hz
  fairness hazard found).

### iOS compatibility (2026-08-17)

- Static audit: PASS — `Platform.OS` used only for web branches; dependency
  set all cross-platform Expo SDK 57 modules (expo-sqlite, expo-router,
  NativeTabs, expo-glass-effect, expo-symbols are iOS-capable);
  `app.json` ios section valid (bundleIdentifier `com.braintraining.app`,
  icon `assets/expo.icon` present).
- Real iOS build (`expo run:ios`-equivalent): **NOT VALIDATED** — Windows
  host has no Xcode/macOS; recorded honestly per evidence policy. A future
  macOS host or CI runner can execute it.

## Campaign 004 (2026-08-17, commits `90a2da9`…`69fc2f5`)

### Wave 1 (4 games, `90a2da9`)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors; fixed visual-baselines arrow wrapper).
- `apps/mobile` jest: PASS — 123 suites / 1412 tests (4 new game modules,
  29 new suites / 342 tests: attention-odd-one-out 90, speed-tap-rush 88,
  memory-sequence-memory 90, math-missing-operator 72).
- Registry generator: PASS (12 games after wave 1).
- On-device smoke: NOT VALIDATED (wave 1 only).

### Wave 2 (4 games, `69fc2f5`)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors).
- `apps/mobile` jest: PASS — 149 suites / 1755 tests (4 more game modules,
  26 new suites / 341 tests: language-word-scramble 82, logic-code-cracker 91,
  flexibility-color-stroop 74, spatial-transform-match 96).
- Registry generator: PASS (16 games, categories validated).

### Emulator QA (AVD `braintraining35`, Metro-served JS, 2026-08-17)

- **Home workout**: PASS — renders 4 games from expanded 16-game catalog
  (Card Sort, Transform Match, Tap Rush, Missing Operator — all campaign-004
  games). Workout personalization correctly picks from the expanded catalog.
- **Game screen**: PASS — Tap Rush game screen loads with all expected
  testIDs (intro, difficulty selectors easy/normal/hard/expert/adaptive,
  start, help, QA panel toggle, tutorial overlay).
- Artifacts: `qa-artifacts/20260817-campaign004-smoke/` (hierarchy dumps).

### Convergence issues fixed

1. **visual-baselines tsc error** (pre-existing from campaign 003): wrapped
   `renderRouter({ index: Screen })` as `index: () => <Screen />`.
2. **speed-tap-rush Playfield width reset**: Playfield unmounts during
   roundResult and remounts with width=0; test now re-fires layout each round.
3. **speed-tap-rush score assertion**: Fixed to expect accumulated hit points
   (1350) instead of 0 after a round with wrong+hit taps.

## Campaign 005 (2026-08-17, commit `4434d33`)

### Wave 1 (4 games)

- `node scripts/validate-repo-state.mjs`: PASS.
- `apps/mobile` typecheck: PASS (0 errors).
- `apps/mobile` jest: PASS — 177 suites / 2097 tests (4 new game modules,
  28 new suites / 342 tests: memory-pattern-tap-back 87, speed-color-match 82,
  math-equation-builder 90, language-sentence-builder 83).
- Registry generator: PASS (20 games, categories validated).
- Convergence: fixed missing `index.ts` barrel export for speed-color-match.

### Emulator QA (AVD `braintraining35`, Metro-served JS, 2026-08-17)

- **Home workout**: PASS — renders 4 games from 20-game catalog.
- Artifacts: `qa-artifacts/20260817-campaign005-smoke/` (hierarchy dumps).
