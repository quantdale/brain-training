# Proposal — 079-stabilization-acceptance-certification

## Why

The owner authorized a repository-wide final stabilization, product
acceptance, and release-certification program on 2026-10-21. The owner's
starting intelligence observed a red `Repository Integrity` job at `d26cd536`
and an unprotected canonical branch. The validator regression was already
repaired by a preceding actor at `2f18738f` (all four workflows green at
`64c1df4d`), but the remaining workstreams — evidence reconciliation,
independent product acceptance, confirmed-defect correction, performance and
security hardening, release governance, and an honest platform certification
matrix — need one governed, bounded program with explicit dispositions.

## What Changes

- Reconcile governance, OpenSpec, implementation, and certification evidence
  so the repository has one truthful current-state answer.
- Add an automated validator CLI-contract gate so a documented flag can never
  again be rejected by its own parser unnoticed (the exact `--self-test`
  regression class), and cross-check every GitHub Actions invocation against
  the script parsers.
- Reduce real dependency security risk through safe in-range lockfile
  remediation and maintain a complete advisory register (owner, review date,
  exit condition, remediation dependency per acceptance).
- Establish verified GitHub branch protection for `main` with required status
  checks, or document the exact external blocker.
- Perform evidence-based product/gameplay acceptance on available Android
  runtime, correct confirmed in-scope defects, and record measured performance
  evidence.
- Deliver an authoritative certification matrix that separates achieved
  evidence from NOT VALIDATED / BLOCKED gates and an owner handoff.

## Capabilities

### New Capabilities

- `release-certification`: A truthful, reproducible release-governance and
  certification contract: validator CLI contracts are machine-enforced, the
  advisory register is complete, and release gates carry per-gate evidence at
  exact revisions.

### Modified Capabilities

None. Gameplay, persistence, scoring, economy, routing, and offline contracts
are preserved.

## Impact

CI workflow step plus validator scripts, dependency lockfile (transitive
tooling packages only), governance/certification documentation, targeted
product defect fixes validated by regression tests, and GitHub repository
settings. No game rules, registry IDs, persistence formats, or runtime
dependencies change.
