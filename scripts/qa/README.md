# Autobot — Autonomous On-Device QA Harness

Emulator-local, host-input-free runtime QA for the brain-training app. Drives the
app through ADB + UI hierarchy + semantic `testID`s only — no host mouse/keyboard,
no desktop focus theft (constitution §28/§29, AGENTS.md "Host-interaction
prohibition").

## What it does

- Boots/provisions against one dedicated AVD (uses `QA_DEVICE`, defaults to the
  first `emulator-*`).
- Installs/launches/resets the app (`pm clear` for a clean DB each run).
- Deep-links directly to any game via the `braintraining://game/<id>` scheme.
- Locates semantic `testID`s in the `uiautomator` hierarchy and taps by computed
  node center (emulator-local `input tap`).
- Drives the dev-only QA force-state path: `<id>.qa-toggle` → `<id>.qa-panel` →
  `<id>.force-win`.
- Captures hierarchy dumps, logcat, screenshots, and the app DB
  (`run-as … cat databases/brain-training.db`).
- Inspects persistence with the host `sqlite3` (counts `game_sessions` per game;
  expects exactly one after a clean reset).
- Emits structured per-game `PASS`/`FAIL`/`NOT VALIDATED` results to
  `qa-artifacts/qa-report.json`.

## Prerequisites

- One AVD running and reachable via `adb` (e.g. `braintraining35`).
- Metro dev server reachable from the emulator on `127.0.0.1:8081` (the dev build
  loads JS from Metro; QA `force-win` requires `__DEV__`). Start Metro with IPv4
  binding, e.g. `NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --host
  localhost` from `apps/mobile`, then `adb reverse tcp:8081 tcp:8081`.
- A debug APK built from the current tree installed on the AVD (`npx expo
  prebuild --platform android` + `assembleDebug`, or `expo run:android`).

## Usage

```bash
# one game, full pause/force-finish/persist check (gate 12.4)
node scripts/qa/autobot.mjs --mode game --game memory --pause

# every game start/pause/force-finish/persist (gate 12.4) + one canary per category (12.9)
node scripts/qa/autobot.mjs --mode all --pause

# Word Match multi-round / multi-tier smoke (gate 3.6)
node scripts/qa/autobot.mjs --mode wordmatch

# Daily Workout 1/4 -> result -> next -> interrupt/relaunch -> resume -> 4/4 (gates 6.8, 12.7)
node scripts/qa/autobot.mjs --mode workout

# category canaries only (gate 12.9)
node scripts/qa/autobot.mjs --mode canaries
```

Env overrides: `QA_DEVICE` (adb serial), `QA_PKG` (default `com.braintraining.app`),
`QA_SCHEME` (default `braintraining`), `QA_OUT` (artifact root), `QA_SQLITE`
(path to `sqlite3`).

## Reproducibility

All artifacts (hierarchy XML, screenshots, logcat, pulled DB, JSON report) are
written under `qa-artifacts/`. Re-running any mode overwrites them; commit the
directory (or a tagged subset) as evidence for the 006R exit gate.

## Honest-status policy

A gate is only marked `PASS` when the emulator actually reached the results
surface AND the persisted session count matched expectations. Anything not
driven is reported `NOT VALIDATED` — never faked green.
