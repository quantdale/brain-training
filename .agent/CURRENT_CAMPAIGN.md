# Campaign 040 — Release-Candidate Integration & Certification

**Status:** ACTIVE
**Campaign id:** `040-release-candidate-integration-certification`
**Predecessor:** `039-performance-reliability-maintenance-isolation` (validated)
**Mode:** day
**Start SHA:** `174fff6`
**Change:** `040-release-candidate-integration-certification` (ACTIVE)
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
