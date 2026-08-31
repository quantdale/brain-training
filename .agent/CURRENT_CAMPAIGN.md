# Campaign 020 — Release-QA Convergence

**Status:** VALIDATED — terminal repository state; external device/manual certification remains pending
**Campaign id:** `020-release-qa-convergence`
**Predecessor:** `019-game-lifecycle-resilience` (VALIDATED)
**Mode:** day
**Change:** `020-release-qa-convergence` (VALIDATED; `change.json` VALIDATED, `GOVERNANCE.activeCampaign` null, `STATE` and terminal ownership synchronized)
**Authorization:** explicit owner directive on 2026-08-30 authorizes whole-codebase hardening followed by autonomous Campaigns 017–020.

## Mission

Converge release certification, source/build identity, security scanning,
dependency classification, and final whole-codebase hardening signals into an
exact evidence set. No product breadth is in scope.

## Current execution state

Campaigns 017–019 are validated across persistence, engagement, shared game
lifecycle, timing, Workout V3 provenance, and catalog reconciliation. Campaign
020 is validated after adding an executable high-confidence tracked-file secret
gate, completing certification/source-identity review, re-running dependency
classification, and completing the requested second whole-codebase audit. No
campaign is active.

## Final classification

**LOCALLY / AUTOMATED COMPLETE — EXTERNAL DEVICE / MANUAL CERTIFICATION PENDING**

All repository-owned implementation and automated hardening evidence available
in this environment is complete. Android runtime, manual accessibility/system
sheet, physical-device, and manual iOS UX evidence remains explicitly
BLOCKED/NOT VALIDATED and is not inferred from static, web, or compile checks.

## Exit criteria

- Certification fails closed on skipped tests, diagnostic bypasses, missing
  artifacts, and semantic interaction failures.
- Running/source identity is bound before runtime evidence is trusted.
- Tracked-file secret detection is executable, self-tested, and non-leaking.
- Dependency findings are reclassified honestly; unsafe major churn is avoided.
- Final static/test/build/dependency evidence is exact and durable, with no
  known Critical/High in-scope regression; the second whole-codebase hardening
  report is recorded in `VALIDATION.md` and the Campaign 020 checkpoint.

## Scope guard

No game #43, content expansion, cloud/auth/AI/monetization/social system,
signing, store publication, or unrelated feature expansion is in scope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
7. `openspec/changes/020-release-qa-convergence/EXECUTION.md`
