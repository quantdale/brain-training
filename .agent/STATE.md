# Durable Project State

**State schema:** 1
**Last update:** 2026-08-27 (Campaign 014 ACTIVE at d645bbb: W1 depth audit;
W2 13-game mechanical deepening; W3-W6 mastery engine + Daily Spotlight +
Workout V3 signal-ranked ordering + Progress/Home/discovery surfaces; W7
word-scramble distractor integrity; W8 two-week repeated-use simulation over
real sqlite; storage-size visibility. Gates green: tsc, lint 0/0, Jest 483
suites / 5973 tests, registry/provenance/ownership/offline. Closure fixes at
366a098 + docs-final (MASTER_PLAN/PARITY) + WSL AVD/harness fixes + workout
advance precise slack (d645bbb) pushed; App CI should now be green (was red
with 2 failed suites at 4ac4d45 due to blanket 10s window, now scoped to
first leg + pre-creation guard). REMAINING: Android device journeys
(dedicated AVD braintraining-qa36 restored but segfaults shortly after boot,
37.1.x WHPX) + terminal checkpoint.)
**Canonical branch:** `main`
**Active campaign:** 014-experience-depth-replayability

## Current status

Campaign 014 — Experience Depth & Replayability is **ACTIVE** at `d645bbb`
(W1–W9 landed and pushed at f4aa44c; closure fixes 575c4f7→366a098 +
docs-final (MASTER_PLAN/PARITY) + WSL AVD/harness + workout precise slack
d645bbb pushed; docs-final now done, workout advance now precise). Campaign
013's release gate remains GREEN as the v1 baseline (42/42 certify, SHA
ba6dd84), but active work is 014.

### What landed in 014 (commits eb348dd → d645bbb, pushed)

- W1 product-depth audit: evidence-driven rubric over all 42 games + major
  shared surfaces (`.agent/CAMPAIGN014_AUDIT.md`).
- W2 13-game mechanical deepening (six parallel packets + orchestrator
  convergence, 968554a): route-path memory, Go/No-Go, proximity spread,
  uncued inference, hidden-source transform improvements, etc.; registry
  regenerated, tsc/lint/Jest 5947 PASS.
- W3–W6 shared depth systems (b36ac42): mastery ladder, Daily Spotlight,
  Workout V3 signal-ranked ordering with truthful per-game reasons
  (metadata v2), discovery shelves, Home/Progress surfaces; Jest 5972 PASS.
- W7–W9 generator integrity + repeated-use proof + storage visibility
  (f4aa44c): word-scramble distractor integrity, deterministic two-week
  repeated-use simulation over real sqlite (mastery climbing, reroll
  economics, Spotlight rollover, export/import round-trip), storageBytes
  visibility; Jest 5973 PASS, 483 suites.
- Harness & app closure fixes (575c4f7 → d645bbb): docs reconciliation
  (README V2→V3, MASTER_PLAN/PARITY through 014), harness resilience
  (RedBox/LogBox dismissal, scrolled-Home via any `home-*`, shade collapse,
  90s recovery, completion-card swipe-to-top, live-panel no-toggle guard),
  app template-instance advance race fix (initial 10s slack at d332e50, now
  precise first-leg-only slack + pre-creation guard at d645bbb, fixing 2 Jest
  suites that were red at 4ac4d45), and WSL-aware SDK/AVD fixes for
  `braintraining-qa36` (SDK path, CRLF, directory fast-path, boot skip).

### Validation snapshot at f4aa44c (pre-device-journey closure)

- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS (014's OpenSpec package is PROPOSED per 015 audit),
  offline CLEAN (919 files)
- tsc CLEAN · eslint 0/0 · doctor 21/21 (last at 013 closure; no dep changes)
- Jest: 483 suites / 5973 tests PASS
- Web export: PASS (20 static routes, last at 013 closure)
- Android: canaries **8/8 PASS** (20260826-114825-autobot-canaries, dedicated
  `braintraining-qa36` / emulator-5554, forced-win + persistence invariants
  + back/next navigation; representative of 014-changed games card-sort +
  transform-match); Workout V3 journeys **in progress after harness
  hardening** — daily warm-home blocked by notification shade (now collapsed
  on launch), focus 4/4 legs PASS then completion-card evidence probe failed
  (now retried with swipe-to-top). Perf: opt-in timing probes NOT VALIDATED
  (honest, statement-count guards green).
- npm audit: 16 build-toolchain-only (unchanged)

### Working state 2026-08-27 (pushed at d645bbb: 014 ACTIVE, docs-final DONE, AVD restored but segfaults, workout precise slack fixes 2 Jest suites)

- App fix (committed at d332e50/366a098 with blanket 10s slack, now precise at d645bbb): `advance.ts` + `db/workout.ts` first-leg-only slack (currentIndex 0 && createdAt===updatedAt ? 10s : 0) + pre-creation guard (`completedAt < createdAt => no advance`), fixing 2 Jest suites that were red at 4ac4d45 (advance.test.ts historical 500 vs 1000, workout-v2.test.ts equal-timestamp 20_000); self-test still 49/49, App CI should now be green.
- Harness fixes (committed at 575c4f7/d332e50/366a098/d645bbb + WSL patches this session): scrolled-Home via any `home-*`, RedBox/LogBox/shade handling, 90s recovery, swipe-to-top, live-panel guard, plus WSL-aware `common.sh` SDK path (`/mnt/c/...`), `avd.sh` CRLF handling (`tr -d '\r'`) + directory fast-path and `cmd_boot` skip for existing AVD. `validate-repo-state` PASS, `tsc` PASS, `avd.sh status` now fast and correct for `braintraining-qa36`.
- Docs-final reconciliation: **DONE this session** — MASTER_PLAN 013→COMPLETED + new 014 section (W1–W9 + closure fixes + validation snapshot with honest NOT VALIDATED), PARITY_MATRIX updated for Workout V3 / mastery / Daily Spotlight, README already V3; BACKLOG already V3 per 575c4f7. No remaining V2 wording.
- Android: **NOT VALIDATED this session (genuine infra blocker)** — dedicated AVD `braintraining-qa36` was **restored** (`avdmanager create avd -n braintraining-qa36 -k system-images;android-35;aosp_atd;x86_64 -d pixel_7`, now at `C:\Users\palac\.android\avd\braintraining-qa36.avd`) and **did boot** to `sys.boot_completed=1` on `emulator-5554` in ~30s (headless `-feature -Wifi`, `swiftshader_indirect`), but the emulator (37.1.11 + WHPX, qemu headless) **segfaults shortly after boot** (`adb devices` goes empty, `ps` shows qemu gone; same host saw the same after 5 prior headless attempts with cold+wipe-data). Prior green evidence remains canaries 8/8 + daily 4/4 + focus 4/4 legs (pre-fix). No foreign emulator adopted. No APK built this session (honest). Perf: opt-in probes NOT VALIDATED (statement-count guards green).

## Authoritative active change

`.agent/CURRENT_CAMPAIGN.md` (campaign 014) + `.agent/KNOWN_ISSUES.md` + `.agent/CAMPAIGN015_AUDIT.md` (015 is PROPOSED planning material).

## Important invariants

- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; ONE driver per device
  (autobot now enforces this via lockfile).
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next required action

014 remains **ACTIVE** — docs-final reconciliation is now **DONE** (MASTER_PLAN
013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight, README
already V3). The only remaining gate to COMPLETED is **dedicated-AVD device
evidence**: `braintraining-qa36` Workout V3 E2E (daily + focus) + representative
canaries PASS on the dedicated AVD, with honest perf/game-feel re-probe where
the harness can measure. The AVD was restored and boots to
`sys.boot_completed=1` but segfaults shortly after (37.1.11 + WHPX infra
blocker, also saw 5 prior headless failures). Until a stable boot + journey
run is obtained (or the host/emulator is fixed), 014 cannot be marked
COMPLETED and **015 must remain PROPOSED** per `EXECUTION.md`. Next step when
the host allows: re-run `QA_DEVICE=emulator-5554 node scripts/qa/autobot.mjs
--mode workout-focus` / `--mode workout` / `--mode canaries` (or full
`--mode certify` if risk warrants) on `braintraining-qa36` only, record
PASS/FAIL/NOT VALIDATED with artifacts, then write the terminal checkpoint
(`.agent/checkpoints/014-*.md`), mark COMPLETED, and atomically activate
015. Remaining debt: pause/resume a11y race (Medium, honest-retry), SAF sheets
(manual), iOS build (NOT VALIDATED on Windows), 16 build-toolchain-only npm
advisories (accepted), opt-in perf probes (NOT VALIDATED until re-run).
## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/CURRENT_CAMPAIGN.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
