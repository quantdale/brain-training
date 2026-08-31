# Campaign 020 — Release-QA Convergence

**Status:** ACTIVE
**Campaign id:** `020-release-qa-convergence`
**Predecessor:** `019-game-lifecycle-resilience` (VALIDATED)
**Mode:** day
**Change:** `020-release-qa-convergence` (ACTIVE)
**Authorization:** explicit owner directive on 2026-08-30 authorizes whole-codebase hardening followed by autonomous Campaigns 017–020.

## Mission

Converge release certification, source/build identity, security scanning,
dependency classification, and final whole-codebase hardening signals into an
exact evidence set. No product breadth is in scope.

## Current execution state

Campaigns 017–019 are validated across persistence, engagement, shared game
lifecycle, timing, Workout V3 provenance, and catalog reconciliation. Campaign
020 is the sole active campaign. Its initial implementation adds an executable
high-confidence tracked-file secret gate; the remaining work is final
certification-signal review and whole-codebase convergence.

## Exit criteria

- Certification fails closed on skipped tests, diagnostic bypasses, missing
  artifacts, and semantic interaction failures.
- Running/source identity is bound before runtime evidence is trusted.
- Tracked-file secret detection is executable, self-tested, and non-leaking.
- Dependency findings are reclassified honestly; unsafe major churn is avoided.
- Final static/test/build/dependency evidence is exact and durable, with no
  known Critical/High in-scope regression, before the second whole-codebase
  hardening report.

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
