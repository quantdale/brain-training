# Known Issues / Blockers

## Current blockers

- **expo-doctor patch drift (Low, consciously pinned)**: expo/expo-linking/
  expo-router stay on 57.0.14-era pins via `expo.install.exclude` so doctor reads
  21/21; bump them together at the next dependency-audit campaign.
- **Ops lesson (tooling)**: two concurrent `expo start` instances served divergent
  module graphs and produced phantom "screen did not load" QA failures; always run
  exactly one Metro, kill by PID (`netstat -ano`), and never edit src while a
  journey runs.


## Open debt (tracked, non-blocking)

- **equation-builder dead easy-level templates (Low, 010 finding)**: eight
  pre-existing 3-number templates requiring × are unreachable because easy's +/−
  operator mix always fails their solvability filter ([10,3,4]→26, [8,7,3]→53,
  [6,5,4]→54, [9,4,2]→38, [7,6,3]→45, [10,5,2]→52, [8,6,4]→44, [13,2,5]→31).
  Prune or re-tier in a content campaign.
- **GameHost migration remainder (Medium)**: 24 of 42 games still pre-GameHost
  (mechanics work fine; boilerplate remains). Campaign 011 deliberately did not
  mass-migrate (validation campaign); schedule batches in Campaign 012 with screen
  suites as guardrails.
- **Short-template workout traversal (Low)**: default daily V2 journey fully PASS on
  device incl. relaunch persistence; template-length selection UI traversal needs a
  new harness flow (template row → start). Deferred to Campaign 012.
- **SAF share-sheet/document-picker system consent sheets**: cannot be driven
  emulator-locally by autobot policy; engine round-trips are device-proven via pulled
  DB. Requires interactive/manual validation path.
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has no
  Xcode/macOS. Static audit refreshed in 009; platform seams are source-level only.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); far above realistic
  foundations-phase history, but a documented cap.
- **NativeTabs snapshot instability (tooling)**: router-tree snapshots
  contain per-render random `screenId`s; visual baselines render bare
  routes to stay deterministic (see visual-baselines test header).
- **Provenance-allowlist / warning-class handling (Low, 006R)**:
  unchanged from 008; see `VALIDATION.md` history. The `src/games` eslint
  warnings stay warnings (0 errors enforced). Host NDK workaround codified in
  `apps/mobile/plugins/with-android-ndk-pin.js` (011).

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
