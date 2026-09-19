# Known Issues / Blockers

## Campaign 051 disposition — VISUAL REBOOT PARTIAL (2026-09-19)

The Signal Arcade visual reboot is validated for the repository-owned and
bounded Android scope. The current full compact/font-scale matrix and fresh
native visual capture of every 42-game route were not rerun after the shared
visual changes; do not describe those evidence classes as current Campaign 051
passes. Source registry/lifecycle coverage, stable semantic contracts, and the
representative release surfaces remain green.

The local release capture also recorded a transient Android System UI
“isn't responding” dialog on the first screenshot. Emulator-local hierarchy
dismissal led to clear subsequent app frames, and the narrowed post-capture
app log scan found no fatal, app-ANR, OOM, or SIGSEGV markers. Keep this as a
bounded first-capture observation rather than a clean first-launch claim.

Human TalkBack/VoiceOver, physical/OEM Android, iOS, production/store
signing, human system-provider usability, and external GitHub runner execution
remain external or manual boundaries. No new Critical or High product issue
was identified by this campaign.

## Campaign 050 disposition — RELEASE CONDITIONAL (2026-09-19)

The integrated release-candidate packet is complete for the tested
Android/repository scope. ARTEMIS observed a transient first-install
`Brain Training isn't responding` dialog; the mandated one-time close/relaunch
recovered Home and the full protected journey continued. A direct later cold
launch was `Status: ok`, `LaunchState: COLD`, `MainActivity`, `TotalTime:
10047`, with no targeted app error markers. Reproduce this first-install
startup observation before store/public release; do not present it as a clean
first-launch PASS.

The Android share sheet was reachable and safely cancelled. The Android Files
provider reached the import picker but presented an external ANR during
dismissal; no file was selected or imported, and import-provider usability is
NOT VALIDATED. The local APK remains debug-signed. Human TalkBack/VoiceOver,
physical/OEM, iOS, store-signing, human system-provider, and external GitHub
runner evidence remain explicitly unavailable or external.

## Campaign 045 disposition — COMPLETE for technical local scope (2026-09-19)

The Expo SDK57 patch drift was resolved with the supported five-package
alignment. Expo Doctor is 21/21; the remaining raw `npm audit --omit=dev`
findings are 15 moderate and 5 high and remain covered by the five accepted
advisory classifications in `.agent/DEPENDENCY_AUDIT.md`. Do not run a broad
major-version audit fix as part of the catalog campaigns.

The local release artifact remains debug-signed. Human-quality TalkBack,
physical Android, iOS/VoiceOver, store signing, and independent manual lanes
remain unavailable. GitHub Actions is classified separately as the Campaign
044 account/payment-policy external blocker; do not edit workflows to mask it.

## Campaign 042 disposition — TECHNICAL CERTIFIED (2026-09-18)

Campaign 042 reproduced and repaired the previously open SQLite startup NPE
and the font-scale-2 Results CTA clipping. The release replays, three-game
result/persistence checks, 22-surface route/theme matrix, responsive audits,
and local repository gates passed for the documented Android scope. The full
disposition and raw-artifact paths are under
`docs/redesign/evidence/campaign042/`.

Remaining boundaries are not silently closed:

- GitHub Actions remains `INDETERMINATE_EXTERNAL_PRE_STEP`; the four latest
  workflows failed before their first step and produced no repository logs.
- At the time of Campaign 042 this was dependency maintenance debt; Campaign
  045 resolved the five-package Expo SDK57 patch drift and recorded the fresh
  21/21 result.
- Human TalkBack/VoiceOver, iOS, physical-device, store-signing, and native
  document/share-sheet validation remain `[NOT VALIDATED]`.
- Ordinary non-actionable card-copy edge clipping remains documented; no
  actionable control was clipped in the final audited matrices.

## Campaign 041 current audit findings — CONDITIONAL (2026-09-18)

Campaign 041 re-proved the current Android/repository core but found bounded
items that prevent unconditional release closure:

- **Medium, unreduced runtime observation:** one debug matrix run reached
  `Couldn’t load today’s workout`; logcat showed a
  `NativeDatabase.prepareAsync`/`NullPointerException` in the workout-load
  path after bootstrap. Cold relaunch recovered it and an exact replay was
  clean, so no root cause or safe repair is claimed. Reproduce/minimize before
  changing the database/workout seam.
- **Low/Medium layout risk:** compact and font-scale-2 captures showed a Home
  row with approximately 27dp and 19dp visible height respectively. This is a
  current large-text/compact-viewport risk requiring a bounded layout decision,
  not a reason to disable accessibility checks.
- **Validation tooling:** the light debug a11y run saw a 20dp LogBox close
  control on every light surface; the final reset replay had no LogBox. Release
  XML capture was blocked by an already-registered UiAutomation service. A
  later clean release launch left a resumed activity with a uniform dark
  surface and a zero-byte follow-up screencap while ADB remained connected;
  logcat had no app fatal. This is retained as a dedicated-AVD rendering
  evidence gap, not silently counted as clean or promoted to a product defect.
- **Dependency/release debt:** raw `npm audit --omit=dev` exits with 15
  moderate and 5 high findings, while the repository policy validator passes
  by classifying accepted/toolchain families. Resolve ownership before a broad
  dependency upgrade. The local release APK is not production-signed.
- **External CI:** all four current GitHub runs fail before any step with no
  failed log; classification is `INDETERMINATE_EXTERNAL_PRE_STEP`. Do not edit
  workflows to hide the result.
- **Catalog lifecycle gap:** all 42 current game IDs reached detail and first
  interactive state, but the retained result sweep is 39/42. Equation Builder,
  Sequence Memory, and Coordinate Turn reached a board without reaching a
  result. A clean rerun was blocked by the dedicated AVD’s repeated
  UiAutomation registration and debug Metro/redbox instability. Do not report
  this as 42/42 full lifecycle until result/persistence is re-proven.
- **Native state-matrix gap:** the 22 light/dark captures are 11 routes × 2
  themes, not every required search/filter/Favorites/no-results,
  active/pause/final, settings, invalid-route, loading/error, and
  empty/populated branch. Keep these states explicitly partial/not validated.

Evidence and the mandatory second pass are under
`docs/redesign/evidence/campaign041/`. No Campaign 041 product source repair
was made. The next safe action is to minimize the SQLite startup observation,
clear the UiAutomation collision, and repeat the release/a11y boundary before
any release-certification label is strengthened.

## Current status — Campaign 040 VALIDATED / CONDITIONAL

Campaign 040 is complete for the executable repository and dedicated Android
release-candidate scope, classified `CAMPAIGN_040_CONDITIONAL`. The final
22-surface matrix and automated accessibility audit passed; the final release
Memory flow, daily-workout start, relaunch persistence, invalid routes,
catalog/search, offline routes, and filtered startup logcat were observed.
Two bounded release interaction defects were repaired at `0cb7727` and have
focused regressions. No severe product, persistence, migration, economy,
backup/restore, workout/session-identity, or navigation trap remains open from
this pass.

The conditional label is required by unavailable independent human/manual
accessibility, iOS, physical-device, store-signing/system-sheet, full manual
catalog/workout, and external CI evidence. The current four GitHub runs fail
before any job steps (`steps: []`); no workflow was edited. The composite
clean-checkout certifier was not run because this runtime-enabled checkout
contains its existing native/dependency trees; its constituent gates passed.
Do not perform destructive Data actions or edit CI merely to produce green
evidence.

## Campaign 039 VALIDATED

Campaign 039 is terminally validated for the tested Android/repository scope
from Campaign 038 checkpoint `9672c07`. Current startup, route/loading,
persistence/relaunch, list/progress, runtime warning, opt-in probes, and Expo
patch drift were measured. No reproducible redesign-created source performance
defect was established; the isolated Expo SDK 57 compatible patch refresh is
at `eb4d7fb` and its evidence is under
`docs/redesign/evidence/campaign039/`.

Release startup timings varied across emulator/system conditions; they are
recorded as non-causal observations, not a clean benchmark or an invented
regression. The dev GameHost lazy loading card was a real explicit warm-up
state; release bundling loaded the real GameHost intro.

The post-refresh release matrix was 22/22 route-verified/nonblank and the
automated a11y audit reported zero violations. No app-filtered fatal, ANR,
SQLite-lock, or React Native error signal was found. Human/platform limits and
external CI remain pending/external.

Do not edit CI workflows to hide external zero-step failures. Keep any
dependency maintenance isolated and rerun full native validation if it becomes
necessary. Preserve the existing explicit manual/platform limits.

## Campaign 038 VALIDATED

Campaign 038 is terminally validated from the Campaign 037 checkpoint
`a158748`, with source checkpoint `a7f1531` pushed to `origin/main`. Matching
Android light/dark, large-text, compact-phone, settled-scroll, theme, motion,
and sensory evidence is under `docs/redesign/evidence/campaign038/`.

The two initial clipped nodes were followed to settled positions and were
reachable; no layout fix was warranted. A real SQLite writer race was found
when SFX/haptics writes overlapped and was repaired by a root-local queue with a
focused regression test. Fresh post-fix logs and cold-relaunch settings are
clean.

The authorized scope is accessibility/device/motion/sensory hardening only.
Manual TalkBack, VoiceOver, iOS, physical-device, independent human, store
signing, and system document-picker evidence remain explicitly unavailable
unless directly executed.

The compact capture runner falsely labelled two real Game Intro loading cards
as `BLANK`; direct pixel/XML inspection confirmed the route and rendered card.
The initial `UiAutomationService already registered` event was tooling
contention from overlapping hierarchy clients, not an app crash. Both remain
documented as limits rather than suppressed.

## Campaign 037 VALIDATED (previous checkpoint)

Campaign 037 is terminally validated from the synchronized Campaign 036
checkpoint. The native 22-surface baseline and emulator-local route audit are
retained under `D:\Temp\campaign037-runtime-before`; the matching clean after
matrix is under `D:\Temp\campaign037-runtime-after-clean`. The bounded
clean-state copy issue is fixed: Home says `a balanced starting set` without
session history and retains the existing history-aware copy for returning
players. The observed back/return paths and invalid/empty fallbacks remain
operational.

The source checkpoint `ad4e54a` is pushed. Full tests, typecheck, lint,
validators, Android build/install, 22-surface capture, pixel comparison,
automated accessibility, and fresh logcat passed. No routing rewrite,
session/workout identity change, persistence, schema/economy/backup change,
gameplay change, or unsupported claim was introduced. Campaign 038 is the next
safe scope for the deferred device, motion, sensory, and compact-target audit.

## Campaign 036 VALIDATED (previous checkpoint)

Campaign 036 is terminally validated from the synchronized Campaign 035
checkpoint. The bounded fixes add Home local/offline trust copy, a truthful
Data Management `Ready` fallback for initialized local state with unavailable
byte metrics, and Rewards starter-set explanation. Native evidence is retained
outside Git under `D:\Temp\campaign036-runtime-before-all` and
`D:\Temp\campaign036-runtime-after`; the committed evidence package is under
`docs/redesign/evidence/campaign036/`.

No large onboarding, account gate, permission funnel, unsupported cognitive or
medical claim, schema/economy/backup change, or fabricated progression was
introduced. The existing clean Home plan line still says `balanced across your
recent training` when no session history exists; it was observed, intentionally
left outside this bounded slice, and is a candidate for Campaign 037's
cross-surface copy audit.

The manual/platform evidence limits and external zero-step CI failures remain
explicitly pending/external; they are not relabeled as product failures or
successes.

## Campaign 035 VALIDATED (previous checkpoint)

## Current status — Campaign 035 VALIDATED

Campaign 035 (`035-visual-system-consolidation`) is terminally validated as the
bounded successor to Campaign 034. Discovery identified one competing
accent treatment in the single-game identity heroes; implementation is
limited to neutralizing that treatment while preserving domain identity cues.
Native before/after captures are indexed under
`D:\Temp\campaign035-runtime-before`, `D:\Temp\campaign035-runtime-after`,
and `D:\Temp\campaign035-runtime-after-warm`.

The first cold GameHost capture showed the expected real loading screen while
Metro compiled the lazy module; warm light/dark output then rendered and was
reviewed. This remains a development warm-up observation, not a product
failure or a hidden pass.

The following evidence classes remain
explicitly pending or deferred and are not release-clearance claims:
independent human usability validation, manual TalkBack/text-scaling review,
physical-device behavior, manual iOS/VoiceOver, store signing, and Android
system document-picker sheets.

## Campaign 034 VALIDATED (previous checkpoint)

Campaign 034 (`034-profile-motivation-rewards`) is terminally validated. Its
Profile/Rewards ownership evidence is under
`docs/redesign/evidence/campaign034/`; no Critical/High regression was
identified. Campaign 035 is now the active successor.

## Campaign 033 VALIDATED (historical checkpoint)

Campaign 033 (`033-progress-disclosure-redesign`) is terminally validated. The
authorized Progress summary/disclosure redesign is complete and its evidence
package is under `docs/redesign/evidence/campaign033/`. No new Critical/High
product regression was identified. Campaign 034 is closed; the overnight
orchestrator may proceed to Campaign 035.

The following evidence classes remain explicitly pending or deferred and are
not release-clearance claims: independent human usability validation, manual
TalkBack/text-scaling review, physical-device behavior, manual iOS/VoiceOver,
store signing, and Android system document-picker sheets. The required
repository-owned tests, native disposable-AVD pixels, and accessibility matrix
are recorded as PASS in the Campaign 033 evidence package.

## Campaign 031 VALIDATED (historical predecessor)

Campaign 028 (`028-production-readiness`, activated 2026-09-13 under the
owner's successor campaign directive) closed **VALIDATED** and terminal; it
closed the residual release-confidence gaps recorded below (silent user-action
failures, portability robustness, harness navigation reliability and artifact
retention, validator/CI gate integrity, docs truth, cleanup). Predecessors 027
(deep hardening, `212469d`) and 026 (visual identity rebuild) remain VALIDATED.
Campaign 029 (`029-artemis-runtime-qa-migration`) is a historical checkpoint,
**VALIDATED / CLOSED** on 2026-09-17 with its runtime qualification recorded
below; it is not a Campaign 031 product blocker.

Campaign 031 (`031-golden-path-redesign`) was validated under the owner-supplied
2026-09-17 implementation directive. The golden-path product work and its
required native/evidence matrix are complete; its explicit pending/manual
evidence classes remain listed below. No new Critical/High product issue was
identified.

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

## Campaign 029 — ARTEMIS migration status (closed VALIDATED, 2026-09-17)

Campaign 029 (`029-artemis-runtime-qa-migration`) is **VALIDATED / CLOSED**.
The fresh-session runtime gates completed through Codex to ARTEMIS MCP on the
designated `emulator-5554` with the owner-directed OpenCode Go /
`muse-spark-1.3-contributor` XHigh route (`fallback=null`):

- Settings Flash **PASS** — `9aaa2db9-5743-4bf9-9835-ab5b537fb622`
  (Settings to Battery, visible `100%` / `Charged`).
- Brain Training Flash **PASS** — `e927ade5-2b2d-4e2f-a150-7c316230a85d`
  (Home to Games to Grid Recall, legitimate five-cell recall, score 100).
- Brain Training Pro **PASS by direct trace/step/screenshot inspection** —
  `5908e678-4b6d-4abf-8ece-2fcc41b3cc67` (Today's Workout to Cue Keeper,
  pause/resume, background/foreground, safe stop/relaunch, coherent Home).
  Its optional verifier subchecks remain `INCONCLUSIVE` because the Muse route
  rejected their request schemas; they are never reported as verifier PASS.

No Gemini, Union Alpha, or alternate-provider call occurred in the passing
runs. The earlier Gemini/Union Alpha attempts (including the OpenCode Go
Messages HTTP 503 and the invalid Gemini-prewarm trace
`4340ff06-befd-4af7-9404-527940fa68a9`) are historical only. The external
checkout stays local-only and unpushed at revision `2ef304b` over upstream
`371aa6d`; credentials remain only in the external ARTEMIS `.env`.

There is **no open Campaign 029 provider blocker**. The repository migration
(`scripts/qa/autobot.mjs` and its lock integration removed; ARTEMIS
authoritative in CI/certification/self-test/docs; `scripts/android/`
setup/evidence-only; offline runtime-QA contract in place) remains as recorded
in `docs/ARTEMIS_ANDROID_QA.md`.

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
