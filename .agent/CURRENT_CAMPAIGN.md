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
