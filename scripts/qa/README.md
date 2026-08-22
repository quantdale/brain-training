# Autobot — Autonomous On-Device QA Harness

Emulator-local, host-input-free runtime QA for the brain-training app. Drives the
app through ADB + UI hierarchy + semantic `testID`s only — no host mouse/keyboard,
no desktop focus theft (constitution §28/§29, AGENTS.md "Host-interaction
prohibition").

## Catalog derivation (never hardcoded)

The game list is derived at startup by scanning
`apps/mobile/src/games/*/game.json` (`id`, `primaryCategory`) and cross-checked
against the ids in `apps/mobile/src/registry/registry.generated.ts`. Any drift
between the two sources fails loudly (`--list-games` exits 1; `--self-test`
reports a failed assertion), so the harness scales automatically as the catalog
grows and can never silently smoke-test a stale list.

- Categories use the verbatim `primaryCategory` values, e.g.
  `Logic & Problem Solving` (quote it on the CLI).
- **Canaries**: one stable representative per category for quick runs
  (`--mode canaries`). Preferred representatives: `memory` (Memory),
  `attention-odd-one-out` (Attention), `speed-tap-rush` (Speed),
  `math-fast-math` (Math), `language-word-match` (Language),
  `logic-next-sequence` (Logic & Problem Solving),
  `flexibility-card-sort` (Flexibility), `spatial-transform-match` (Spatial).
  If a category loses its preferred representative, its alphabetically-first id
  is used instead — coverage never depends on manual upkeep.

## What it does

- Boots/provisions against one dedicated AVD (uses `QA_DEVICE`, defaults to the
  first `emulator-*` in `device` state).
- Installs/launches/resets the app (`pm clear` for a clean DB each run).
- Deep-links directly to any game via the `braintraining://game/<id>` scheme.
- Locates semantic `testID`s in the `uiautomator` hierarchy and taps by computed
  node center (emulator-local `input tap`).
- Per-game smoke chain: warm Home → deep link → tutorial bypass
  (`tutorial-skip`/`tutorial-done`/`tutorial-next`) → start → **real gameplay
  interaction** (taps one tappable in-game item: `<id>.option.N`, `<id>.tile.N`,
  `<id>.cell.X`, `<id>.choice.*`, `<id>.trigger.*`, `<id>.card-grid.card.N`;
  best-effort, recorded either way) → optional pause/resume → dev-only QA
  force-state path (`<id>.qa-toggle` → `<id>.qa-panel` → `<id>.force-win`) →
  results screen → persistence evidence (exactly one `game_sessions` row after
  a clean reset) → **BACK navigation** (app must stay foreground on a known
  surface) → **next-game navigation** (deep link to the neighboring catalog id
  must load its screen).
- Captures hierarchy dumps, logcat slices, screenshots, and the app DB
  (`run-as … cat files/SQLite/brain-training.db`).
- Inspects persistence with the host `sqlite3` (counts `game_sessions` per game;
  expects exactly one after a clean reset).
- Emits structured per-game `PASS`/`FAIL`/`NOT VALIDATED` results to
  `<run-dir>/run.json`.

## Failure artifacts

Every failing game writes a machine-readable manifest at
`<run-dir>/failures/<game-id>.json` containing the reason, step log, action
trace, device info, and paths to a fresh screenshot, hierarchy dump, bounded
logcat slice (last 800 lines), and DB snapshot captured at failure time.

## Graceful degradation (no emulator)

Before touching any device, the harness runs an adb preflight. With no device in
`device` state (or a missing/unusable `adb`), it writes a `run.json` with
`status: "BLOCKED"`, prints `[NOT VALIDATED] <target>` for every planned target,
and exits with code 2. It never fakes PASS. `--list-games` and `--self-test`
are fully offline and never spawn adb against a device.

Exit codes: `0` all requested checks PASS · `1` at least one FAIL or a
catalog/self-test assertion failed · `2` BLOCKED (no usable device).

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

# pre-build every game's lazy Metro chunk before timed runs (one-time cost)
node scripts/qa/autobot.mjs --mode warm-bundles

# print the derived catalog (offline; asserts game.json <-> registry agreement)
node scripts/qa/autobot.mjs --list-games
node scripts/qa/autobot.mjs --list-games --category "Logic & Problem Solving"

# offline logic self-test (hierarchy parsing, interaction selector, catalog checks)
node scripts/qa/autobot.mjs --self-test
```

Env overrides: `QA_DEVICE` (adb serial), `QA_PKG` (default `com.braintraining.app`),
`QA_SCHEME` (default `braintraining`), `QA_OUT` (artifact root), `QA_SQLITE`
(path to `sqlite3`). An unknown `--game`/`--category` value is rejected before
any device contact.

## Lazy-chunk budgets

Game screens are lazy-loaded, so Metro builds each game's bundle chunk on
first request. On a cold cache under heavy host load one chunk took ~246s,
which is why screen waits are env-tunable instead of fixed:
`QA_SCREEN_BUDGET_MS` (default 120000) for per-game screen/intro loads and
`QA_NEXT_BUDGET_MS` (default 60000) for next-game probes. Run
`--mode warm-bundles` once after a Metro restart to move that one-time build
cost out of timed runs (`QA_WARM_STEP_MS`, `QA_WARM_CAP_MS` tune its pacing).

## Reproducibility

All artifacts (hierarchy XML, screenshots, logcat, pulled DB, JSON report) are
written under `qa-artifacts/`. Re-running any mode creates a fresh timestamped
run directory; commit the directory (or a tagged subset) as evidence for exit
gates.

## Dev-client freshness (native dependencies)

The dev build loads JS from Metro, so source edits need no reinstall — but
NATIVE modules do. If `package.json` gains a native-backed dependency after
the installed debug APK was built, autolinking never baked it in and any
startup path requiring it crashes (`Cannot find native module '...'`).
Mitigations in place since campaign 011:

- `src/data-portability/file-transport.ts` requires its native modules LAZILY
  at first operation and throws a diagnostic error naming the rebuild remedy,
  so a stale binary degrades gracefully instead of crashing app startup.
- Operational rule: after adding ANY native dependency, rebuild + reinstall
  the dev client before device QA:
  `cd apps/mobile && npx expo run:android` (or `assembleDebug` + install).
  Check freshness when journeys fail at warm-home with module-resolution
  errors: `adb shell dumpsys package com.braintraining.app | grep lastUpdateTime`
  vs the commit date of the last `package.json` native-dep change.

## Honest-status policy

A gate is only marked `PASS` when the emulator actually reached the results
surface AND the persisted session count matched expectations AND the back/next
navigation probes kept the app alive. Anything not driven is reported
`NOT VALIDATED` — never faked green.
