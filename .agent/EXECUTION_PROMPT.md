# Execution Prompt — Campaign 038: Accessibility, Device, Motion & Sensory Hardening

**Status:** VALIDATED
**Change:** `038-accessibility-device-sensory-hardening`
**Planned-From:** `a158748`
**Start-SHA:** `a158748`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `037-navigation-state-coherence`

## Authority

Execute Campaign 038 from
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and the guardrails in
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`. Campaign
037 is validated; its 22-surface audit authorizes this accessibility/device/
motion/sensory hardening scope.

## Mission

Test and, only where observed, repair tab-bar reachability, text scaling,
screen-reader semantics, reduced motion, sensory-disabled settings, theme, and
alternate phone viewport behavior on the dedicated Android runtime.

## Terminal result

The required Android evidence is complete for the tested scope. The matching
22-surface light/dark matrix, font-scale-2 and compact matrices, settled
Profile/Games scroll checks, reduced-motion device condition, sensory off/on
cold-relaunch checks, real pixel comparison, fresh logcat, focused/full tests,
typecheck, lint, validators, and Android build/install are recorded under
`docs/redesign/evidence/campaign038/`. The only demonstrated product defect,
overlapping SQLite sensory writes, was repaired at `a7f1531` with a regression
test that was red before the fix.

Campaign 038 is **VALIDATED / COMPLETE for the tested Android scope**. Manual
TalkBack/VoiceOver, iOS, physical-device, production-signing, and independent
human evidence remain explicitly pending.

## Guardrails

Do not add a new accessibility framework or non-functional setting. Do not
replace the router or change game mechanics, session identity, persistence,
migrations, schema, economy, backup/restore, offline behavior, or gameplay.

---

# Execution Prompt — Campaign 037: Navigation, State & Cross-Surface Coherence

**Status:** VALIDATED
**Change:** `037-navigation-state-coherence`
**Planned-From:** `340d61a4fedffb46e8adf8245d57cb03a5831906`
**Start-SHA:** `340d61a4fedffb46e8adf8245d57cb03a5831906`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `036-first-run-trust-experience`

## Authority

Execute Campaign 037 from
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and the guardrails in
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`. Campaign
036 is validated; the native cross-surface audit authorizes this bounded
copy/contract slice.

## Mission

Keep the observed navigation and return-context seams intact while making
clean-state Home planning copy honest about the absence of recorded history.

## Required validation and handoff

Exercise and record Home, Games, Game Detail, GameHost, Result, Progress
drill-down, Profile/Rewards/Data, invalid-ID, and empty-result paths before and
after. Run focused/full tests, typecheck, lint, relevant validators, matching
native pixels/XML, accessibility, and fresh logcat. Record manual/platform and
external-CI limits honestly.

## Terminal result

Campaign 037 is complete at source checkpoint `ad4e54a`, pushed to
`origin/main`. The clean Home subtitle now distinguishes a starting set from
history-aware planning; observed route/context and invalid/empty fallbacks
remain operational. Focused/full validation, Android build/install, matching
22-surface native evidence, pixel comparison, automated accessibility, and
fresh logcat are recorded under `docs/redesign/evidence/campaign037/`.
Manual/platform and terminal-push external-CI evidence remain explicitly
pending/classified rather than inferred.

## Guardrails

Do not replace the router or introduce new navigation state. Do not change
session identity, workout provenance, persistence, schema, economy, backup,
offline behavior, or gameplay.

---

# Execution Prompt — Campaign 036: First-Run, Empty-State & Trust Experience

**Status:** VALIDATED
**Change:** `036-first-run-trust-experience`
**Planned-From:** `27fd1f27866401b35da875a5250648babc768431`
**Start-SHA:** `27fd1f27866401b35da875a5250648babc768431`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `035-visual-system-consolidation`

## Authority

Execute Campaign 036 from
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and the guardrails in
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`. Campaign
035 is validated; the true clean-install baseline authorizes this bounded
first-run/trust slice.

## Mission

Improve first-run comprehension with compact factual copy and a truthful local
store status. Keep the existing Home workout action and all honest empty/no-
history states intact.

## Required validation and handoff

Observe clean-install Home, Games, Progress, Profile, Rewards, Data
Management, Game Detail, and available empty/no-history routes before and after
on the dedicated Android emulator. Run focused screen contracts, typecheck,
lint, relevant repository validators, matching light/dark captures, pixel
comparison, accessibility, fresh logcat review, and full tests/build when
closing the campaign. Record manual/iOS/physical/platform limits honestly.

## Guardrails

Do not add a large onboarding flow without evidence. Do not add account gates,
forced reminders, health questionnaires, marketing, unsupported cognitive or
medical claims, schema/economy/backup changes, or fabricated progression. Keep
all existing navigation, semantic IDs, persistence, and destructive data
management safeguards.

## Terminal result

The bounded Home, Data Management, and Rewards clean-install clarity slice is
validated. Baseline and matching after artifacts are outside Git under
`D:\Temp\campaign036-runtime-before-all` and
`D:\Temp\campaign036-runtime-after`; exact evidence is under
`docs/redesign/evidence/campaign036/`. Campaign 037 is the next safe
successor.

---

# Execution Prompt — Campaign 035: Cross-Surface Visual System Consolidation

**Status:** VALIDATED
**Change:** `035-visual-system-consolidation`
**Planned-From:** `f1ed5331dd2f2cec69bab01e2404ca4b7831d424`
**Start-SHA:** `f1ed5331dd2f2cec69bab01e2404ca4b7831d424`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `034-profile-motivation-rewards`

## Authority

Execute Campaign 035 from
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and the guardrails in
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`. Campaign
034 is validated; this packet is the next bounded visual-system slice in the
owner-directed overnight sequence.

## Mission

Consolidate the observed single-game identity hero treatment: neutralize the
full domain wash/border on Game Detail and GameHost intro while retaining
domain identity through the shared motif/category cue and preserving the
global Play/Start action.

## Required validation and handoff

Observe the same Game Detail and warmed GameHost intro before and after on the
dedicated Android emulator; run focused GameHost/Game Detail/visual tests,
typecheck, lint, relevant repository validators, matching light/dark captures,
accessibility, and fresh logcat review. Preserve actual artifacts and classify
human, iOS, physical-device, large-text, reduced-motion, and external-CI
limits honestly.

## Terminal result

The bounded neutral-hero implementation and existing identity/action seams
were validated. Evidence is under `docs/redesign/evidence/campaign035/` and
the next safe campaign is 036.

## Protected contracts

No game mechanics, scoring, rating, mastery, session-write, generator,
economy, schema, backup/restore, export/delete, offline, or gameplay change
belongs to this campaign.

---

# Execution Prompt — Campaign 034: Profile, Motivation, Rewards & Ownership

**Status:** VALIDATED
**Change:** `034-profile-motivation-rewards`
**Planned-From:** `f64df0315e3dd1b7e2d8519c560e3c9aea1bccb0`
**Start-SHA:** `f64df0315e3dd1b7e2d8519c560e3c9aea1bccb0`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `033-progress-disclosure-redesign`

## Authority

Execute Campaign 034 from
`docs/redesign/CAMPAIGN033_040_OVERNIGHT_ROADMAP.md` and the guardrails in
`.agent/CAMPAIGN033_040_OVERNIGHT_AUTONOMOUS_EXECUTION_PROMPT.md`. Campaign
033 is validated; this packet is the next bounded slice in the owner-directed
overnight sequence.

## Terminal result

Recompose Profile into grouped identity, motivation, rewards, data, and
settings sections. Profile may summarize pending rewards, but Rewards must own
all claim actions, the full cosmetic collection, and reward history. This was
completed and validated; the next overnight slice is Campaign 035.

## Required validation and handoff

Observe Profile/Rewards before and after on the dedicated Android emulator;
run focused ownership/profile/rewards tests, typecheck, lint, relevant
repository validators, and native light/dark captures plus accessibility and
fresh logcat review. Preserve actual artifacts and classify human, iOS,
physical-device, large-text, reduced-motion, and external-CI limits honestly.

## Protected contracts

No schema, scoring, rating, mastery, session-write, generator, economy,
backup/restore, export/delete, offline, or gameplay-mechanics change belongs to
this campaign.

---

# Execution Prompt — Campaign 033: Progress summary and progressive disclosure

**Status:** VALIDATED
**Change:** `033-progress-disclosure-redesign`
**Planned-From:** `3253ca1437b9d70f58b3a89dca54403610c6fa0e`
**Start-SHA:** `3253ca1437b9d70f58b3a89dca54403610c6fa0e`
**Planned-At:** 2026-09-18
**Target-Branch:** `main`
**Predecessor:** `032-games-discovery-identity-redesign`

## Authority

Read and execute the complete
`.agent/CAMPAIGN033_PROGRESS_DISCLOSURE_REDESIGN_PROMPT.md`, coupled with
the overnight execution prompt and roadmap. The current Progress source and
native evidence outrank historical Campaign 029–032 narratives.

## Mission

Make the Progress overview answer consistency, recorded movement, and next
consideration in the selected window before deeper analytics. Preserve the
existing analytics, route, persistence, offline, scoring, and cautious
language contracts. Campaign 033 is terminally validated; the overnight
orchestrator may proceed to Campaign 034.

## Required validation and handoff

Campaign 033 evidence is committed under
`docs/redesign/evidence/campaign033/`. Focused and full Jest, typecheck, lint,
Android debug build/install, native light/dark sparse/populated captures,
UIAutomator accessibility audit, and fresh logcat review were executed and
classified there. Human, TalkBack, physical-device/iOS, large-text, and
reduced-motion evidence remains pending/deferred.

## Terminal result

The first populated viewport is summary-first, sparse data is explicit, deep
history remains reachable, and the 44dp Progress Detail row minimum is
explicit. No schema, scoring, rating, mastery, session-write, generator,
economy, or game-mechanics change was made.
