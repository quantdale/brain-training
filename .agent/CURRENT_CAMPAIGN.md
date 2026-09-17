# Campaign 031 — Golden-path redesign

**Status:** VALIDATED
**Campaign id:** `031-golden-path-redesign`
**Predecessor:** `029-artemis-runtime-qa-migration` (repository checkpoint;
external ARTEMIS provider work remains separately classified)
**Mode:** day
**Start SHA:** `44ba1533f4eb5ebcd795723f801633caee914e17`
**Change:** `031-golden-path-redesign` (VALIDATED)
**Authorization:** owner-supplied Campaign 031 implementation directive on
2026-09-17; authoritative specification is
`.agent/CAMPAIGN031_GOLDEN_PATH_REDESIGN_IMPLEMENTATION_PROMPT.md`.

## Mission

Execute Campaign 031 exhaustively: structurally redesign the golden path from
Today/Home through workout completion while preserving the existing game,
SQLite, workout-instance, provenance, lifecycle, scoring, rating, XP,
currency, reward, tutorial, registry, offline, and deterministic-QA
contracts. Use Campaign 030B as the before baseline. Do not begin Campaign
032 or broaden into its explicitly excluded surfaces.

## Terminal result

Campaign 031 is terminally validated. Home separates the dominant Today CTA
from compact context and secondary workout configuration; GameHost presents a
concise mechanic and workout position; shared and route Results use the
outcome → facts → reward → Next/Finish hierarchy; and final completion returns
directly to Today. The existing workout, game, persistence, provenance,
lifecycle, scoring, reward, offline, and tutorial contracts were exercised.

The Campaign 030B screenshots and runtime traces remain immutable. The
Campaign 031 evidence package is under `docs/redesign/evidence/campaign031/`
and raw disposable-AVD artifacts remain under `D:\Temp\campaign031-*`.

## Guardrails

- One disposable normal Android AVD; emulator-local/ADB or ARTEMIS only, no
  host-input or desktop-focus automation and no user-owned emulator.
- No schema, dependency, CI, discovery, Progress, Profile, Rewards, economy,
  or unrelated debt work.
- No credentials or external ARTEMIS source/traces in Git. Unavailable human
  or provider evidence stays explicitly pending/blocked.
- Campaign 031 is committed and pushed to `main`; the terminal state is
  complete, no active successor is bound, and Campaign 032 was not started.

## Recovery order

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/GOAL.md`, `.agent/STATE.md`
3. this file, `.agent/EXECUTION_PROMPT.md`, and
   `openspec/changes/031-golden-path-redesign/`
4. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`, and Campaign 030B
   evidence under `docs/redesign/evidence/campaign030b/**`
