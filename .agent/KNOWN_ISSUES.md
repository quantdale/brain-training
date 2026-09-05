# Known Issues / Blockers

## Current status — Campaign 022 ACTIVE (2026-09-05)

- **Campaign 022 (release-candidate certification) is ACTIVE** on baseline
  `76a58dc`. Predecessor Campaign 021 closed VALIDATED on final SHA
  `05c16bc`; all four workflows remain green at current head `76a58dc`
  (App CI `33944241059`, Repository Integrity `33944241055`, Android Build
  Smoke `33944241051`, iOS Build Smoke `33944241057`). SHA/run-attributed
  evidence lives in `.agent/VALIDATION.md` under "Campaign 021".
- **Closed contradiction (whole-codebase review, 2026-09-05):** the CI
  provenance/version-drift gate was structurally inert — all three
  provenance-checking workflows diffed against a base that always equals
  HEAD (shallow clone, `origin/main` == pushed commit), so
  `git diff --name-only origin/main` was empty on every run and the gate
  reported "No changed files detected" (confirmed in run `33938100850`).
  Fixed by checking out with `fetch-depth: 0` and resolving a real
  pre-change base per event (`github.event.before` →
  `pull_request.base.sha` → `HEAD^`, each validated; unresolvable base
  fails closed). Drift detection proven firing with a synthetic
  generator edit + `--base=HEAD`.
- **Closed contradiction (historical):** the 020-era terminal/VALIDATED
  declaration had contradicted current-head CI: `Android Build Smoke` failed
  deterministically on every push from `c491c2b` to `e77da39` (red at run
  `33930455910`) in the redundant `yes | sdkmanager --licenses` step —
  producer-side `EPIPE` under the runner's `bash -eo pipefail`; `sdkmanager`
  itself exited 0 and licenses were already accepted by
  `android-actions/setup-android@v3`. Campaign 021 root-caused and fixed it
  fail-closed with an installed-packages postcondition (`1a946a9`) and added
  the `scripts/validate-workflows.mjs` hygiene guard. Campaigns 017–020
  remain VALIDATED for the scope they evidenced.
- **Android device verification on dedicated AVD (2026-09-05 verified):** dedicated `braintraining-qa36` (ATD x86_64 API 35, pixel_7) was successfully booted on Windows with WHPX hardware acceleration to `sys.boot_completed=1` and connected to Metro on port 8081. End-to-end canary journeys across categories (`math-fast-math`, `memory`, `flexibility-card-sort`, `language-word-match`, `logic-next-sequence`, `spatial-transform-match`) pass on device with verified real SQLite persistence, row invariants, and back/next navigation. The historical Linux TCG (-accel off) timeout is resolved by running on the hardware-accelerated Windows host.
- **Manual platform evidence remains NOT VALIDATED / DEFERRED:** TalkBack,
  SAF/share/document-picker system sheets, physical-device behavior, and manual
  iOS runtime UX were not performed. iOS simulator compile PASS is kept
  separate from runtime UX. Signing/store, cloud/auth, telemetry, and
  monetization remain constitution-deferred.
- **Campaigns 017–020 automated evidence is closed:** repository, OpenSpec,
  ownership, registry, provenance, offline, TypeScript, lint, and QA self-test
  51/51 pass; full Node 22 Jest passed 490 suites / 6096 tests with 4 suites /
  5 tests skipped by the explicit measurement allowlist. The Campaign 020
  tracked-file secret scanner self-test and clean scan pass; no failure is
  hidden or allowlisted.
- The older Android timeout (`33239131146` on `31a6143`) is retained below as
  historical evidence only; it is not the current Android result.
- **Historical 014 device limitation (COMPLETED at 6451bfb):** 014's exit evidence is prior dedicated-AVD green at `f4aa44c` (canaries 8/8 + daily 4/4 + focus 4/4 on `braintraining-qa36` / `emulator-5554`) plus `BUILD SUCCESSFUL` 80M APK + `adb install` `Success` + `am start` success + `adb reverse` + `Metro` 8081 ready + precise workout slack at `d645bbb` (unit-test-green, fixing 2 suites red at `4ac4d45`). The re-run with the precise slack was **NOT VALIDATED on device due to genuine 37.1.x WHPX emulator segfault**; it was accepted for 014 under the documented evidence policy.
- Campaign 013 release gate (`--mode certify` 42/42, SHA ba6dd84) remains GREEN (see `VALIDATION.md`).

## Open debt (tracked, non-blocking)

- **`xp_awards` lacks a schema-level idempotency guard (Medium)**:
  `currency_ledger` has a UNIQUE partial index on `operation_id`, but
  `xp_awards` has no UNIQUE constraint on `source`. No known live
  double-award path (claims are transaction-guarded via `claimed_at`), so
  this is defense-in-depth debt; closing it needs a migration plus a
  legacy-duplicate audit, so it is deliberately not shipped mid-review.
- **Offline validator bypass heuristic gap (Low)**: `validate-offline.mjs`
  strips string literals/comments before scanning for network calls;
  runtime-reassembled URLs (`const a="ht"; b=fetch(a+"tp://…")`) slip
  through. Documented tradeoff; acceptable for the foundations phase.
- **Test-fixture seam noise in `seeding.ts` (Low)**: upsert `undefined`
  definition errors surface in unit tests whose jest DB mock partially
  implements quests/achievements; startup catch works as intended (logged,
  non-fatal) but the mock lacks the full facade.
- **`provenance-allowlist.json` dead permanent entries (Low)**: the 21
  "Initial version baseline" entries carry no expiry and are deliberately
  ignored by design (permanent exemptions cannot become a silent bypass),
  so they are misleading dead weight in a config file. Cleanup deferred;
  removing them risks nothing today but touches an identity-adjacent file.
- **`qa-artifacts/` accumulation (Low)**: 700+ transient run directories
  (screenshots/traces) are gitignored but never pruned; add a retention
  sweep before store-build automation multiplies them.

- **Campaign 014 COMPLETED at 6451bfb (docs-final DONE, prior green considered exit):** No remaining 014 product debt beyond the Medium emulator stability noted above. The 015 continuation landed the planned Rule Grid, Word Chain, Context Fit, Transform Match, runtime-evidence, and causal workout-attribution work; remaining platform/manual limitations and accepted npm audit findings are tracked below. The former full-suite timeout/resource finding was resolved by the later isolated Node 22 run and is historical.
- **SAF share-sheet/document-picker system consent sheets**: cannot be driven
  emulator-locally by autobot policy; engine round-trips are device-proven via pulled
  DB. Requires interactive/manual validation path (NOT VALIDATED, by design).
- **iOS manual/runtime UX remains NOT VALIDATED**: the macOS simulator compile smoke passes in CI, but manual TalkBack-equivalent accessibility review, iOS runtime UX, and system-sheet flows were not performed.
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
