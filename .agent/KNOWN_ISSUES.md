# Known Issues / Blockers

## Current status — Campaign 029 active (last completed: Campaign 028 VALIDATED)

Campaign 028 (`028-production-readiness`, activated 2026-09-13 under the
owner's successor campaign directive) closed **VALIDATED** and terminal; it
closed the residual release-confidence gaps recorded below (silent user-action
failures, portability robustness, harness navigation reliability and artifact
retention, validator/CI gate integrity, docs truth, cleanup). Predecessors 027
(deep hardening, `212469d`) and 026 (visual identity rebuild) remain VALIDATED.
Campaign 029 (`029-artemis-runtime-qa-migration`) is active under the owner-
supplied 2026-09-16 migration directive. Repository-owned migration work is
in progress; one external provider blocker is open for live ARTEMIS tasks.

The application is **not yet fully store/public-release cleared** because
several evidence classes are deliberately external/manual:

- production/Play store signing credentials and store-signing reproducibility;
- manual TalkBack accessibility review;
- Android SAF/share/document-picker system-sheet flows;
- physical-device behavior;
- manual iOS runtime UX on a suitable macOS/iOS environment.

These remain **NOT VALIDATED / DEFERRED / EXTERNALLY BLOCKED** as applicable.
They are not failures of the repository-owned automated matrix, and they must
not be reported as PASS until actually performed.

## Campaign 029 — ARTEMIS migration status (2026-09-16)

- **External ARTEMIS setup:** the official checkout is at
  `D:\Tools\artemis`, revision `371aa6d`, with its synced Python environment.
  ARTEMIS doctor reached `ready` after the single AVD
  `braintraining-ui35` registered as `emulator-5554`; the bundled
  accessibility helper is installed, enabled, and answering. No ARTEMIS
  source, trace, or provider credential is stored in this repository.
- **System Flash smoke:** **BLOCKED / NOT VALIDATED**. ARTEMIS launched
  Android Settings and began the task, but the upstream/default model returned
  repeated 503 availability responses. A compatibility attempt with a
  currently available model reached the device but then encountered 503/429
  free-tier quota responses; an auxiliary model used by the tool returned a
  404 retired-model response. The task was stopped without leaving a
  controller running. Safe external trace IDs are
  `5d722b11-47a3-4b8b-b005-7217d9b52bc9`,
  `1d2eccb4-f0d6-45e7-907d-0ee641d96d85`, and
  `4ecca04c-ec32-467b-b05f-15eaf0049669`.
- **Brain Training Flash/Pro:** **NOT VALIDATED**. The current debug APK
  build/install/start diagnostics are complete, but no task was started after
  the provider condition became deterministic enough to identify the blocker.
  A fresh provider-backed ARTEMIS task is still required.
- **Android setup self-test:** **NOT VALIDATED** at the final checkpoint. The
  exact `braintraining-ui35` AVD was offline when
  `scripts/android/self-test.sh --no-boot` ran. This is an infrastructure
  evidence gap, not a product failure; no emulator data wipe was used.
- **Repository migration:** `scripts/qa/autobot.mjs` and its lock integration
  are removed. ARTEMIS is now the documented runtime; `scripts/android/` is
  setup/evidence-only, and the offline boundary contract replaces the old
  repository gameplay self-test.

The single live blocker is external Gemini model availability/quota. Do not
blindly retry or record another provider-consuming task until availability or
quota changes; continue with non-secret repository validation and app build
work.

## Campaign 026/027 findings (added 2026-09-13)

All are environment/operational or explicitly deferred; none is a Critical or
High product defect.

- **Historical — Autobot cold-start navigation race (QA tooling, Low, Campaign 027) —
  RESOLVED in Campaign 028 W3:** the harness now verifies every deep link
  against route classification, retries verified attempts (cold-start
  escalation when launch was delivered but ignored, `QA_DEEPLINK_RETRIES`),
  verifies pause-overlay dismissal on the resume branch, and pre-warms game
  routes before canaries/certify/all (`QA_PREWARM=0` opts out). Failure
  evidence now names the observed route instead of a generic "screen did not
  load".

- **Emulator app-surface wedge (environment):** after hours of repeated app
  force-stop/relaunch cycles under Jest/Metro load, the GPU-translated app
  surface stopped presenting frames (black screencaps, empty view tree) while
  the stock launcher still rendered; `dumpsys gfxinfo` showed almost no app
  frames. A cold restart of the dedicated headless AVD
  (`braintraining-ui35`, `-port 5560 -no-window -no-snapshot`) restored
  rendering immediately. The capture harness now detects this state as a blank
  or unwarmed batch instead of filing black frames as evidence.
- **Viewport-clipped a11y measurements (tooling, understood):** uiautomator
  reports visible bounds, so rows scrolled under the bottom tab bar measure
  short. The audit classifies them as `clipped` (reported with their visible
  size, excluded from the violation count); verify a clipped control's real
  size by scrolling it fully into view. Applies to the audit tooling, not to
  any shipped control.
- **Six baseline frames regenerated (evidence, understood):** the original
  Campaign 026 baseline capture contained black frames for home/games/
  game-detail/game-intro in both themes (same emulator-surface condition).
  They were regenerated from the baseline code `6f420cc` into
  `qa-artifacts/campaign026/before-recovery/**` and merged into the baseline
  manifest with `regeneratedFrom` notes.

## Open non-blocking maintenance

- **`xp_awards` schema-level idempotency idea — RESOLVED AS DESIGNED
  (Campaign 022 audit):** Campaign 022 proved every production award writer
  commits inside one serialized transaction behind a CAS claim gate, with
  currency ledger operations additionally guarded by operation-id uniqueness.
  A blanket `UNIQUE(source)` must **not** be added because legitimate
  legacy/generic sources such as `system` may repeat during supported restore
  semantics. The adversarial proof lives in the Campaign 022 audit map.
- **Backup export double canonicalization — RESOLVED in Campaign 028 W2:**
  the production export call site now uses the single-pass
  `exportLocalDataBundle` ("MUST"); byte-identity is pinned by the existing
  serializer and 20k-session suites. The 027 "no proof" deferral rationale is
  obsolete and removed.
- **Offline validator heuristic gap — RESOLVED in Campaign 028 W4:** the
  scanner removes the `*`/`//` line-skip false negatives, truncates at real
  comments, and detects aliased/destructured/bracket global access plus
  `sendBeacon`/`EventSource`; self-tests (18) pin the behavior. The remaining
  limit — network APIs assembled from runtime strings (`'f'+'etch'`) — is a
  documented static-analysis bound; the monkeypatched runtime offline suite
  stays the stronger evidence.
- **Seeding test-fixture seam noise — Low:** partial Jest DB facades can emit non-fatal startup noise not representative of the production facade.
- **Permanent provenance allowlist dead entries — RESOLVED in Campaign 027 W6:**
  the 22 inert no-expiry entries were replaced with two precise, expiring
  non-semantic entries (attention-target-count generator + language-context-fit
  content-validation dead-export removals); `validate-provenance --check` is
  clean and no permanent inert entry remains.
- **Runtime dependency advisory — accepted debt, expires 2026-12-31
  (Campaign 027 W4; expiry now gate-enforced by Campaign 028 W4.1):** `decode-uri-component` GHSA-vcc3-ghjq-m6fr (ReDoS on
  malformed percent-encoded input, moderate) is reachable at runtime via
  `expo-router@57 -> query-string@7.1.3 -> decode-uri-component`. No compatible
  fix exists: query-string@7 pins `^0.2.2`, the patched 0.5.0 is ESM-only and
  breaks the CJS require, and npm audit's only \"fix\" is an expo-router
  semver-major downgrade. Escalated explicitly in
  `scripts/certification/dependency-audit-allowlist.json`
  (classification `runtime-accepted-debt`, expiring) with the production-audit
  gate still failing on any new advisory; drop the entry when expo-router
  advances to a query-string major carrying the fix (next Expo SDK upgrade).
- **QA artifact retention — RESOLVED in Campaign 028 W3:** `initRunDir` now
  prunes completed harness run dirs to the newest `QA_KEEP_RUNS` (default 10)
  and never touches curated evidence dirs; `QA_NO_PRUNE=1` opts out.
- **Build/dev dependency advisories:** retain the existing dependency-audit classification and re-evaluate with planned framework/toolchain upgrades; do not force unrelated dependency churn into a release-doc cleanup.
- **`attention-visual-search` best-reaction 0 sentinel (Low, documented):**
  this game intentionally keeps its in-reducer `fastestResponseMs: 0` initial
  state and persists it when no valid sample exists (explicitly out of scope in
  `null-absent-performance-metrics`, which migrated Color Stroop and the four
  logic/attention siblings to `null`). The Progress reaction-best extractor now
  ignores non-positive bests, so the sentinel cannot surface as a 0 ms record;
  migrate AVS to `number | null` if its in-reducer shape is revisited.
- **Achievements/quest sync scan — RESOLVED in Campaign 027 W2:** the
  production quest path no longer bypasses a cap —
  `syncQuestProgress` materializes at most `SYNC_SESSION_SCAN_LIMIT` (5000)
  recent samples (`apps/mobile/src/progression/sync.ts`) while longterm
  `session-count`/`earn-xp` quests evaluate from SQL `lifetime` aggregates, so
  lifetime progress stays exact at any history size. Achievements already
  evaluate entirely from O(1) aggregates (`buildAchievementSnapshot`). The
  documented 5000-sample bound is deliberate and non-blocking.
- **Constitution-deferred product systems (not bugs):** cloud sync/auth,
  telemetry, and monetization/ads remain deferred by
  `docs/PROJECT_CONSTITUTION.md`; they are planned future layers, not open
  defects, and must not be implemented without an owner-authorized campaign.

## Campaign 024 findings (added 2026-09-12)

All are environment/operational or explicitly deferred product polish; none is a
Critical/High product defect.

- **Expo dev-server web-bundle crash (environment):** the SDK 57 dev server can
  exit with `AssertionError: Worker chunk not found for
  expo-sqlite/web/worker.ts` while bundling the web platform. When it dies
  mid-run, every remaining autobot target fails with "app did not warm to home
  (Metro/JS load)" — an environment failure, never a product failure. Workaround
  shipped: `qa-artifacts/campaign024/run-catalog.mjs` health-checks Metro between
  batches and restarts it.
- **Display-profile change under a running activity (QA artifact):** applying
  `wm size`/`wm density` while the app is live restarts it into the
  storage-error boundary because the JS runtime keeps native handles from the
  previous configuration. A cold start under the new profile renders correctly,
  and rotation (the real user path) is unaffected. `ui-capture.mjs` now restarts
  the app after a profile change and treats a storage-error frame as an invalid
  capture.
- **Full-catalog `--mode certify` gate BLOCKED (environment):** the gate requires
  exactly one attached device; a second emulator belonging to the user's own work
  is attached for the session and was deliberately not touched. Evidence for the
  catalog therefore comes from the 8/8 canary run, the daily-workout journey, and
  the 4025-test game suite rather than the aggregate certify verdict.
- **Device-representative frame timing NOT VALIDATED:** frame percentiles on the
  GPU-enabled emulator are dominated by host GPU translation (the stock launcher
  shows the same profile). The app itself renders 0 frames while idle. Re-measure
  on a physical device before making FPS claims.
- **Structured HUD progress — WIRED in 41/42 games (Campaign 025):** `GameHost`
  renders the segmented HUD bar from `roundProgress`; every finite-round game
  except `memory-sequence-memory` reports it. `memory-sequence-memory` is a
  time-boxed score attack with no round total and intentionally keeps the round
  chip (HUD R2). Resolved; no follow-up.

## Campaign 023 findings — all resolved

The eight Low/Medium findings from the 2026-09-11 all-games audit are no longer
open: adaptive escalation (`spatial-coordinate-turn`, Campaign 027 W1), late-tap
SFX (Campaign 024), lingering vigilance stimulus (Campaign 027 W1), missing
vigilance screen test (Campaign 025), stale word-scramble tutorial copy
(Campaign 025), dead color-stroop actions and the speed-color-match non-finite
metric (Campaign 027 W1), and the headless screenshot limitation (superseded by
the GPU capture AVD, Campaign 024). Original entries remain in Git history.

## Operational recommendation (owner-side, not a product blocker)

- **`main` branch protection not configured:** observed 2026-09-05/06 — the
  GitHub repository has no branch-protection rules and no required status
  checks on `main`, so direct pushes can bypass CI. Recommended: protect
  `main` and require the four release checks. Repository-administration
  changes require explicit owner authorization; not executed autonomously.

## Evidence location

Exact Campaign 022 artifact hashes, 42/42 certify evidence, Workout/lifecycle/SQLite/backup/offline/security evidence, platform classifications, workflow run IDs, and prior campaign history remain in `.agent/VALIDATION.md` and the OpenSpec packet. Historical blockers and earlier campaign limitations remain available in Git history; this living file intentionally contains only the current actionable truth.
