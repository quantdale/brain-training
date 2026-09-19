# Campaign 051 — Visual DNA Reboot & Massive UI Overhaul

**Status:** ACTIVE
**Campaign id:** `051-visual-dna-reboot-massive-ui-overhaul`
**Predecessor:** `050-integrated-release-candidate-certification` (validated)
**Mode:** day
**Start SHA:** `2a1a0c3`

## Mission

Rebuild the product's visual identity around a distinctive pocket cognitive
arcade / training-console language. The work is research-led: fresh Refero
research and generated visual exploration establish one final reference lock,
then shared tokens, game identity, and product surfaces converge on that lock.
The underlying offline, scoring, persistence, routing, and Game SDK contracts
remain protected.

## Current progress

The fresh research packet is complete. Refero styles, mobile screens, and
progression flows were retrieved; three genuinely different visual directions
were explored with image generation. The source autopsy found a stacked
dashboard/card grammar, repeated neutral game cards, and facts-first result
chrome. The dedicated Android ADB lane is responsive, but the installed
package is disabled with no resolvable launch activity, so a current native
baseline is NOT VALIDATED pending a rebuild/install.

## Exit and progression

Implement the locked Signal Arcade direction across Home, Games, Game Detail,
GameHost/gameplay, Results, Progress, Profile, Rewards, and Data Management;
preserve all stable test IDs and protected behavior; run both critique loops;
execute the repository/native gates that are available; and write one of the
truthful terminal labels `CAMPAIGN_051_VISUAL_REBOOT_COMPLETE`,
`CAMPAIGN_051_VISUAL_REBOOT_PARTIAL`, or `CAMPAIGN_051_BLOCKED`.

Evidence lives under `docs/redesign/evidence/campaign051/`. The OpenSpec
execution packet is `openspec/changes/051-visual-dna-reboot-massive-ui-overhaul/`.

---

# Campaign 050 — Integrated Release Candidate Certification

**Status:** VALIDATED — `CAMPAIGN_050_RELEASE_CONDITIONAL`
**Campaign id:** `050-integrated-release-candidate-certification`
**Predecessor:** `049-accessibility-responsive-state-matrix` (complete)
**Mode:** day
**Start SHA:** `d67aba5`

## Terminal result

Campaign 050 completed the integrated post-043–049 release-candidate
certification for the tested Android/repository scope. Repository gates,
sequential debug/release builds, direct Metro-free launch, protected workout
and persistence flows, representative standalone games, invalid-route
recovery, current responsive/a11y captures, performance probes, provenance,
and OpenSpec validation are recorded under
`docs/redesign/evidence/campaign050/`.

The result is conditional: the first ARTEMIS launch after release installation
showed a transient Android app ANR before the bounded relaunch recovered Home,
and the Android Files import provider presented an ANR. Human/platform,
store-signing, iOS, physical/OEM, human system-provider, and external-CI
boundaries remain explicitly unvalidated or external.

No successor campaign is active. A future owner must deliberately open one.

---

# Campaign 049 — Accessibility, Responsive, System-UI & State-Matrix Hardening

**Status:** VALIDATED — `CAMPAIGN_049_COMPLETE`
**Campaign id:** `049-accessibility-responsive-state-matrix`
**Predecessor:** `048-startup-performance-reliability-soak` (complete)
**Mode:** day
**Start SHA:** `978adc5`

## Mission

Extend release validation into compact, large-font, theme, fixed-navigation,
system-surface, sensory, and state-matrix coverage. Repair only reproduced
user-visible defects, preserve truthful manual/platform boundaries, and leave
the release candidate ready for Campaign 050 certification.

## Current progress

The six-surface light/dark compact and font-scale-2 matrix passed 24/24
post-fix route/nonblank checks. Matching audits reported zero measured
undersized or unlabelled interactive nodes. A native-tab label-density defect
was reproduced at system font scale 2, repaired with a fixed-chrome-only size
cap, and re-captured successfully. Clipped rows remain explicitly classified
as scroll-under-tab evidence.

## Exit and progression

The evidence packet is under `docs/redesign/evidence/campaign049/`; all tasks
are checked and the focused source/test/build/runtime checks are complete.
Validate and push this checkpoint, then activate Campaign 050. Human
TalkBack, iOS/VoiceOver, physical-device, store-signing, and external
system-sheet usability remain separate boundaries unless actually executed.

---

# Campaign 048 — Startup, Performance, Resource & Reliability Soak

**Status:** VALIDATED — `CAMPAIGN_048_COMPLETE`
**Campaign id:** `048-startup-performance-reliability-soak`
**Predecessor:** `047-persistence-migration-backup-resilience` (complete)
**Mode:** day
**Start SHA:** `f8ef2fa`

## Mission

Measure bounded release cold/warm/force-stop/offline and representative route
behavior after the persistence checkpoint. Correlate Activity launch,
semantic Home/content readiness, structured bootstrap/session persistence
markers, repository-scale performance probes, and app-only crash/ANR logs.
Optimize only a reproduced material regression.

## Guardrails

Use only `braintraining-ui35` / `emulator-5554`; use the release artifact for
Metro-independent evidence and the provided performance probe for repository
measurements. Keep sample sizes bounded, distinguish UIAutomator polling from
application latency, and do not change source speculatively.

## Current progress

The 5k/20k query/export/progress/quest/achievement probes passed and produced
timestamped baselines. A three-cycle release force-stop/relaunch sample
rendered Home and `Today's Workout` in all cycles, with Activity `TotalTime`
of 6,324 / 5,002 / 5,866 ms and zero filtered app error markers. Debug Metro
cold starts showed a separate splash/black-frame bootstrap boundary; no
release defect is reproduced. Games, Progress, Profile, and Memory detail also
rendered in the bounded route sample; memory snapshots stayed within a
246–247 MB PSS band with a stable view count. Evidence is under
`docs/redesign/evidence/campaign048/`.

## Exit and progression

Write `docs/redesign/evidence/campaign048/`, validate the OpenSpec change,
update durable state, commit/push a coherent checkpoint, and continue to
Campaign 049. The packet is complete and no speculative optimization was
introduced.

---

# Campaign 047 — Persistence, Migration, Backup/Restore & Corruption Resilience

**Status:** VALIDATED — `CAMPAIGN_047_COMPLETE`
**Campaign id:** `047-persistence-migration-backup-resilience`
**Predecessor:** `046-full-catalog-repeatability-soak` (complete)
**Mode:** day
**Start SHA:** `af1baaa`

## Mission

Adversarially re-test durable state after the Campaign 042 database
serialization repair and the Campaign 046 full-catalog session batch. Cover
fresh and existing v12 databases, historical migrations, repeated relaunch,
concurrent-looking writes, export/import, duplicate replay, invalid/corrupt
input, and session/workout/settings/profile/reward identity.

## Guardrails

Use only `braintraining-ui35` / `emulator-5554` and emulator-local input. Keep
destructive cases disposable; do not apply Replace Import to the retained
catalog database when a valid non-destructive preview answers the question.
Stop on data loss, duplicate irreversible writes, broken migration, broken
backup/restore, or broken session/workout identity.

## Current progress

The focused migration/portability/persistence suite has passed 28 suites and
312 tests with one skipped test. Device export and saved-backup load succeeded;
merge preview was valid with 0 additions and replace preview was valid but was
not applied to the retained catalog database. Disposable test fixtures covered
the applied merge/replace and mid-import rollback paths. A three-cycle release
force-stop/relaunch sample rendered Home in all cycles and filtered app logcat
had no fatal/ANR/React/SQLite/lock/OOM markers. The evidence packet is under
`docs/redesign/evidence/campaign047/`; the checkpoint is ready for validation
and progression.

## Exit and progression

Write `docs/redesign/evidence/campaign047/`, validate the OpenSpec change,
update durable state, commit/push a coherent checkpoint, and continue to
Campaign 048. Migration, idempotency, backup, and identity checks are clean;
the retained-device destructive boundary is explicitly recorded.

---

# Campaign 046 — Full Catalog Repeatability & Game-Lifecycle Soak

**Status:** VALIDATED — `CAMPAIGN_046_COMPLETE`
**Campaign id:** `046-full-catalog-repeatability-soak`
**Predecessor:** `045-expo-sdk57-patch-alignment` (complete)
**Mode:** day
**Start SHA:** `d6864a9023e501506ada57b7e85aeca827a5040a`

## Mission

Increase confidence beyond one lifecycle per game by evaluating all 42
generated-registry games at detail/start, first interactive state, legitimate
result completion, result persistence, runtime health, and navigation return.
Repeat complete lifecycles with real mechanic interaction across all eight
domains/mechanic families. Keep deterministic force-completion evidence
separate from mechanic correctness and inspect the device database for duplicate
or stale durable state.

## Guardrails

Use only `braintraining-ui35` / `emulator-5554` and emulator-local input or the
ARTEMIS runtime lane. Do not touch `emulator-5556`, do not edit game/SDK source
without a reproduced current defect, and do not claim a lifecycle stage that
was not observed. Preserve SQLite, session identity, scoring, progression,
 currency, routing, and offline contracts.

## Current progress

The 42-game registry was traversed through detail, start, first-interactive,
terminal result, persistence, and return navigation. The final pulled database
contains 44 sessions across all 42 game IDs, with clean SQLite integrity,
foreign-key, identity, operation, reward, JSON, numeric-result, and version
metadata audits. Representative real mechanic states were observed across all
eight domains, while deterministic QA completion was kept as a separate
evidence class. Campaign 046's focused persistence/portability run passed 312
tests in 28 suites with one skipped test. Evidence is under
`docs/redesign/evidence/campaign046/`.

## Exit and progression

Write `docs/redesign/evidence/campaign046/`, validate the OpenSpec change,
update durable state, commit/push a coherent checkpoint, and then continue to
Campaign 047. A failed persistence/idempotency check blocks progression; the
Campaign 046 check passed.

---

# Campaign 045 — Expo SDK57 Patch Alignment

**Status:** VALIDATED — `CAMPAIGN_045_COMPLETE`
**Campaign id:** `045-expo-sdk57-patch-alignment`
**Predecessor:** `044-external-ci-workflow-diagnosis` (validated,
account/policy external)
**Mode:** day
**Start SHA:** `59bc801bbaa047834f78819370aa7a805acb1783`

## Mission

Align the installed Expo SDK57 patch family using the supported Expo installer,
prove the dependency graph is internally consistent, and run proportionate
typecheck, lint, test, export, Android build, and Metro-free runtime checks.
Preserve application behavior and avoid unrelated dependency churn.

## Current progress

Initial Expo Doctor reported 20/21 checks passed because five Expo SDK57 patch
versions were behind the installed SDK expectations. `npx expo install` updated
only `expo`, `expo-asset`, `expo-constants`, `expo-router`, and `expo-sharing`
within the patch family; Expo Doctor now reports 21/21. Typecheck, lint, full
Jest, web export, offline scan, runtime contract, Android debug/release builds,
fresh release launch, 12 light/dark route captures, and technical a11y all
passed. Evidence is under `docs/redesign/evidence/campaign045/`.

## Exit and progression

The evidence packet is complete, the OpenSpec change was validated, and the
checkpoint was pushed as `d6864a9023e501506ada57b7e85aeca827a5040a`. Campaign
046 is now active. Do not mask external CI account/policy failures with
workflow changes.

---

# Campaign 044 — External CI / Workflow Infrastructure Diagnosis

**Status:** VALIDATED — `CAMPAIGN_044_ACCOUNT_OR_POLICY_EXTERNAL`
**Campaign id:** `044-external-ci-workflow-diagnosis`
**Predecessor:** `043-independent-platform-release-validation` (partial,
manual/platform pending)
**Mode:** day
**Start SHA:** `59bc801bbaa047834f78819370aa7a805acb1783`

## Mission

Determine why the current GitHub Actions workflows fail before repository steps
execute. Inspect current runs, jobs, step arrays, annotations, runner metadata,
workflow SHAs, runner labels, permissions/policies visible to the connected
account, prior runs, and local workflow syntax. Modify workflow YAML only if a
repository-side defect is proven.

## Current classification

`ACCOUNT_OR_POLICY`: current GitHub check-run annotations state that jobs were
not started because recent account payments failed or the spending limit needs
to be increased. The current jobs have zero steps, `runner_id: 0`, and no runner
name. Do not mask this external condition by editing workflows.

## Exit and progression

Write `docs/redesign/evidence/campaign044/`, update durable state, commit/push
the diagnosis, and continue to Campaign 045 when local workflow checks remain
sound. External account repair is outside repository authority.

---

# Campaign 043 — Independent Platform & Release-Boundary Validation

**Status:** VALIDATED — `CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING`
**Campaign id:** `043-independent-platform-release-validation`
**Predecessor:** `042-conditional-closure-defect-isolation` (validated)
**Mode:** day
**Start SHA:** `afeca4d6cf330e698513c3289e0c1ca5e83f4394`

## Mission

Independently validate the current release boundaries that the environment
can genuinely execute: a fresh release APK, Metro-independent Android
startup and core routes, reachable system document/share UI, technical
accessibility traversal where safely executable, and signing/store limits.
Keep unavailable human, physical-device, iOS, VoiceOver, TalkBack-human,
and store evidence explicitly unavailable. Repair only a reproduced current
product defect.

## Guardrails

Preserve SQLite schema/migrations, session/workout identity, scoring,
progression/currency, gameplay, offline behavior, routing, and the
no-medical-claims boundary. Use only the dedicated `braintraining-ui35` /
`emulator-5554` runtime and emulator-local input. Do not edit CI to hide
external failures, do not touch the Study Maker `emulator-5556`, and do not
commit secrets, signing material, private traces, APKs, or giant raw dumps.

## Required evidence

Evidence belongs under `docs/redesign/evidence/campaign043/`, including the
fresh release baseline, system-UI boundary result, physical Android status,
technical TalkBack status, iOS/VoiceOver status, signing/store boundary,
human-validation handoff, defect-repair log, and a truthful closure verdict.

## Exit labels

Use exactly one of `CAMPAIGN_043_COMPLETE`,
`CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING`, or
`CAMPAIGN_043_BLOCKED`. Manual/platform gaps alone are partial, not a reason
to stop independent later campaigns.

---

# Campaign 042 — Conditional Closure / Defect Isolation

**Status:** VALIDATED — `CAMPAIGN_042_TECHNICAL_CERTIFIED`
**Campaign id:** `042-conditional-closure-defect-isolation`
**Predecessor:** `041-retrospective-hardening-overlay` (conditional)
**Mode:** day
**Start SHA:** `8825be34fea78eee9f01433bcaf1230c3d2f8b8e`

## Terminal result

Campaign 042 is technically certified for the Android/repository scope. It
isolated and repaired the reproduced Expo SQLite runtime-teardown startup NPE,
closed the three named game result lifecycles with direct persistence checks,
repaired the demonstrated font-scale-2 Results action clipping, and
revalidated the release route/theme, responsive, relaunch, persistence, and
repository gates. External CI, human/platform, store, and system-sheet limits
remain explicitly classified in the evidence packet.

The complete packet is under `docs/redesign/evidence/campaign042/`, with
terminal verdict `CAMPAIGN_042_TECHNICAL_CERTIFIED` in
`CAMPAIGN042_CLOSURE.md`.

---

# Campaign 040 — Release-Candidate Integration & Certification

> **Campaign 041 audit overlay (owner-requested, 2026-09-18):** The
> Campaign 041 retrospective hardening/certification audit was executed after
> this campaign’s terminal checkpoint without opening a new feature/redesign
> campaign or changing the machine-readable active-campaign state. Its
> evidence is under `docs/redesign/evidence/campaign041/`; current result is
> `CAMPAIGN_041_CONDITIONAL`. See `.agent/STATE.md`, `.agent/VALIDATION.md`,
> and the closure packet for current findings and pending handoff items.

**Status:** VALIDATED — `CAMPAIGN_040_CONDITIONAL`
**Campaign id:** `040-release-candidate-integration-certification`
**Predecessor:** `039-performance-reliability-maintenance-isolation` (validated)
**Mode:** day
**Start SHA:** `174fff6`
**Change:** `040-release-candidate-integration-certification` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 039 checkpoint.

## Mission

Re-observe the integrated release candidate, run the broadest practical local
and dedicated-Android matrix, recheck the 42-game catalog and representative
mechanics, review unsupported copy/debt, and classify actual readiness without
inventing human, iOS, physical-device, signing, document-sheet, or CI success.

## Guardrails

Preserve SQLite/profile/session/workout identity, migrations, offline behavior,
economy, gameplay, recoverable routing, and the no-medical-claims boundary.
Avoid destructive Data Management actions and do not turn certification into
a speculative feature or architecture rewrite.

## Terminal result

Campaign 040 is **CONDITIONAL** for the executable repository and dedicated
Android release-candidate scope. The final release candidate passed the local
repository gates, 22-surface light/dark matrix, automated accessibility audit,
offline checks, catalog identity/search checks, representative workout and
standalone-game journeys, and relaunch persistence observation. Two current
release interaction defects were repaired with focused regressions.

Independent human, manual TalkBack/VoiceOver, iOS, physical-device,
store-signing/system-sheet, full manual catalog/workout, and external CI
evidence remain unavailable or conditional. See
`docs/redesign/evidence/campaign040/` and the overnight handoff.

## Exit

Campaign 040 must end with exactly one truthful label: `CERTIFIED`,
`CONDITIONAL`, `PARTIAL`, or `BLOCKED`. Evidence belongs under
`docs/redesign/evidence/campaign040/`, with the overnight handoff updated.

---

# Campaign 039 — Performance, Reliability & Maintenance Isolation

**Status:** VALIDATED
**Campaign id:** `039-performance-reliability-maintenance-isolation`
**Predecessor:** `038-accessibility-device-sensory-hardening` (validated)
**Mode:** day
**Start SHA:** `9672c07`
**Change:** `039-performance-reliability-maintenance-isolation` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 038 checkpoint.

## Mission

Measure current startup, route/loading, persistence/relaunch, representative
data-loading, warning, and maintenance behavior. Repair only a demonstrated
material regression, keeping dependency maintenance isolated.

## Current evidence

Campaign 038 was terminally validated for the tested Android scope. Campaign
039 measured current behavior, found no reproducible redesign-created source
performance defect requiring speculative optimization, and aligned Expo SDK
57 compatible patch dependencies in an isolated manifest/lockfile commit.

The post-refresh release matrix is 22/22 route-verified/nonblank with zero
automated accessibility violations; release GameHost loaded its bundled
intro, Games search found `memory` among 42 entries, and filtered logcat had
no fatal/ANR/SQLite-lock signal. Evidence is under
`docs/redesign/evidence/campaign039/`.

## Bounded implementation

- Measure before optimizing using current dev-only perf records, ADB timing,
  route-verified native observation, fresh logcat, and same-host probes.
- Preserve offline bootstrap, SQLite/profile/session/workout state, recoverable
  routes, and existing CI/workflow configuration.
- Record an evidence-only result when current behavior shows no material
  redesign-created regression.

## Terminal result

Campaign 039 is **COMPLETE for the tested Android/repository scope**. The
startup timing variance and manual/platform/external limits remain explicitly
classified; no global release certification is implied. Campaign 040 is the
next safe successor.

## Exit criteria

No known redesign-created material performance/reliability regression remains;
any maintenance change is isolated and evidence-backed; evidence is recorded
under `docs/redesign/evidence/campaign039/`. Result must be COMPLETE or PARTIAL
truthfully.

---

# Campaign 038 — Accessibility, Device, Motion & Sensory Hardening

**Status:** VALIDATED
**Campaign id:** `038-accessibility-device-sensory-hardening`
**Predecessor:** `037-navigation-state-coherence` (validated)
**Mode:** day
**Start SHA:** `a158748`
**Change:** `038-accessibility-device-sensory-hardening` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 037 checkpoint.

## Mission

Move beyond the normal-font static audit into truthful Android evidence for
reachability, text scale, motion, sensory settings, theme, and safe viewport
conditions. Repair only defects demonstrated on the dedicated emulator.

## Terminal evidence

The matching Campaign 038 matrix is 22/22 route-verified and nonblank in light
and dark. Font-scale-2 and compact-phone captures passed the automated a11y
audit with zero violations. The reported Profile Shield and Games Symbol
Tracker clipping became fully visible after ordinary scrolling, so no inset
change was justified. Rapid SFX/haptics writes exposed a real SQLite writer
race; `_layout.tsx` now serializes them and the focused regression contract
was red before, green after.

## Bounded implementation and result

- Follow the reported clipped controls to settled scroll positions before
  changing source; add the smallest shared reachability fix only if needed.
- Exercise existing font-scale, theme/system, reduced-motion, and SFX/haptics
  seams with restored emulator settings.
- Add focused regression contracts for any demonstrated defect.
- Preserve session/workout identity, persistence, migrations, economy,
  gameplay, offline boundaries, and router architecture.

Campaign 038 is **COMPLETE for the tested Android scope** at `a7f1531`.
Evidence, pixel/XML comparisons, a11y results, runtime logs, and human/platform
limits are under `docs/redesign/evidence/campaign038/`. Campaign 039 is the
next safe successor.

## Exit criteria

High-value journeys remain operable under the conditions actually tested;
demonstrated defects have focused regression proof; native pixels/XML, a11y,
logcat, and manual/platform limits are recorded under
`docs/redesign/evidence/campaign038/`. Result must be labelled COMPLETE or
PARTIAL truthfully.

---

# Campaign 037 — Navigation, State & Cross-Surface Coherence Hardening

**Status:** VALIDATED
**Campaign id:** `037-navigation-state-coherence`
**Predecessor:** `036-first-run-trust-experience` (validated)
**Mode:** day
**Start SHA:** `340d61a4fedffb46e8adf8245d57cb03a5831906`
**Change:** `037-navigation-state-coherence` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 036 checkpoint.

## Mission

Audit the redesigned application as one product. Keep the observed major
back/return journeys coherent, preserve recoverable invalid/empty routes, and
remove the concrete clean-state copy contradiction without rewriting routing.

## Terminal evidence

The native baseline under `D:\Temp\campaign037-runtime-before` contains 22/22
route-verified, nonblank light/dark surfaces. Emulator-local journeys showed
Games → Game Detail → back, Game Detail → Play → GameHost → back, result and
Progress drill-down returns, Profile → Rewards/Data returns, and recoverable
invalid Game/Detail/Results deep links. The clean-state plan line now
distinguishes a starting set from history-aware planning when no completed
sessions exist.

## Bounded implementation

- Use a starting-set phrase for Home when the local recent-session list is
  empty; retain the existing history-aware phrase for returning players.
- Add focused contracts for the Home branch and the observed route/error
  fallbacks.
- Preserve Expo Router behavior, workout/session provenance, persistence,
  empty states, economy, and gameplay.

## Terminal result

Clean-state copy is honest and the observed major journeys retain context;
invalid/loading/empty routes remain recoverable; focused/full validation and
matching native evidence are recorded under
`docs/redesign/evidence/campaign037/`. Campaign 037 is **COMPLETE** at
`ad4e54a`; Campaign 038 is the next safe successor.

---

# Campaign 036 — First-Run, Empty-State & Trust Experience

**Status:** VALIDATED
**Campaign id:** `036-first-run-trust-experience`
**Predecessor:** `035-visual-system-consolidation` (validated)
**Mode:** day
**Start SHA:** `27fd1f27866401b35da875a5250648babc768431`
**Change:** `036-first-run-trust-experience` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 035 checkpoint.

## Mission

Make the observed clean-install path locally legible without adding an
onboarding funnel: reassure the player that training is ready on-device and
offline, distinguish initialized local setup from an unavailable storage-size
metric, and explain the included starter cosmetics.

## Terminal evidence

The true clean-install baseline is retained outside Git under
`D:\Temp\campaign036-runtime-before` and
`D:\Temp\campaign036-runtime-before-all`; matching after captures are under
`D:\Temp\campaign036-runtime-after`. Home now has explicit local/offline
trust copy, Data Management reports `Ready` for initialized local state when
the byte metric is unavailable, and Rewards explains the included starter set.
Progress and Game Detail remain honest about no sessions, and Profile still
identifies the local player.

## Bounded implementation

- Add one secondary local/offline line inside the existing Home workout hero.
- Show `Ready` for a populated initialized local store when byte metrics are
  unavailable, without changing exact counts or storage behavior.
- Explain the starter set inside the existing Rewards Collection section.

No account gate, large onboarding, schema/economy/backup/gameplay change, or
fabricated progression is authorized.

## Terminal result

A clean-install user can understand what to start, where the record lives,
why the initial collection is nonzero, and what empty states mean. Matching
native before/after evidence, focused/full validation, and a synchronized
checkpoint are recorded under `docs/redesign/evidence/campaign036/`. Campaign
036 is terminally validated; Campaign 037 is the next safe successor.

---

# Campaign 035 — Cross-Surface Visual System Consolidation

**Status:** VALIDATED
**Campaign id:** `035-visual-system-consolidation`
**Predecessor:** `034-profile-motivation-rewards` (validated)
**Mode:** day
**Start SHA:** `f1ed5331dd2f2cec69bab01e2404ca4b7831d424`
**Change:** `035-visual-system-consolidation` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 034 checkpoint.

## Mission

Make the single-game identity heroes read as one calm system: use the shared
neutral hero surface, retain domain identity in the existing motif/category
cue, and let the global Play/Start action be the clear primary accent.

## Current evidence

The baseline under `D:\Temp\campaign035-runtime-before` contains 16
nonblank, route-verified light/dark captures across Home, Games, Game Detail,
Progress, Profile, Rewards, Results, and GameHost intro. A warmed GameHost
intro was separately inspected. The selected bounded finding is the saturated
domain wash/border competing with the primary action on single-game heroes.

## Terminal result

Game Detail and GameHost intro now use the neutral shared hero surface while
retaining the domain identity mark/category cue and the global Play/Start
action hierarchy. Focused visual contracts, full Jest, typecheck, lint,
repository validators, native light/dark captures/XML, accessibility, fresh
logcat, and Android build/install passed. The complete evidence package is
under `docs/redesign/evidence/campaign035/`; Campaign 035 is validated and
Campaign 036 is the next safe successor.

## Guardrails

- Preserve game identity metadata, tutorial/difficulty behavior, QA gating,
  session identity, scoring, persistence, registry, and all mechanics.
- Do not change tokens globally, schema, economy, backup format, or offline
  behavior.
- Use the dedicated `emulator-5554` only for native validation and keep all
  automation emulator-local.
- Record human/manual platform limits as pending rather than inferring them.

## Exit criteria

Game Detail and GameHost intro retain their existing identity/action behavior
while using neutral hero surfaces with visible domain cues; matching light/dark
before/after evidence, focused/full validation, and a synchronized checkpoint
are recorded under `docs/redesign/evidence/campaign035/`. A safe partial result
must be labeled PARTIAL.

## Recovery order

1. `AGENTS.md`, constitution, `.agent/GOVERNANCE.json`, `.agent/STATE.md`
2. this file, `.agent/EXECUTION_PROMPT.md`, and
   `openspec/changes/035-visual-system-consolidation/`
3. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`, and
   `docs/redesign/evidence/campaign035/**`

---

# Campaign 034 — Profile, Motivation, Rewards & Ownership Simplification

**Status:** VALIDATED
**Campaign id:** `034-profile-motivation-rewards`
**Predecessor:** `033-progress-disclosure-redesign` (validated)
**Mode:** day
**Start SHA:** `f64df0315e3dd1b7e2d8519c560e3c9aea1bccb0`
**Change:** `034-profile-motivation-rewards` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18, following the validated Campaign 033 checkpoint.

## Mission

Turn Profile into a grouped control center. Keep identity and quiet
progression context on Profile, keep streak protection and motivation evidence
there, and make Rewards the single owner of pending reward claims, cosmetics,
and reward history. Preserve the existing persistence and idempotency seams.

## Current evidence

The current Profile and Rewards routes were observed natively before editing
with the persisted one-session state. Profile showed a duplicated full
cosmetics gallery alongside claim buttons for achievement, quest, and
milestone rewards. Rewards already presented the unified inbox, claim-all,
cosmetic collection/equip flows, and reward history.

## Guardrails

- Preserve ledger writes, claim idempotency, streak reconstruction/protection,
  quest/achievement definitions, cosmetic ownership/equip rules, and all data
  portability safeguards.
- Do not change SQLite schema, scoring, rating/mastery formulas, gameplay,
  backup format, or offline behavior.
- Use the dedicated `emulator-5554` only for native validation and keep all
  automation emulator-local.
- Record human/manual platform limits as pending rather than inferring them.

## Terminal result

Profile has clear Motivation, Rewards, Data, and Settings grouping; claimable
reward actions and full cosmetics/history have one Rewards owner; existing
streak/settings/data controls remain reachable; focused/full validation and
native light/dark evidence are recorded under
`docs/redesign/evidence/campaign034/`; and the synchronized `main` checkpoint
is pushed. Campaign 034 is terminally validated and Campaign 035 is the next
safe successor.

## Recovery order

1. `AGENTS.md`, constitution, `.agent/GOVERNANCE.json`, `.agent/STATE.md`
2. this file, `.agent/EXECUTION_PROMPT.md`, and
   `openspec/changes/034-profile-motivation-rewards/`
3. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`, and
   `docs/redesign/evidence/campaign034/**`

---

# Campaign 033 — Progress summary and progressive disclosure redesign

**Status:** VALIDATED
**Campaign id:** `033-progress-disclosure-redesign`
**Predecessor:** `032-games-discovery-identity-redesign` (validated)
**Mode:** day
**Start SHA:** `3253ca1437b9d70f58b3a89dca54403610c6fa0e`
**Change:** `033-progress-disclosure-redesign` (VALIDATED)
**Authorization:** owner-supplied Campaign 033–040 overnight directive on
2026-09-18; the coupled authoritative task files are
`.agent/CAMPAIGN033_PROGRESS_DISCLOSURE_REDESIGN_PROMPT.md`,
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md`, and
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`.

## Mission

Make Progress answer-first: show selected-window consistency, cautious
recorded movement, and one evidence-backed next consideration before the
existing composite and deeper analytics. Keep sparse data honest, preserve
drill-down ownership and protected analytics/persistence contracts, and fix
Progress-local accessibility debt encountered during the work.

## Terminal result

Campaign 033 is validated. The implementation and evidence package are under
`docs/redesign/evidence/campaign033/`; native sparse/populated light/dark
captures and accessibility results are recorded, while independent human,
TalkBack, iOS, physical-device, large-text, and reduced-motion checks remain
pending/deferred. Campaign 034 may be opened by the overnight orchestrator.

## Guardrails

- Preserve analytics formulas, rating/mastery semantics, session persistence,
  scoring, generators, schema, backup format, offline behavior, and the
  no-medical-claim boundary.
- Keep existing Progress Activity, domain, game-history, Game Detail, and
  advanced analytics routes reachable.
- Use the dedicated normal Android AVD with emulator-local/ADB or ARTEMIS
  controls only; do not touch user-owned devices or inject host input.
- Keep ARTEMIS credentials/traces external and classify human/platform limits
  honestly.

## Recovery order

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/GOAL.md`, `.agent/STATE.md`
3. this file, `.agent/EXECUTION_PROMPT.md`, and
   `openspec/changes/033-progress-disclosure-redesign/`
4. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`, and
   `docs/redesign/evidence/campaign033/**`
