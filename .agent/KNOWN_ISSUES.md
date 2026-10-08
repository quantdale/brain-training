# Known Issues / Blockers

## Campaign 076 — current blocker (2026-10-08)

**BLOCKED_EXTERNAL_ARTEMIS_PROVIDER — authentication.** One bounded current
Pro attempt `cecc4f2a-ae03-4868-a074-adf533e12a61` failed after 15.4s with
HTTP 401 Invalid credential; trace has no plan/steps. Current Flash
`043dea1e…` separately failed runner startup. Doctor readiness is not auth
acceptance. Owner must repair the configured credential only in the external
ARTEMIS environment; no secret in chat/repo, no retry until repaired, no
provider/controller fallback. Source `c324960` four workflows GREEN; new
APK `de6c5fcd…` has reviewed/filed 90/90 routes + 2 scrolled Results pairs,
0 automated violations, 32 occluded nodes unmeasurable. Captured Progress
badge clipping fixed and natively revalidated. All 22 current-build game gap
frames and remaining acceptance gates still owed; historical 168-state
completeness is not this APK's certification. iOS BUILD PASS / RUNTIME
NOT VALIDATED. Exact evidence: change `evidence/CLOSURE_CHECKPOINT.md`.

## Earlier Campaign 076 recovery — HISTORICAL / superseded

Current recovery supersedes the artifact/count claims in the historical review
below: `6e31d41e` has 90 acquired route pairs, but 2× Progress-detail badge
clipping is a concrete responsive defect. Minimal header-wrap repair is
unit-tested; native recertification owed on a new APK. Only 21/22 new gap pairs
exist (Tap Rush feedback absent); filed `b2913bca` 168-state completeness is
historical, not current rendering acceptance. `c3c75b9` App CI failed a stale
fractional-HUD expectation; test corrected, full local matrix PASS, current
remote run owed. Current source needs a rebuilt APK, new-identity captures,
final visual/a11y checks, controller attempt and evidence filing. See
`evidence/CLOSURE_CHECKPOINT.md`. No external/runtime blocker has been relabeled
PASS. **Historical review findings and their then-current identities follow.**

- **High, device gate:** final APK SHA-256 `c3b3e4d9…` has 8/8 verified
  focused detail stills, but the required 90-route/theme/profile matrix
  aborted after 1,800 seconds due to dedicated AVD launcher/SystemUI ANRs
  and a null accessibility root. Earlier verified 90/90 captures belong to
  `00024954…` and cannot certify final rendering. The AVD was stopped, then
  recovered 2026-10-07; the full final matrix still remains NOT VALIDATED.
  A later contrast-fix build must be recaptured. Diagnostics in ignored
  `qa-artifacts/076-ui-reboot/` and `qa-artifacts/076-final/`.
- **High, missing visual proof:** image-by-image audit of 42 games disqualified
  16 mislabeled/non-state frames (preserved under `rejected/` with hashes).
  Retained per-game evidence: A 39/42, F 27/42, P 38/42, R 42/42;
  **22/168** core state frames NOT VALIDATED. No state is inferred from
  a unit test or another game; see `GAME_ASSESSMENT.md` for individual gaps.
  Old mixed-build frames also cannot certify final shared-button changes.
- **Release boundary, external provider:** ARTEMIS Flash smoke PASS, but all
  nine Pro attempts provider-BLOCKED by 429/503/180s. Direct ADB workouts
  and SQLite audit are supplementary only, not ARTEMIS Pro acceptance.
- **iOS:** NOT VALIDATED; no macOS/Xcode host. Source changes establish 48dp
  Android and 44pt iOS touch floors, not iOS runtime confirmation.
- **Resolution:** do not restore the withdrawn `VALIDATED` verdict or check
  14.2/14.3/14.4/14.7 while these gates remain missing. Re-run a complete
  final-build device matrix, file genuine per-game states and provider-led
  Pro traces; verify hashes, build identity and committed paths. Escalate
  provider/AVD limitations as exact BLOCKED conditions, not PASS.

## R1 CLOSED — GitHub Actions runner allocation restored (2026-10-02)

**R1: CLOSED.** The billing-era blocker (jobs never started, `runner_id: 0`,
0 steps, provider billing annotation) is historical: after the repository
became public, a fresh four-workflow round at `d37508db3` allocated real
runners and passed all four lanes (runs `36995040040`, `36995044116`,
`36995048524`, `36995052530`). Historical billing incident retained
unchanged in `.agent/VALIDATION.md`. Current open residuals are enumerated in
the residual register of the PUBLIC-REPO FINAL RECERTIFICATION block there.

## Storage-seam latent exposure — SQLite adapter re-entrancy (2026-09-30, Change 068)

**Severity: High (latent, unrecoverable if triggered). Owner: storage/runtime
owner (release-engineering orchestrator). Status: guarded; residual exposure
accepted and bounded.**

- **What was wrong.** `docs/hardening/post067/PASS_B_RUNTIME.md` recorded "the
  adapter … verified it fails loudly at `BEGIN`". That was measured on the Node
  test backend only. On the device backend, a nested `transaction()` — or a
  connection-level `exec()` — reached through the outer adapter was enqueued
  behind the single per-native-handle queue slot its own transaction was
  holding. It never reached `BEGIN`, never rejected, and never resolved: a
  permanent, error-free application freeze with no log line and no recovery
  short of killing the process.
- **What changed.** Re-entrancy is now rejected BEFORE enqueueing on both
  backends with one shared `SQLiteReentrantTransactionError`
  (`src/db/transaction-scope.ts`), keyed on the native handle (Expo) / driver
  handle (Node) so two JS wrappers over one native database are one transaction
  scope. `AppDatabase.rawExec()` inherits the same guard.
- **Remaining latent exposure (accepted, not fixed):** a *future* call site
  that forgets to thread `txn` is no longer a freeze, but it is now a thrown
  error on a user-visible path, which would surface as a failed session
  completion, claim, or reroll. The guard converts an unrecoverable silent
  failure into a loud, diagnosable one; it does not make the mistake
  impossible.
  - **Current exposure measured 2026-09-30: zero.** All 31 non-test
    `transaction(` call sites thread `txn`, and no production code wraps
    `transaction()` in a `Promise.all` against one adapter.
  - **Narrowing accepted deliberately:** because the guard is a property of the
    connection rather than of the call stack, an independent caller that opens a
    transaction *while another transaction's body is awaiting* is rejected
    instead of being queued behind it. Both are correct serializations; the
    rejection cannot deadlock. Zero current call sites rely on the queued form.
  - **Bounded by:** `src/db/adapters/__tests__/expo.test.ts` (device half, with
    a jest timeout as a hang backstop) and
    `src/db/__tests__/transaction-reentrancy.test.ts` (Node half, 13 cases).
- **Device-lane requirement — CLOSED 2026-10-03 (device-confirmed).** The device
    half previously proven only against a fake native handle is now confirmed on a
    real `expo-sqlite` connection on the dedicated AVD
    (`braintraining-ui35` / `emulator-5554`, Android 15, debug APK from `096aefc`):
    the four connection invariants are verified by the apply-and-read-back gate
    (`initializeConnection`), which succeeded at boot
    (`bootstrap-db-init` outcome success) — `foreign_keys=1`, `busy_timeout=5000`,
    `journal_mode=wal` (also measured on the live file by the on-device `sqlite3`),
    `synchronous=NORMAL`; the app's bundled engine is SQLite **3.50.3**
    (`libexpo-sqlite.so`). An existing pre-Change-068 install (rollback journal,
    header `1/1`, schema v12) transitioned to WAL on first open with the v12→v13
    migration and zero data loss, and `-wal`/`-shm` sidecars were observed. All
    three measured exposure statements in this entry remain true; only the
    "device half not yet exercised" gap is closed. Evidence:
    `docs/redesign/evidence/change068-device/DEVICE_SQLITE_CONFIRMATION.md`.

## Connection-invariant device confirmation — WAL sidecars (2026-09-30, Change 068)

**Severity: Medium (operational, not a defect). Owner: release-engineering
orchestrator. Status: decided; device confirmation recorded 2026-10-03.**

- `journal_mode = WAL` is now applied and asserted on every connection. It is a
  **persistent property of the database file** and creates `-wal` / `-shm`
  sidecars (measured: the `-wal` file appears on the first write and is
  checkpointed away on close). A reader that cannot create those sidecars sees
  an unreadable database.
- **Consequences already handled:** the backup path exports through the logical
  backup API rather than copying the file, so the exported envelope is
  unaffected. `synchronous = NORMAL` is documented as trading power-loss
  durability for commit latency, which is the right trade for a local
  offline-first single-device product but is a decision, not a free win.
- **Device-confirmed 2026-10-03:** the sidecars are present on the dedicated AVD
  while the app runs (`brain-training.db-wal` + `-shm` beside the main file), the
  live file answers `journal_mode = wal`, and a force-stop leaves the WAL
  **uncheckpointed** (measured: 177 KB `-wal` survived the kill) with recovery on
  the next open verified (bootstrap success, all rows retained). The
  certification ledger's on-device SQLite audit must therefore expect sidecars
  for a running app and for a force-stopped one — not just a clean close — and
  must not treat their presence as corruption. Evidence:
  `docs/redesign/evidence/change068-device/DEVICE_SQLITE_CONFIRMATION.md`.

## Campaign 055 disposition — DESIRABILITY PASS (2026-09-20, VALIDATED / COMPLETE)

Verdict `CAMPAIGN_055_DESIRABILITY_PASS_COMPLETE`. All RETHINK/REFINE surfaces
were materially improved; the resumption closed the bounded
result/accessibility/copy debt; the pixel-certification session recovered the
host display path, ran the six-way matrix with real composited pixels, found
and repaired three genuine defects, and re-certified the final artifact
(`99D1D132…0C55`, checkpoint `34c9b2d`) with the complete pixel, accessibility
and runtime matrices (`PIXEL_CERT_ENVIRONMENT.md`, `PIXEL_CERT_MATRIX.md`).

- **Historical environment failures (CLOSED).** The first session's emulator
  `0xC0000005` crash loop and the resumption's 0-frame host compositing
  failure are preserved as history in `RESUMPTION_ENVIRONMENT_RECOVERY.md`.
  Root causes for closure: the legacy `-gpu swiftshader_indirect` value is
  invalid in emulator 37.1.11, and the `aosp_atd` fallback image cannot
  composite app frames on this host; `braintraining-ui35` with `-gpu host`
  produces real frames.
- **HUD pause clipping (FIXED).** The in-session instrument strip clipped the
  trailing pause control (off-screen at font-scale-2); `SessionHeader` now
  wraps and the small `GameButton` sizes to content (`f95c5dd`).
- **Duplicate unrounded score row (FIXED).** Ten games printed the raw score
  float in a duplicate fact row beside the focal numeral; the redundant row
  was removed (`53468e4`).
- **Tutorial retry unreachable (FIXED).** Tall demo steps clipped the
  `Try again` control to negative height and dead-ended the deduction-table
  tutorial; the `TutorialFrame` cap now allows the full overlay height
  (`34c9b2d`).
- **Remaining visual debt (LOW, accepted).** Game-owned short-board dead
  space; at font-scale-2 two controls sit just below the first fold inside
  verified scrollable containers (`Add to favorites`, route-Result primary
  action). Manual/external boundaries (human TalkBack/VoiceOver quality,
  physical/OEM devices, iOS runtime, store signing) remain outside repository
  authority.
- **Compact/light accessibility observations (CLOSED).** The 27 measured
  `target<44dp` nodes were an audit-density artifact (420 default against
  320-dpi compact captures); correct re-measurement leaves only the four
  Progress window tabs at 32 dp, which meet the 44 dp interaction contract via
  the shared `Tappable` hit-slop. 0 unresolved TRUE_UNDERSIZED_TARGET, 0
  unlabelled nodes, 0 decorative-art leaks
  (`ACCESSIBILITY_RESPONSIVE_QA.md`).
- **In-game Results band adoption (CLOSED).** All 42 games now pass their
  canonical normalized result; the redundant duplicate `Score` row was removed
  in the 27 games that showed it twice. 0 legitimate non-adopters; no invented
  normalization (`NORMALIZED_RESULT_ADOPTION.md`,
  `RESULT_DUPLICATION_CLOSURE.md`).
- **Progress drill-downs (CLOSED).** Nine shared `explainMetric` captions were
  rewritten in player language with no figure or analytical semantic change
  (`COPY_AND_LABEL_AUDIT.md`).
- **Gameplay dead space (CLOSED as non-issue).** Classified Class B
  (game-owned board geometry); no shared layout defect, no board stretching
  (`VISUAL_CRITIQUE.md`). Short-board composition remains game-specific future
  visual debt.

## Campaign 054 disposition — TERMINAL GAP CLOSURE (2026-09-19)

The Campaign 054 terminal gap-closure campaign produced a 44-gap census
(`docs/redesign/evidence/campaign054/GAP_CENSUS.md`) with **zero open
repository-owned Critical/High/Medium correctness gaps**. Highlights:

- Validation counts reconciled to **564 suites / 6,726 tests** (the
  intermediate 563/6,724 figure was missing the `perf-probe-contract` suite).
- Release APK SHA-256
  `1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F` proven
  byte-identical to a forced rebuild of the current tree (product source
  unchanged from `02a7ecb`). The APK is debug-signed.
- First-install/cold-start ANR: `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`
  (30 bounded launches including a true emulator cold boot; 0 ANR dialogs and
  0 fatal/ANR/SQLite markers).
- System Files import path: `CLOSED_VERIFIED` technically (export → picker →
  cancel → selection → valid preview 0 additions → idempotent merge →
  malformed rejection, 0 provider ANR); human provider usability remains
  `MANUAL_PLATFORM_PENDING`.
- External CI: `EXTERNAL_BLOCKER_VERIFIED` / `ACCOUNT_OR_POLICY` (current runs
  zero-step with the provider billing annotation; no workflow edited).
  **SUPERSEDED 2026-10-02:** this classification is historical as of Campaign
  054. The repository is now public and all four workflows execute on real
  GitHub-hosted runners (R1 CLOSED — see the PUBLIC-REPO FINAL RECERTIFICATION
  block in `.agent/VALIDATION.md` and the FINAL CLOSURE block in
  `.agent/STATE.md`). The billing incident record itself is retained unchanged.
- Dependencies: `js-yaml` GHSA-2883-xcg3-v3hh remediated in-range; remaining
  advisories keep time-bounded accepted dispositions (see
  `DEPENDENCY_AUDIT.md`).
- All five opt-in probes executed; unexpected-console baseline and the 42-game
  persistence exemption roster remain empty.
- Human TalkBack/VoiceOver quality, physical/OEM Android, iOS runtime,
  production/store signing, store-install path, human system-provider
  usability, and independent human participation remain NOT VALIDATED /
  `MANUAL_PLATFORM_PENDING` with executable handoffs.

Terminal ledger: `docs/redesign/evidence/campaign054/TERMINAL_GAP_LEDGER.md`.

## Campaign 053 disposition — IMPLEMENTATION APPLIED (2026-09-19)

The Campaign 053 whole-system hardening change was implemented under an
owner goal-mode directive. Bootstrap is now a classified pipeline whose
foundational failures (database, catalog registration, progression init)
withhold the normal shell behind honest recovery screens, with fault
injection and idempotency contracts; the router advisory disposition was
renewed after proving no compatible Expo remediation exists; the app-owned
route input envelope bounds canonical parameters as defense in depth; the
known test-console noise was repaired at the source and a reviewable
unexpected-console gate (empty baseline) is active; and a registry-derived
persistence matrix covers all 42 games for success, rejected save, and stale
completion with an explicit exemption mechanism.

The full gated suite is 564 suites / 6,726 tests passing with 4 suites / 5
tests classified opt-in skips (the intermediate 563 suites / 6,724 tests
figure was captured before the final `perf-probe-contract` suite existed and
was reconciled by Campaign 054:
`docs/redesign/evidence/campaign054/VALIDATION_COUNT_RECONCILIATION.md`);
typecheck, lint, every repository validator, and OpenSpec
37/37 strict pass. The release APK containing these changes is installed on
the dedicated `emulator-5554` and the startup/relaunch/route-boundary journey
is recorded under `docs/redesign/evidence/campaign053/`.

Human TalkBack/VoiceOver, physical/OEM Android, iOS, store signing, human
system-provider usability, and external GitHub runner execution remain
NOT VALIDATED / external and are not implied by any local result.

## Campaign 051 disposition — VISUAL REBOOT COMPLETE (2026-09-19)

The Signal Arcade visual reboot is validated for the repository-owned and
dedicated Android scope. The final artifact has current default, compact, and
font-scale-2 light/dark evidence (66/66 captures), zero measured a11y
violations, 42/42 route arrivals, invalid-route recovery, and exact-final-APK
ARTEMIS smoke. Source registry/lifecycle coverage and stable semantic
contracts remain green.

The local release capture also recorded a transient Android System UI dialog
on the first screenshot. The Campaign 051 evidence records exactly a
“transient Android System UI dialog” (`VISUAL_QA_AND_CRITIQUE.md`,
`EXTERNAL_BOUNDARIES.md`); it does not identify an “isn't responding” ANR —
that wording belongs to the Campaign 050 observation, which Campaign 054
re-tested on the exact final APK. Emulator-local hierarchy
simplified dismissal led to clear subsequent app frames, and the narrowed post-capture
app log scan found no fatal, app-ANR, OOM, or SIGSEGV markers. Keep this as a
bounded first-capture observation rather than a clean first-launch claim.

Human TalkBack/VoiceOver, physical/OEM Android, iOS, production/store
signing, human system-provider usability, and external GitHub runner execution
remain external or manual boundaries. No new Critical or High product issue
was identified by this campaign. During native probing, repeated cold route
restarts destabilized the disposable AVD framework; the dedicated AVD was
recovered with a clean boot and the final APK was reinstalled. This is a
test-infrastructure caveat, not an app failure classification.

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

- GitHub Actions at the time was `INDETERMINATE_EXTERNAL_PRE_STEP`; that
  classification was SUPERSEDED by Campaign 044's provider-annotation
  diagnosis, `ACCOUNT_OR_POLICY` (the four latest workflows failed before
  their first step and produced no repository logs).
- At the time of Campaign 042 this was dependency maintenance debt; Campaign
  045 resolved the five-package Expo SDK57 patch drift and recorded the fresh
  21/21 result.
- Human TalkBack/VoiceOver, iOS, physical-device, store-signing, and native
  document/share-sheet validation remain `[NOT VALIDATED]`.
- Ordinary non-actionable card-copy edge clipping remains documented; no
  actionable control was clipped in the final audited matrices.

## Campaign 041 findings — HISTORICAL / SUPERSEDED (2026-09-18; reconciled 2026-09-19)

Campaign 041 was an audit overlay whose `CAMPAIGN_041_CONDITIONAL` label was
correct at the time. Every technical item it left open was subsequently closed
by a later campaign; the items below are **historical, not current**. External
and manual boundaries are tracked separately in this file.

- **SQLite `NativeDatabase.prepareAsync` NPE (was Medium):** SUPERSEDED —
  reproduced, isolated, and repaired in Campaign 042 (per-native-handle
  serialization, `useNewConnection: true`, coalesced initialization) with
  focused tests and release relaunch revalidation. Source still carries the
  repair (`apps/mobile/src/db/adapters/expo.ts`). Evidence:
  `docs/redesign/evidence/campaign042/SQLITE_STARTUP_NPE_ISOLATION.md`.
- **Compact/font-scale clipping risk (Home row ~27dp/19dp visible):**
  SUPERSEDED — the actionable large-text defect (Results CTA) was repaired in
  Campaign 042; the residual was classified as non-actionable card-copy debt;
  Campaign 051 rebuilt the Home surface and compact/font-scale matrices then
  passed with zero measured violations.
- **Release XML/a11y capture blocked by UiAutomation registration:**
  SUPERSEDED — Campaign 042 obtained release UIAutomator hierarchy and a11y
  captures (22 surfaces, 0 violations); Campaigns 043/049/051 added release
  PNG+XML matrices.
- **Catalog lifecycle 39/42:** SUPERSEDED — Campaign 042 closed the three named
  games and Campaign 046 re-proved detail/start/first-interactive/result/
  persistence/return for all 42 registry ids (44 sessions across 42 ids,
  integrity `ok`).
- **Dependency/release debt:** PARTIALLY SUPERSEDED — Campaign 045 resolved
  the Expo patch drift; Campaign 054 applied the in-range js-yaml
  remediation. The local APK remains debug-signed and store signing remains a
  manual/platform boundary (see Campaign 045 disposition above).
- **External CI:** SUPERSEDED classification — Campaign 044 established
  `ACCOUNT_OR_POLICY` from provider check-run annotations; Campaign 054
  re-verified the current runs under the same classification
  (`docs/redesign/evidence/campaign054/EXTERNAL_CI_FINAL_CLASSIFICATION.md`).
- **Native state-matrix scope:** the 22 captures were 11 routes x 2 themes;
  later campaigns added invalid-route, storage-failure recovery, settings,
  journey, and responsive states (042/049/050/051/053 and the Campaign 054
  final convergence). Enumerated branch-level exhaustive coverage is not
  claimed beyond the recorded matrices.

Historical packet and its mandatory second pass: `docs/redesign/evidence/campaign041/`.
Campaign 041 made no product source repair.

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

## Maintenance ledger (open items and resolved records)

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
- **Permanent provenance allowlist dead entries — RESOLVED in Campaign 027 W6; closed out in Campaign 066:**
  the 22 inert no-expiry entries were replaced with two precise, expiring
  non-semantic entries (attention-target-count generator + language-context-fit
  content-validation dead-export removals). Campaign 066 verified both edits
  are already in the drift base (`212469d`), so the entries exempted nothing
  while still carrying a 2026-11-11 expiry that would have hard-failed the
  freshness gate; both entries were therefore removed and
  `.agent/provenance-allowlist.json` is now empty. Future edits to those two
  files require the normal version bump (generatorVersion / contentVersion).
  The freshness gate stays wired into Repository Integrity (push + weekly).
- **Runtime dependency advisory — accepted debt, expires 2027-03-31
  (Campaign 027 W4; expiry now gate-enforced by Campaign 028 W4.1;
  expiry value reconciled with
  `scripts/certification/dependency-audit-allowlist.json` and
  `.agent/DEPENDENCY_AUDIT.md` in Campaign 064):** `decode-uri-component` GHSA-vcc3-ghjq-m6fr (ReDoS on
  malformed percent-encoded input, moderate) is reachable at runtime via
  `expo-router@57 -> query-string@7.1.3 -> decode-uri-component`. No compatible
  fix exists: query-string@7 pins `^0.2.2`, the patched 0.5.0 is ESM-only and
  breaks the CJS require, and npm audit's only \"fix\" is an expo-router
  semver-major downgrade. Escalated explicitly in
  `scripts/certification/dependency-audit-allowlist.json`
  (classification `runtime-accepted-debt`, expiring) with the production-audit
  gate still failing on any new advisory; drop the entry when expo-router
  advances to a query-string major carrying the fix (next Expo SDK upgrade).
  **Renewal owner:** release-engineering orchestrator; renew the expiry
  before 2027-03-31 or at the next Expo SDK upgrade review, whichever
  comes first, and repeat the re-evaluation recorded in
  `.agent/DEPENDENCY_AUDIT.md` before renewing.
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
