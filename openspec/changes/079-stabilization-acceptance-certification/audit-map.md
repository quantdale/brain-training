# Audit map — 079-stabilization-acceptance-certification

Maps each planned work area to its write surfaces, required validation, and
evidence destination. Orchestrator-owned unless noted; no parallel writer
shares a surface.

| Area | Write surfaces | Required validation | Evidence |
|---|---|---|---|
| Validator CLI-contract gate | `scripts/certification/validate-cli-contracts.mjs` (new), `.github/workflows/repository-integrity.yml`, `.agent/GOVERNANCE.json` | new gate + its self-test, existing gate mirror, full local Repository Integrity mirror | `docs/certification/079-release-certification/ci-recovery.md` |
| Dependency security | `apps/mobile/package-lock.json`, `scripts/certification/dependency-audit-allowlist.json`, `.agent/DEPENDENCY_AUDIT.md` | `validate-dependency-audit.mjs` + self-test, typecheck, full Jest | `docs/certification/079-release-certification/security.md` |
| Release governance | `.github/workflows/*.yml` (audit only), GitHub branch protection via API | API read-back of protection/rulesets, PR-trigger feasibility check | `docs/certification/079-release-certification/governance.md` |
| Product acceptance / defect fixes | assigned `apps/mobile/src/**` surfaces only | regression tests proving defect, focused + full Jest, typecheck, lint | `docs/certification/079-release-certification/product-acceptance.md` |
| Performance evidence | none (measurement only) | `npm run perf:probe` (local probe, not a CI gate) | `docs/certification/079-release-certification/performance.md` |
| Governance reconciliation | `.agent/**`, `docs/certification/**`, `openspec/changes/079-*/**` | `validate-repo-state.mjs`, strict OpenSpec, spec-store `--check` | certification matrix + executive report |
| Certification | `docs/certification/079-release-certification/**` | independent review of every matrix row's evidence | `release-matrix.md`, `handoff.md` |
