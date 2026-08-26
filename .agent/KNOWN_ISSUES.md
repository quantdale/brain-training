# Known Issues / Blockers

## Current blockers

- **None blocking.** The Campaign 013 release gate (`--mode certify` 42/42
  single-driver Android run) is executed on the dedicated isolated AVD; see
  `.agent/VALIDATION.md` for the authoritative evidence.

## Open debt (tracked, non-blocking)

- **Campaign 014 remaining items (ACTIVE campaign)**: Android Workout V3 /
  canary journeys NOT VALIDATED this session (dedicated AVD `braintraining-
  qa36` went offline mid-run; foreign `Nitro_API_36` must not be adopted);
  language content-pool growth (word-chain ≥90 chains, context-fit ≥60/tier)
  and the logic-rule-grid chained-deduction redesign remain the top audited
  depth gaps (see `.agent/CAMPAIGN014_AUDIT.md` P2/P3); transform-match
  hidden-source mode can make multi-transform distractor rounds ambiguous
  when ≥2 options are exact transforms of the source (packet-flagged; needs a
  distractor-preference generator tweak, generatorVersion bump). Opt-in perf
  timing probes not re-run (statement-count guards green throughout).
- **SAF share-sheet/document-picker system consent sheets**: cannot be driven
  emulator-locally by autobot policy; engine round-trips are device-proven via pulled
  DB. Requires interactive/manual validation path (NOT VALIDATED, by design).
- **iOS build unverifiable on this host (NOT VALIDATED)**: Windows host has no
  Xcode/macOS. Static audit refreshed in Campaign 012 W16; platform seams are
  source-level only.
- **Achievements sync scope (Low)**: quest/achievement evaluation scans up
  to 5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`); measured flat ~78ms at cap
  (W13 baselines); far above realistic foundations-phase history, documented cap.
- **versionCode strategy**: deterministic semver-derived encoding shipped
  (with-deterministic-version plugin, 0.1.0 → versionCode 1000). Production
  signing/minify remain deferred store decisions.
- **npm audit advisories (accepted, build/dev-toolchain only)**: 16 findings —
  image-size (via Metro) and uuid (via Expo config toolchain). No production/runtime-
  reachable findings; no fixed upstream release exists for image-size; remediation of
  the uuid chain arrives with the next planned Expo SDK upgrade. See
  `.agent/DEPENDENCY_AUDIT.md`.

## Ops lessons (environment)

- **Cross-project emulator contamination (device-verified 2026-08-24)**: a concurrent
  session from another project on this shared host drove the same emulator instance
  (its UI held the foreground while stale brain-training accessibility trees were
  dumped), producing phantom product failures — 4 canaries "failed" with
  unreachable QA controls and a tutorial-skip button that ignored taps. A screenshot
  exposed the foreign app mid-typing. Resolution: certification runs use a dedicated,
  distinctly-named AVD (`braintraining-qa36`), and the certify preflight now refuses
  to start unless OUR package is foreground on the selected device. Lesson: never
  adopt a foreign emulator instance; verify foreground ownership before trusting any
  on-device evidence.
- **Two concurrent `expo start` instances served divergent
  module graphs and produced phantom "screen did not load" QA failures; always run
  exactly one Metro, kill by PID (`netstat -ano`), never edit src while a
  journey runs — and exactly ONE autobot driver per device
  (enforced by `scripts/qa/.autobot.lock`, fail-closed on ambiguous PID liveness).

## Resolved during Campaign 013

- **Lint warning inventory (~430–474)**: ELIMINATED — repo now lints at
  **0 errors / 0 warnings** (autofix of mechanical classes + per-surface dead-code
  removal; no blanket suppressions; remaining inline disables are per-site with
  written invariant rationale).
- **NativeTabs snapshot instability**: RESOLVED — deterministic router-tree
  normalizer (test-only seam) maps volatile route keys to positional placeholders;
  an integrated navigation snapshot now proves the real NativeTabs tree (four tab
  triggers, selection wiring, screen content) deterministically.
- **Fractional `duration_ms` persisted as REAL (High, found by the certification
  row-invariant validators)**: the SDK monotonic clock is fractional-ms; SQLite
  stored lossless-inconvertible floats in INTEGER-declared columns (4/4 first
  certification games violated the contract). Fixed at the persistence boundary
  (`completeSession` coerces all INTEGER-declared columns); regression test pins
  `typeof(duration_ms)=='integer'`.
- **Autobot lock liveness fail-open (Medium)**: `EPERM` from `process.kill(pid,0)`
  was treated as "stale", letting a second driver steal an exclusive-device lock.
  Now fails closed: only `ESRCH` proves death.
- **Schema v10 idempotency + adversarial coverage**: v10 column guard made
  mutation-proven; malformed `metadata_json` cells, legacy envelopes, failure-injected
  atomicity, and rollback/retry all covered (+18 tests).
- **Gameplay defect cluster (found by game-family audits, each with regression
  tests)**: memory-prospective-cue stale-closure scoring (max speed bonus paid
  regardless of reaction) + pause/tutorial restart granting a fresh full response
  window; attention-odd-one-out post-deadline tap grace; speed-color-match
  negative-RT corruption guard.
- **`m[1])` repository debris (Low)**: zero-byte shell-redirection artifact from an
  unfinished commit; traced through history and removed.

## Resolved during Campaign 011

- **Campaign 011 device journeys**: catalog 42/42 terminal PASS on Android;
- **grid-nav-class PauseOverlay reachability (Critical)**: renderer-routed focus
  events + decorative boards unmount while paused.
- **`/results?id=` mount crash (High)**: array styles passed to `<Slot>` flattened.
- **Native-dep stale-dev-client startup hazard**: lazily required with typed
  diagnostic; dev-client freshness guidance in `scripts/qa/README.md`.
- **CNG gitignored android config durability**: manifest attrs + backup rules +
  NDK pin codified in committed config plugins; proven by real prebuild.
- **Performance findings (009 measured → 010 implemented)**: loadProgressSnapshot
  102.7ms @20k through the fast path.

## Resolved during Campaign 009

- **logic-deduction-table ambiguous rounds (Critical)**: exhaustive sound
  enumeration + regression suite.
- **db v8 migration startup brick (Critical)**: collision-safe atomic backfill.
- **Invisible-profile restore (High)**; **silent SFX failure (High)**;
  **attention-target-count pause exploit (High)**; **speed-color-match wall-clock
  timing (High)**; **stroop defect cluster (High)**; plus Medium/Low items — see
  git history and VALIDATION.md archives.

## Resolved during 008 / 006R / earlier

See Git history and prior entries in `VALIDATION.md` archived sections.
