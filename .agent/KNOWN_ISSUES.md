# Known Issues / Blockers

## Current blockers

- **Campaign 014 device-journey closure still blocked by host emulator (2026-08-27 update, genuine infra blocker, not product):** dedicated AVD `braintraining-qa36` was **restored** this session (`avdmanager create avd -n braintraining-qa36 -k system-images;android-35;aosp_atd;x86_64 -d pixel_7`, now at `C:\Users\palac\.android\avd\braintraining-qa36.avd`) and **did boot** to `sys.boot_completed=1` on `emulator-5554` in ~30s (headless `-feature -Wifi`, `swiftshader_indirect`), but the emulator (37.1.11 + WHPX, `qemu-system-x86_64-headless.exe`) **segfaults shortly after boot** (`adb devices` goes empty, `ps` shows qemu gone; `netsimd` WiFi channel `CANCELLED` → segfault). Same host previously saw 5 headless attempts fail with "did not register with adb within 60s". Prior dedicated-AVD green remains canaries 8/8 + daily-workout 4/4 + focus 4/4 legs (pre-template-fix). The template-advance fix (10s slack) and harness WSL fixes (SDK path, CRLF, directory fast-path) are committed at 366a098 + this session, but **Workout V3 E2E re-run + representative canaries remain NOT VALIDATED**. Honest perf: opt-in probes NOT VALIDATED (statement-count guards green). Docs-final reconciliation is now **DONE** (MASTER_PLAN/PARITY/STATE/VALIDATION synced), so the only remaining gate to 014 COMPLETED is a stable device journey. Blocks 015 activation; leave 015 PROPOSED per `EXECUTION.md`.
- Campaign 013 release gate (`--mode certify` 42/42, SHA ba6dd84) remains GREEN (see `VALIDATION.md`).

## Open debt (tracked, non-blocking)

- **Campaign 014 remaining (ACTIVE, docs-final now DONE):** Android Workout V3 E2E (daily + focus) + representative canaries on dedicated `braintraining-qa36` remain **NOT VALIDATED** due to genuine 37.1.x WHPX emulator segfault shortly after boot (AVD was restored this session and boots to `sys.boot_completed=1` in ~30s, then qemu dies). Docs-final reconciliation is **DONE** (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight, README already V3). The template-advance fix (10s slack) is committed but not device-proven. Until a stable journey run is obtained, 014 cannot be marked COMPLETED and 015 stays PROPOSED.
- **Campaign 015 planned depth gaps (PROPOSED, not 014 blockers):** language Word Chain ≥90 chains (currently 30, 6/tier) and Context Fit ≥60/tier (currently 60 total) remain content-starved; Logic Rule Grid is still one-cell Latin-square lookup (needs solver-proven chained deduction); Spatial Transform Match has invariant-risk fallbacks and hidden-source ambiguity (needs final-boundary validation, exact option count, semantic unambiguity). See `.agent/CAMPAIGN015_AUDIT.md` P1.4–P1.7 and `openspec/changes/015-*/specs/game-depth-convergence/spec.md`. Opt-in perf timing probes not re-run (statement-count guards green throughout) — 015 will rerun targeted probes after its changes.
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
