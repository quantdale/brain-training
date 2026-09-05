# Durable Project State

**Last update:** 2026-09-06 — documentation/governance reconciliation after Campaign 022 terminal certification evidence was pushed.
**Canonical branch:** `main`
**Active campaign:** none
**Last campaign:** `022-release-candidate-certification`
**Last campaign status:** VALIDATED

## Current status

Campaign 022 — Release-Candidate Certification is **VALIDATED / TERMINAL**. Its release-readiness verdict is **CONDITIONAL GO**: no repository-owned release blocker remains, while explicitly external/manual platform and distribution gates remain required before public/store release.

The campaign's release-code candidate includes the final import-screen reachability repair at `61aea07`; subsequent Campaign 022 commits through `1094a20` are certification/evidence records. Exact artifact metadata, device evidence, 42/42 autobot certification, full regression evidence, platform classifications, workflow run IDs, and limitations are recorded in `.agent/VALIDATION.md` and the Campaign 022 OpenSpec packet.

## Terminal evidence summary

- Registry-wide Android runtime certification: **42/42 PASS** through the campaign's fail-closed autobot/certify path.
- Workout V3, lifecycle/process-death, real SQLite/data-integrity, backup/restore, offline, security/privacy, and standalone release-artifact paths were exercised and recorded in `.agent/VALIDATION.md`.
- Release APK was independently inspected and run without Metro; the campaign fixed release-only defects discovered by that path rather than masking them.
- Full Jest/typecheck/lint/repository validator matrix and the final GitHub workflow evidence are SHA/run-attributed in `.agent/VALIDATION.md`.
- Manual TalkBack, Android SAF/system sheets, physical-device behavior, manual iOS runtime UX, and production/store signing remain **NOT VALIDATED / DEFERRED / EXTERNALLY BLOCKED** according to their actual evidence class.
- Local release signing is not Play/store signing and must never be represented as such.

## Open non-blocking maintenance

The Campaign 022 debt audit reclassified the proposed `xp_awards UNIQUE(source)` constraint as non-blocking and incorrect for legitimate repeated generic/system sources; existing production writers are transaction/CAS guarded and the ledger provides its own operation-id uniqueness. Remaining Low maintenance items include the static offline-validator heuristic gap, dead permanent provenance-allowlist entries, seeding test-seam noise, and QA-artifact retention. See `.agent/KNOWN_ISSUES.md` for the concise current list.

## Continuation rule

There is **no active campaign**. Do not resume Campaign 022 or invent a successor merely to keep an agent busy. A future campaign requires a new owner directive or a separately justified planning pass against current repository evidence. Historical Campaign 001–022 records remain recoverable from Git, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, OpenSpec history, and prior commits; they are not current executable authority.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
7. the OpenSpec packet for the campaign being inspected
