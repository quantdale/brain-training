# Campaign 032 — Games discovery and identity redesign

**Status:** VALIDATED
**Campaign id:** `032-games-discovery-identity-redesign`
**Predecessor:** `031-golden-path-redesign` (validated)
**Mode:** day
**Start SHA:** `fa29742f08636b455f23a90c27cec61798fb1024`
**Change:** `032-games-discovery-identity-redesign` (VALIDATED)
**Authorization:** owner-supplied Campaign 032 directive on 2026-09-17; the
authoritative task specification is
`.agent/CAMPAIGN032_GAMES_DISCOVERY_IDENTITY_REDESIGN_PROMPT.md`.

## Mission

Execute Campaign 032 exhaustively within Games discovery, search/filter/
favorites, game cards, Game Detail, and standalone game entry. Make Suggested
Next answer “what should I play?” and Browse All answer “what can I choose?”;
consolidate recommendation evidence; add a restrained identity system for all
42 catalog entries; and make mechanic understanding and Play precede history.

## Terminal result

Campaign 032 is terminally validated. The complete evidence package is under
`docs/redesign/evidence/campaign032/`; the 42-entry catalog and protected
runtime/persistence contracts remain intact; and Campaign 033 was not started.

## Guardrails

- Preserve all 42 catalog entries, generated registry correctness, lazy loading,
  favorites persistence, mastery semantics, tutorial/session behavior, workout
  eligibility, offline behavior, and game mechanics.
- Do not change Home, Progress, Profile, Rewards, economy, schema, dependencies,
  CI, or unrelated game implementation.
- Use one disposable normal Android AVD with emulator-local/ADB or ARTEMIS
  automation only. Do not touch user-owned devices or inject host input.
- Keep provider credentials and ARTEMIS traces external. Classify unavailable
  human/provider evidence honestly.

## Recovery order

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/GOAL.md`, `.agent/STATE.md`
3. this file, `.agent/EXECUTION_PROMPT.md`, and
   `openspec/changes/032-games-discovery-identity-redesign/`
4. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`, and Campaign 031
   evidence under `docs/redesign/evidence/campaign031/**`
