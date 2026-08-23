# Known Issues / Blockers

## Current blockers

- **Device QA requires dev-client rebuild (closeout gate)**: the dependency
  wave lifted native module pins (expo/modules-core ~57.0.15) and the local
  gitignored `android/` tree is stale pre-011 — a fresh `expo prebuild` +
  `expo run:android` (or dev client install on AVD) is required before any
  emulator journey. W08 harness smoke confirmed emulator-5554 currently has no
  app installed.
- **Ops lesson (tooling)**: two concurrent `expo start` instances served divergent
  module graphs and produced phantom "screen did not load" QA failures; always run
  exactly one Metro, kill by PID (`netstat -ano`), and never edit src while a
  journey runs.


## Open debt (tracked, non-blocking)

- **Heavy-UI suite load sensitivity (Low, tooling)**: app-shell / progress-detail /
  results-workout-cta / celebration can time out under unbounded jest workers on
  this workstation (RNTL v14 + React 19 renderRouter settle timing). All pass in
  isolation and under `test:ci` (--maxWorkers=2); heaviest tests now carry explicit
  30s timeouts. Consider sharding if CI hosts show the same pattern.
- **Workout reasons persistence needs schema column (Medium, deferred)**: W06
  persists personalization reasons additively inside metadata_json, but schema v9
  lacks that optional column — values degrade to null on device until a parent-owned
  migration lands (engine-side graceful degradation verified).
- **word-chain expert pool small (Low)**: 9 expert chains vs 8 rounds (easy 6 vs 5);
  within-session usedChainIds prevents repeats; expansion candidate only.
- **results-workout-complete copy hardcodes "four games" (Low, cosmetic)**: label does
  not adapt to short/extended workout lengths (W08 product-request item).
- **SAF share-sheet/document-picker system consent sheets**: cannot be driven
  emulator-locally by autobot policy; engine round-trips are device-proven via pulled
  DB. Requires interactive/manual validation path.
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has no
  Xcode/macOS. Static audit refreshed in Campaign 012 W16; platform seams are
  source-level only.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); measured flat ~78ms at cap
  (W13 baselines); far above realistic foundations-phase history, documented cap.
- **NativeTabs snapshot instability (tooling)**: router-tree snapshots
  contain per-render random `screenId`s; visual baselines render bare
  routes to stay deterministic (see visual-baselines test header).
- **Provenance-allowlist / warning-class handling (Low, 006R)**:
  unchanged from 008; see `VALIDATION.md` history. The `src/games` eslint
  warnings stay warnings (0 errors enforced). Host NDK workaround codified in
  `apps/mobile/plugins/with-android-ndk-pin.js` (tested in 012).
- **versionCode strategy (release-gate decision)**: android.versionCode unset
  (defaults 1); production signing/minify intentionally deferred with other store
  decisions.

## Resolved during Campaign 011

- **Campaign 011 device journeys**: catalog 42/42 terminal PASS on Android;
  Workout V2 full journey PASS with DB evidence. See VALIDATION.md Campaign 011
  section + W16 packet final status.
- **grid-nav-class PauseOverlay reachability (Critical)**: root cause bisected on
  device — deprecated `setAccessibilityFocus(reactTag)` silently no-ops on
  Android/Fabric AND deep non-flattenable option-board nests collapse the overlay's
  a11y subtree. Fixed via renderer-routed focus events + decorative boards unmount
  while paused; Resume/Quit confirmed visible/actionable on device.
- **`/results?id=` mount crash (High)**: array styles passed to `<Slot>` children via
  asChild Links crashed every workout advance; flattened + regression-tested.
- **Native-dep stale-dev-client startup hazard**: portability native modules lazily
  required with a typed diagnostic naming the rebuild remedy; dev-client freshness
  guidance in `scripts/qa/README.md`.
- **CNG gitignored android config durability**: manifest attrs + backup/data-extraction
  rule XMLs + NDK pin codified in committed config plugins (`apps/mobile/plugins/`);
  proven by real `expo prebuild --platform android --no-install`.
- **Performance findings (009 measured → 010 implemented)**: equivalence tests +
  benchmark re-runs done — loadProgressSnapshot 102.7ms @20k through the fast path.

## Resolved during Campaign 009

- **logic-deduction-table ambiguous rounds (Critical)**: uniqueness prover
  enumerated only the first two consistent permutations; 8 counterexamples
  produced shipped-but-ambiguous puzzles. Exhaustive sound enumeration +
  regression suite pinning a counterexample.
- **db v8 migration startup brick (Critical)**: append-only trigger aborted
  the operation_id backfill transaction; duplicate legacy 'gameplay' rows
  violated the partial unique index. Collision-safe atomic backfill with
  trigger restore.
- **Invisible-profile restore (High)**: backups with foreign profile ids
  created a second, unreadable profile row on import; normalized to the
  local singleton.
- **Silent SFX failure (High, UX)**: context-fit and cue-shift correct/wrong
  sounds never played in production (names missing from `SFX_ALIASES`);
  aliases added with SDK-level invariant tests.
- **attention-target-count pause exploit (High)**: pause+resume restarted the
  full round window → unlimited think time and inflated scores; freeze-and-
  continue accumulator adopted (gameVersion 1.1.0).
- **speed-color-match timing (High)**: wall-clock reaction measurement and
  pause window accounting replaced with monotonic clock paths (1.0.1).
- **stroop defect cluster (High)**: unanswerable neutral trials,
  session-ending first timeout, dead-ended flip-cue phase, fabricated RTs,
  capped perfect-run score, inexact force-win — all fixed with regressions.
- **task-switch/rule-flip generator determinism bugs (Medium)**: constant
  fork salts made every round/block identical; round-/block-scoped salts.
- **fold-match degenerate distractors (Medium)**: keep-base contradiction.
- **Reroll on completed workouts (Medium)**: debited coins for nothing;
  refused now. `paidReroll` balance checked inside its transaction.
- **Shield unusable standalone (Medium)**: delegated to Freeze/Recovery
  predicates and consumed the wrong item; correct item now consumed.
- **equation-builder undo (Medium)**: undo of trailing operator left an
  impossible token state; re-derived from remaining tokens (1.0.1).
- **word-chain degenerate-pool crash (Low)** + content ambiguity fixes
  (context-fit non-word/ambiguous items, truncated idioms).
- **QA harness stale catalog (Medium)**: hardcoded 24-game list replaced by
  game.json derivation + registry cross-check; scales with catalog growth.

## Resolved during 008

See Git history / VALIDATION.md (Wave 02 recovery convergence; canary PASS
after Metro cache clear).

## Resolved during 006R / earlier

See Git history and prior entries in this file's archived sections in
`VALIDATION.md`.
