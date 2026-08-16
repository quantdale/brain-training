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

## Emulator QA (pending — this section will be filled with the run results)

- Android debug APK build (`expo run:android`): IN PROGRESS.
- Install/launch/navigation/memory-game/pause/force-win/session-persistence
  smoke on `braintraining35`: NOT VALIDATED yet.
